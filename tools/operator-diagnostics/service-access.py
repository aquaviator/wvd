#!/usr/bin/env python3
"""Read-only diagnosis of the WVD administrator setup's GOOGLE_HTTP_403.

Adapts the fixed targets and no-redirect/token-in-memory pattern from
tools/portal-runtime/enable-service-access.py. This separate entry point cannot
run setup, and changes here do not trigger the privileged deployment workflow.
No account, configuration, IAM policy, resource or message is changed.
"""
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

PROJECT = "wvd-development"
NUMBER = "6616382131"
SERVICE = "projects/wvd-development/locations/europe-west2/services/wvd-service"
HOST = "wvd-service-v3b6mv7uka-nw.a.run.app"
PROJECT_URL = "https://cloudresourcemanager.googleapis.com/v3/projects/" + PROJECT
RUN_URL = "https://run.googleapis.com/v2/" + SERVICE
FIELD = "projects/wvd-development/databases/(default)/collectionGroups/wvd_service_enquiries_v1/fields/deleteAt"
READS = {
    "project": PROJECT_URL,
    "database": "https://firestore.googleapis.com/v1/projects/wvd-development/databases/(default)",
    "service": RUN_URL,
    "google-provider": "https://identitytoolkit.googleapis.com/admin/v2/projects/wvd-development/defaultSupportedIdpConfigs/google.com?fields=name,enabled",
    "authorized-domains": "https://identitytoolkit.googleapis.com/admin/v2/projects/wvd-development/config?fields=name,authorizedDomains",
    "enquiry-ttl": "https://firestore.googleapis.com/v1/" + FIELD + "?fields=name,ttlConfig",
}
PERMISSIONS = {
    "project-permissions": (PROJECT_URL + ":testIamPermissions", (
        "resourcemanager.projects.get", "datastore.databases.getMetadata",
        "firebaseauth.configs.get", "firebaseauth.configs.update",
        "datastore.indexes.get", "datastore.indexes.update", "serviceusage.services.use",
    )),
    "service-permissions": (RUN_URL + ":testIamPermissions", (
        "run.services.get", "run.services.update", "run.services.setIamPolicy",
    )),
}
MAX_RESPONSE = 65536


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, _req, _fp, _code, _msg, _headers, _newurl):
        return None


def safe_text(value, pattern, secret=""):
    if isinstance(value, str) and len(value) <= 254 and re.fullmatch(pattern, value) and (not secret or secret not in value):
        return value
    return None


def error_details(body, token):
    """Return structured reason fields only; never Google's raw error message."""
    error = body.get("error") if isinstance(body, dict) else None
    if not isinstance(error, dict):
        return {}
    out = {}
    status = safe_text(error.get("status"), r"[A-Z_]{1,64}", token)
    if status:
        out["googleStatus"] = status
    details = error.get("details", [])
    for detail in details[:8] if isinstance(details, list) else []:
        if not isinstance(detail, dict) or detail.get("@type") != "type.googleapis.com/google.rpc.ErrorInfo":
            continue
        info = {}
        for key, pattern in {"reason": r"[A-Z][A-Z0-9_]{0,95}", "domain": r"[a-z0-9.-]{1,120}"}.items():
            value = safe_text(detail.get(key), pattern, token)
            if value:
                info[key] = value
        metadata = detail.get("metadata", {})
        if isinstance(metadata, dict):
            for key, pattern in {"service": r"[a-z0-9.-]{1,100}\.googleapis\.com", "consumer": r"projects/[0-9]{1,24}", "permission": r"[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*){1,4}"}.items():
                value = safe_text(metadata.get(key), pattern, token)
                if value:
                    info[key] = value
        if info:
            out.setdefault("errorInfo", []).append(info)
    return out


def summarize(check, body):
    if check in PERMISSIONS:
        requested = PERMISSIONS[check][1]
        granted = body.get("permissions", [])
        if set(body) - {"permissions"} or not isinstance(granted, list) or any(not isinstance(p, str) or p not in requested for p in granted):
            return {"permissionResult": "INCONCLUSIVE", "error": "INVALID_PERMISSION_RESPONSE"}
        return {"permissionResult": "SCOPED_RESULT", "scope": "project" if check == "project-permissions" else "service", "granted": [p for p in requested if p in granted], "notReturned": [p for p in requested if p not in granted]}
    if check == "project":
        return {"targetMatches": body.get("projectId") == PROJECT and body.get("name") == "projects/" + NUMBER, "active": body.get("state") == "ACTIVE"}
    if check == "database":
        return {"targetMatches": body.get("name") == "projects/wvd-development/databases/(default)", "nativeDatabase": body.get("type") == "FIRESTORE_NATIVE", "expectedLocation": body.get("locationId") == "eur3"}
    if check == "service":
        return {"targetMatches": body.get("name") == SERVICE, "publicTransportEnabled": body.get("invokerIamDisabled", False) is True, "expectedOrigin": body.get("uri") == "https://" + HOST}
    if check == "google-provider":
        return {"targetMatches": body.get("name") in {"projects/" + p + "/defaultSupportedIdpConfigs/google.com" for p in (PROJECT, NUMBER)}, "enabled": body.get("enabled") is True}
    if check == "authorized-domains":
        domains = body.get("authorizedDomains", [])
        return {"targetMatches": body.get("name") in {"projects/" + p + "/config" for p in (PROJECT, NUMBER)}, "serviceDomainAuthorized": isinstance(domains, list) and HOST in domains}
    if check == "enquiry-ttl":
        ttl = body.get("ttlConfig")
        state = "ABSENT" if ttl is None else ttl.get("state") if isinstance(ttl, dict) else None
        return {"targetMatches": body.get("name") == FIELD, "ttlState": state if state in {"ABSENT", "CREATING", "ACTIVE", "NEEDS_REPAIR"} else "UNRECOGNIZED"}
    raise RuntimeError("UNKNOWN_CHECK")


class GoogleClient:
    def __init__(self, token, opener=None):
        if not isinstance(token, str) or not 0 < len(token) <= 16384 or re.search(r"\s", token):
            raise RuntimeError("ADMIN_CREDENTIAL_REQUIRED")
        self.token = token
        self.opener = opener if opener is not None else urllib.request.build_opener(NoRedirect())

    def call(self, check, quota=False):
        """Only fixed GETs and the two exact read-only IAM permission tests."""
        if type(quota) is not bool or check not in READS and check not in PERMISSIONS:
            raise RuntimeError("UNKNOWN_CHECK")
        if check in READS:
            url, method, data = READS[check], "GET", None
        else:
            url, permissions = PERMISSIONS[check]
            method, data = "POST", json.dumps({"permissions": permissions}).encode("utf-8")
        headers = {"Authorization": "Bearer " + self.token, "Content-Type": "application/json"}
        if quota:
            headers["X-Goog-User-Project"] = PROJECT
        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        out = {"check": check, "quotaHeader": "wvd-development" if quota else "none"}
        if check in PERMISSIONS:
            out["permissionResult"] = "INCONCLUSIVE"
        try:
            try:
                response = self.opener.open(request, timeout=12)
            except urllib.error.HTTPError as error:
                response = error
            with response:
                out["httpStatus"] = response.code
                raw = response.read(MAX_RESPONSE + 1)
            if len(raw) > MAX_RESPONSE:
                out["error"] = "RESPONSE_TOO_LARGE"
                return out
            try:
                body = json.loads(raw)
            except (ValueError, UnicodeError):
                out["error"] = "NON_JSON_RESPONSE"
                return out
            if not isinstance(body, dict):
                out["error"] = "INVALID_RESPONSE"
            elif 200 <= out["httpStatus"] < 300:
                out.update(summarize(check, body))
                if out.get("targetMatches") is False:
                    out["error"] = "TARGET_MISMATCH"
            else:
                out.update(error_details(body, self.token))
        except Exception:
            out["error"] = "READ_FAILED"
        return out


def gcloud(args):
    result = subprocess.run(["gcloud", *args, "--quiet"], capture_output=True, text=True, timeout=35)
    if result.returncode != 0 or len(result.stdout) > MAX_RESPONSE:
        raise RuntimeError("GCLOUD_COMMAND_FAILED")
    return result.stdout.strip()


def context():
    """Read the same current gcloud configuration used by print-access-token."""
    raw = json.loads(gcloud(["config", "list", "--format=json(core.account,core.project,auth.impersonate_service_account,billing.quota_project,auth.access_token_file,auth.credential_file_override)"]))
    def setting(section, key):
        value = raw.get(section, {})
        return value.get(key) if isinstance(value, dict) else None
    return {
        "check": "gcloud-context",
        "account": safe_text(setting("core", "account"), r"[A-Za-z0-9._%+@-]{1,254}"),
        "configuredProject": safe_text(setting("core", "project"), r"[a-z0-9-]{1,100}"),
        "impersonatedServiceAccount": safe_text(setting("auth", "impersonate_service_account"), r"[A-Za-z0-9._@,-]{1,254}"),
        "configuredQuotaProject": safe_text(setting("billing", "quota_project"), r"[a-z0-9-]{1,100}"),
        "tokenOverridePresent": bool(os.environ.get("CLOUDSDK_AUTH_ACCESS_TOKEN")),
        "tokenFileOverridePresent": bool(setting("auth", "access_token_file") or os.environ.get("CLOUDSDK_AUTH_ACCESS_TOKEN_FILE")),
        "credentialFileOverridePresent": bool(setting("auth", "credential_file_override") or os.environ.get("CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE")),
    }


def diagnose(client, emit):
    recovered, denied, quota_denied, incomplete = [], [], [], []
    def usable(result):
        return 200 <= result.get("httpStatus", 0) < 300 and not result.get("error") and result.get("targetMatches", True) is True and result.get("permissionResult") != "INCONCLUSIVE"
    for check in (*READS, *PERMISSIONS):
        default = client.call(check)
        emit(default)
        final = default
        if default.get("httpStatus") == 403 or check in PERMISSIONS:
            final = client.call(check, quota=True)
            emit(final)
            if final.get("httpStatus") == 403:
                quota_denied.append(check)
            if default.get("httpStatus") == 403 and usable(final):
                recovered.append(check)
        if default.get("httpStatus") == 403 and final.get("httpStatus") == 403:
            denied.append(check)
        if final.get("error") or not usable(final) and final.get("httpStatus") != 403 and not (check == "enquiry-ttl" and final.get("httpStatus") == 404):
            incomplete.append(check)
    return {"status": "DIAGNOSTIC_COMPLETE", "quotaHeaderRecovered": recovered, "stillDenied": denied, "quotaHeaderDenied": quota_denied, "incompleteChecks": incomplete, "changesMade": False}


def main():
    emit = lambda item: print(json.dumps(item, separators=(",", ":")), flush=True)
    try:
        if len(sys.argv) != 1:
            raise RuntimeError("NO_ARGUMENTS_EXPECTED")
        emit(context())
        client = GoogleClient(gcloud(["auth", "print-access-token"]))
        emit(diagnose(client, emit))
        return 0
    except Exception as error:
        known = {"GCLOUD_COMMAND_FAILED", "ADMIN_CREDENTIAL_REQUIRED", "NO_ARGUMENTS_EXPECTED"}
        code = str(error) if type(error) is RuntimeError and str(error) in known else "LOCAL_DIAGNOSTIC_FAILED"
        emit({"status": "DIAGNOSTIC_FAILED", "error": code, "changesMade": False})
        return 1


if __name__ == "__main__":
    sys.exit(main())
