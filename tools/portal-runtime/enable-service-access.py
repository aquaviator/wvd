#!/usr/bin/env python3
"""One-time administrator setup for the already prepared WVD service.

Run manually with the exact release receipt produced and verified by CI:
  python3 tools/portal-runtime/enable-service-access.py wvd-service-release.json

Uses the administrator's existing gcloud login. Never grant a permanent role,
change booking, create an account, submit an enquiry, or send a message.
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

PROJECT = "wvd-development"
PROJECT_NUMBER = "6616382131"
SERVICE = "projects/wvd-development/locations/europe-west2/services/wvd-service"
SERVICE_ACCOUNT = "wvd-development@wvd-development.iam.gserviceaccount.com"
IMAGE_PREFIX = "europe-west2-docker.pkg.dev/wvd-development/wvd-booking-runtime/service@sha256:"
ANNOTATION = "wvd.dev/config-sha256"
IMAGE_ANNOTATION = "wvd.dev/image-sha256"
FIELD = "projects/wvd-development/databases/(default)/collectionGroups/wvd_service_enquiries_v1/fields/deleteAt"
RUN_URL = "https://run.googleapis.com/v2/" + SERVICE
PROJECT_URL = "https://cloudresourcemanager.googleapis.com/v3/projects/wvd-development"
DATABASE_URL = "https://firestore.googleapis.com/v1/projects/wvd-development/databases/(default)"
AUTH_URL = "https://identitytoolkit.googleapis.com/admin/v2/projects/wvd-development/config"
AUTH_GET = AUTH_URL + "?fields=name,authorizedDomains"
AUTH_PATCH = AUTH_URL + "?updateMask=authorizedDomains&fields=name,authorizedDomains"
GOOGLE_PROVIDER_URL = "https://identitytoolkit.googleapis.com/admin/v2/projects/wvd-development/defaultSupportedIdpConfigs/google.com?fields=name,enabled"
FIELD_URL = "https://firestore.googleapis.com/v1/" + FIELD
FIELD_GET = FIELD_URL + "?fields=name,ttlConfig"
FIELD_PATCH = FIELD_URL + "?updateMask=ttlConfig"
RUN_PATCH = RUN_URL + "?updateMask=invokerIamDisabled"
RUN_OPERATION = re.compile(r"projects/wvd-development/locations/europe-west2/operations/[A-Za-z0-9_-]+")
TTL_OPERATION = re.compile(r"projects/wvd-development/databases/\(default\)/operations/[A-Za-z0-9_-]+")


def require(condition, code):
    if not condition:
        raise RuntimeError(code)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def config_hash(value):
    return hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def exact(value, keys):
    return isinstance(value, dict) and set(value) == set(keys)


def valid_image(value):
    return isinstance(value, str) and value.startswith(IMAGE_PREFIX) and re.fullmatch(r"[a-f0-9]{64}", value[len(IMAGE_PREFIX):]) is not None


def provider_origin(value):
    require(isinstance(value, str), "INVALID_PROVIDER_ORIGIN")
    url = urllib.parse.urlsplit(value)
    require(url.scheme == "https" and not url.path and not url.query and not url.fragment and not url.username and not url.password and not url.port and value == "https://" + url.netloc and (re.fullmatch(r"wvd-service-[a-z0-9]+-[a-z0-9]+\.a\.run\.app", url.hostname or "") or url.hostname == "wvd-service-6616382131.europe-west2.run.app"), "INVALID_PROVIDER_ORIGIN")
    return value


def validate_receipt(receipt):
    require(exact(receipt, ["schemaVersion", "service", "sourceRevision", "image", "configSha256", "url"]), "INVALID_RELEASE_RECEIPT")
    require(type(receipt["schemaVersion"]) is int and receipt["schemaVersion"] == 1 and receipt["service"] == SERVICE and re.fullmatch(r"[a-f0-9]{40}", receipt["sourceRevision"]) and valid_image(receipt["image"]) and re.fullmatch(r"[a-f0-9]{64}", receipt["configSha256"]), "INVALID_RELEASE_RECEIPT")
    provider_origin(receipt["url"])
    return receipt


def validate_configuration(config, origin):
    require(exact(config, ["authentication", "portal", "enquiries", "mail"]) and exact(config["authentication"], ["serviceAccount"]) and config["authentication"]["serviceAccount"] == SERVICE_ACCOUNT, "SERVICE_CONFIGURATION_DRIFT")
    portal, enquiry, mail = config["portal"], config["enquiries"], config["mail"]
    require(exact(portal, ["origin", "firebase", "web", "owner", "maxConcurrentRequests"]) and portal["origin"] == origin and portal["owner"] is None and type(portal["maxConcurrentRequests"]) is int and portal["maxConcurrentRequests"] == 8, "INITIAL_OWNER_CONFIGURATION_REQUIRED")
    require(portal["firebase"] == {"projectId": PROJECT, "productId": "wvd", "databaseId": "(default)", "mode": "live"}, "SERVICE_CONFIGURATION_DRIFT")
    web = portal["web"]
    require(exact(web, ["projectId", "apiKey", "authDomain", "appId"]) and web["projectId"] == PROJECT and web["authDomain"] == PROJECT + ".firebaseapp.com" and web["appId"] == "1:6616382131:web:59b4e6749ce6e6e96b8ec6" and isinstance(web["apiKey"], str) and re.fullmatch(r"AIza[A-Za-z0-9_-]{30,80}", web["apiKey"]), "SERVICE_CONFIGURATION_DRIFT")
    require(exact(enquiry, ["allowedPublicOrigins", "admission", "maxConcurrentRequests", "retentionDays"]) and isinstance(enquiry["allowedPublicOrigins"], list) and sorted(enquiry["allowedPublicOrigins"]) == ["https://wearvalleydigital.com", "https://www.wearvalleydigital.com"] and enquiry["admission"] == {"minuteLimit": 10, "dailyLimit": 50} and type(enquiry["maxConcurrentRequests"]) is int and enquiry["maxConcurrentRequests"] == 2 and type(enquiry["retentionDays"]) is int and enquiry["retentionDays"] == 90, "SERVICE_CONFIGURATION_DRIFT")
    require(mail is None or mail == {"subject": "admin@wearvalleydigital.com", "senderEmail": "admin@wearvalleydigital.com", "recipientEmail": "hello@wearvalleydigital.com", "requestTimeoutMs": 10000}, "SERVICE_CONFIGURATION_DRIFT")


def inspect_service(service, receipt):
    require(isinstance(service, dict) and service.get("name") == SERVICE, "SERVICE_TARGET_MISMATCH")
    labels, annotations = service.get("labels", {}), service.get("annotations", {})
    require(all(labels.get(key) == value for key, value in {"product": "wvd", "environment": "development", "component": "service", "managed-by": "wvd-controller", "source-revision": receipt["sourceRevision"]}.items()), "SERVICE_RELEASE_MISMATCH")
    require(service.get("ingress") == "INGRESS_TRAFFIC_ALL" and type(service.get("invokerIamDisabled", False)) is bool and not service.get("defaultUriDisabled") and not service.get("iapEnabled"), "SERVICE_ADMISSION_DRIFT")
    template, scaling = service.get("template", {}), service.get("scaling", {})
    require(scaling.get("minInstanceCount", 0) == 0 and scaling.get("maxInstanceCount") == 1 and template.get("scaling", {}).get("minInstanceCount", 0) == 0 and template.get("scaling", {}).get("maxInstanceCount") == 1 and template.get("serviceAccount") == SERVICE_ACCOUNT and template.get("timeout") == "60s" and template.get("maxInstanceRequestConcurrency") == 4, "SERVICE_CAPACITY_OR_IDENTITY_DRIFT")
    require(not any(template.get(key) for key in ["volumes", "vpcAccess", "encryptionKey", "nodeSelector", "gpuZonalRedundancyDisabled", "sessionAffinity"]) and len(template.get("containers", [])) == 1, "SERVICE_TEMPLATE_DRIFT")
    container = template["containers"][0]
    require(container.get("image") == receipt["image"] and not any(container.get(key) for key in ["command", "args", "volumeMounts", "dependsOn", "livenessProbe", "readinessProbe", "baseImageUri", "workingDir"]), "SERVICE_CONTAINER_DRIFT")
    require(annotations.get(IMAGE_ANNOTATION) == container["image"][len(IMAGE_PREFIX):], "SERVICE_IMAGE_HASH_MISMATCH")
    ports, resources = container.get("ports", []), container.get("resources", {})
    require(len(ports) == 1 and ports[0].get("containerPort") == 8080 and ports[0].get("name", "http1") == "http1" and resources.get("limits") == {"cpu": "1", "memory": "512Mi"} and resources.get("cpuIdle") is True and resources.get("startupCpuBoost", False) is False, "SERVICE_CAPACITY_OR_IDENTITY_DRIFT")
    probe = container.get("startupProbe", {})
    http = probe.get("httpGet", {})
    require(http.get("path") == "/health" and http.get("port") == 8080 and not http.get("httpHeaders") and not probe.get("tcpSocket") and not probe.get("grpc") and probe.get("initialDelaySeconds", 0) == 0 and probe.get("timeoutSeconds") == 2 and probe.get("periodSeconds") == 5 and probe.get("failureThreshold") == 24, "SERVICE_HEALTH_PROBE_DRIFT")
    env = container.get("env", [])
    require(len(env) == 1 and exact(env[0], ["name", "value"]) and env[0]["name"] == "WVD_SERVICE_CONFIG_JSON" and isinstance(env[0]["value"], str) and len(env[0]["value"].encode("utf-8")) <= 16384, "SERVICE_CONFIGURATION_DRIFT")
    config = json.loads(env[0]["value"])
    require(provider_origin(service.get("uri")) == receipt["url"], "SERVICE_ORIGIN_MISMATCH")
    validate_configuration(config, receipt["url"])
    require(config_hash(config) == receipt["configSha256"] == annotations.get(ANNOTATION), "SERVICE_CONFIGURATION_HASH_MISMATCH")
    require(isinstance(service.get("etag"), str) and 0 < len(service["etag"]) <= 256 and not service.get("reconciling") and service.get("terminalCondition", {}).get("state") == "CONDITION_SUCCEEDED", "SERVICE_NOT_READY")
    traffic = service.get("traffic", [])
    require(not traffic or len(traffic) == 1 and traffic[0].get("type") == "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST" and traffic[0].get("percent") == 100 and not traffic[0].get("tag") and not traffic[0].get("revision"), "SERVICE_TRAFFIC_DRIFT")
    return config


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, _req, _fp, _code, _msg, _headers, _newurl):
        return None


class GoogleClient:
    """Fixed target requests. Response bodies and bearer credentials never log."""
    def __init__(self, token):
        require(isinstance(token, str) and 0 < len(token) <= 16384 and not re.search(r"\s", token), "ADMIN_CREDENTIAL_REQUIRED")
        self.token = token
        self.opener = urllib.request.build_opener(NoRedirect())

    @staticmethod
    def permitted(url, method):
        reads = {RUN_URL, PROJECT_URL, DATABASE_URL, AUTH_GET, GOOGLE_PROVIDER_URL, FIELD_GET}
        if method == "GET" and url in reads:
            return True
        if method == "PATCH" and url in {AUTH_PATCH, FIELD_PATCH, RUN_PATCH}:
            return True
        return method == "GET" and url.startswith("https://run.googleapis.com/v2/") and RUN_OPERATION.fullmatch(url[len("https://run.googleapis.com/v2/"):]) is not None

    def call(self, url, method="GET", body=None, allow_missing=False):
        require(self.permitted(url, method), "FOREIGN_TARGET_OR_OPERATION")
        require(not allow_missing or url == FIELD_GET and method == "GET", "INVALID_MISSING_RESOURCE_POLICY")
        # Raw REST calls with a gcloud user token need this explicit consumer
        # project; the token alone can otherwise select the CLI shared project.
        headers = {"Authorization": "Bearer " + self.token, "Content-Type": "application/json", "X-Goog-User-Project": PROJECT}
        data = None if body is None else canonical(body).encode("utf-8")
        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with self.opener.open(request, timeout=15) as response:
                raw = response.read(65537)
            require(len(raw) <= 65536, "PROVIDER_RESPONSE_TOO_LARGE")
            result = json.loads(raw)
            require(isinstance(result, dict), "PROVIDER_RESPONSE_INVALID")
            return result
        except urllib.error.HTTPError as error:
            if error.code == 404 and allow_missing:
                return None
            raise RuntimeError("GOOGLE_HTTP_" + str(error.code)) from None
        except RuntimeError:
            raise
        except Exception:
            raise RuntimeError("GOOGLE_READ_FAILED" if method == "GET" else "GOOGLE_WRITE_OUTCOME_UNKNOWN") from None

    def public_json(self, origin, path, headers=None):
        provider_origin(origin)
        require(path in {"/health", "/api/portal/workspace-access", "/api/admin/enquiries", "/auth-config.json"}, "FOREIGN_HTTP_PROBE")
        request = urllib.request.Request(origin + path, headers=headers or {}, method="GET")
        try:
            with self.opener.open(request, timeout=15) as response:
                status, raw = response.status, response.read(16385)
        except urllib.error.HTTPError as error:
            status, raw = error.code, error.read(16385)
        except Exception:
            raise RuntimeError("PUBLIC_HTTP_READ_FAILED") from None
        require(len(raw) <= 16384, "PUBLIC_HTTP_RESPONSE_TOO_LARGE")
        try:
            body = json.loads(raw)
        except Exception:
            body = None
        return status, body


def selected_firebase_resource(name, suffix):
    return name in {"projects/" + PROJECT + "/" + suffix, "projects/" + PROJECT_NUMBER + "/" + suffix}


def authorized_domains(config):
    require(isinstance(config, dict) and selected_firebase_resource(config.get("name"), "config"), "FIREBASE_CONFIG_TARGET_MISMATCH")
    domains = config.get("authorizedDomains", [])
    require(isinstance(domains, list) and len(domains) <= 1000 and len(set(domains)) == len(domains) and all(isinstance(domain, str) and re.fullmatch(r"[A-Za-z0-9.-]{1,253}", domain) for domain in domains), "INVALID_AUTHORIZED_DOMAINS")
    return domains


def ttl_state(field):
    if field is None:
        return "ABSENT"
    require(field.get("name") == FIELD, "TTL_FIELD_TARGET_MISMATCH")
    ttl = field.get("ttlConfig")
    if ttl is None:
        return "ABSENT"
    require(isinstance(ttl, dict) and re.fullmatch(r"0(?:\.0{1,9})?s", ttl.get("expirationOffset", "0s")), "TTL_EXPIRATION_OFFSET_CONFLICT")
    state = ttl.get("state")
    require(state in {"CREATING", "ACTIVE"}, "TTL_POLICY_REQUIRES_REPAIR_OR_REVIEW")
    return state


def run_setup(receipt, client, wait=time.sleep, emit=lambda _value: None):
    validate_receipt(receipt)
    project = client.call(PROJECT_URL)
    require(project.get("name") == "projects/" + PROJECT_NUMBER and project.get("projectId") == PROJECT and project.get("state") == "ACTIVE", "GOOGLE_PROJECT_MISMATCH")
    database = client.call(DATABASE_URL)
    require(database.get("name") == "projects/wvd-development/databases/(default)" and database.get("type") == "FIRESTORE_NATIVE" and database.get("locationId") == "eur3", "FIRESTORE_DATABASE_MISMATCH")
    service = client.call(RUN_URL)
    config = inspect_service(service, receipt)
    provider = client.call(GOOGLE_PROVIDER_URL)
    require(selected_firebase_resource(provider.get("name"), "defaultSupportedIdpConfigs/google.com") and provider.get("enabled") is True, "GOOGLE_SIGN_IN_PROVIDER_REQUIRED")
    domains = authorized_domains(client.call(AUTH_GET))
    previous_ttl = ttl_state(client.call(FIELD_GET, allow_missing=True))
    if not service.get("invokerIamDisabled", False):
        require(client.public_json(receipt["url"], "/health")[0] in {401, 403}, "PREPARED_PRIVATE_ADMISSION_REQUIRED")

    hostname = urllib.parse.urlsplit(receipt["url"]).hostname
    domain_changed = hostname not in domains
    if domain_changed:
        # Config has no etag/atomic append API. Take a fresh list immediately
        # before the narrow mask, retain its order, and verify every entry.
        fresh_config = client.call(AUTH_GET)
        domains = authorized_domains(fresh_config)
        if hostname not in domains:
            updated = client.call(AUTH_PATCH, "PATCH", {"name": fresh_config["name"], "authorizedDomains": domains + [hostname]})
            observed = authorized_domains(updated)
            require(hostname in observed and all(domain in observed for domain in domains), "AUTHORIZED_DOMAIN_UPDATE_MISMATCH")
    observed = authorized_domains(client.call(AUTH_GET))
    require(hostname in observed and all(domain in observed for domain in domains), "AUTHORIZED_DOMAIN_UPDATE_MISMATCH")
    emit({"step": "firebase-authorized-domain", "status": "ADDED" if domain_changed else "ALREADY_PRESENT", "domain": hostname})

    ttl_operation = None
    if previous_ttl == "ABSENT":
        # Empty ttlConfig enables expiry at the already-calculated deleteAt;
        # the 90-day retention must not be applied again as an offset.
        operation = client.call(FIELD_PATCH, "PATCH", {"name": FIELD, "ttlConfig": {}})
        require(isinstance(operation.get("name"), str) and TTL_OPERATION.fullmatch(operation["name"]), "TTL_WRITE_OUTCOME_UNKNOWN")
        require(not operation.get("error"), "TTL_ENABLEMENT_FAILED")
        ttl_operation = operation["name"]
    current_ttl = ttl_state(client.call(FIELD_GET, allow_missing=True))
    require(current_ttl in {"ACTIVE", "CREATING"} or ttl_operation is not None, "TTL_ENABLEMENT_NOT_ACCEPTED")
    ttl_report = {"state": "ENABLEMENT_PENDING" if current_ttl == "ABSENT" else current_ttl}
    if ttl_operation:
        ttl_report["operation"] = ttl_operation
    emit({"step": "enquiry-retention", **ttl_report})

    # Public transport is the final change, with a fresh exact release and etag.
    service = client.call(RUN_URL)
    inspect_service(service, receipt)
    if not service.get("invokerIamDisabled", False):
        operation = client.call(RUN_PATCH, "PATCH", {"name": SERVICE, "etag": service["etag"], "invokerIamDisabled": True})
        require(isinstance(operation.get("name"), str) and RUN_OPERATION.fullmatch(operation["name"]), "PUBLIC_ADMISSION_WRITE_OUTCOME_UNKNOWN")
        result = operation
        for _ in range(72):
            if result.get("done"):
                break
            wait(5)
            result = client.call("https://run.googleapis.com/v2/" + operation["name"])
        require(result.get("done"), "PUBLIC_ADMISSION_PENDING_CHECK_SERVICE")
        require(not result.get("error"), "PUBLIC_ADMISSION_FAILED")
    current = client.call(RUN_URL)
    inspect_service(current, receipt)
    require(current.get("invokerIamDisabled") is True, "PUBLIC_ADMISSION_NOT_ENABLED")
    status, health = client.public_json(receipt["url"], "/health")
    require(status == 200 and health == {"status": "ok", "mode": "live-portal", "providerAccessChecked": False}, "PUBLIC_HEALTH_MISMATCH")
    status, auth = client.public_json(receipt["url"], "/auth-config.json")
    require(status == 200 and auth == {"mode": "firebase-live", "firebase": config["portal"]["web"], "ownerConfigured": False, "enquiriesEnabled": True}, "PUBLIC_AUTH_CONFIGURATION_MISMATCH")
    for path in ["/api/portal/workspace-access", "/api/admin/enquiries"]:
        status, denial = client.public_json(receipt["url"], path, {"Authorization": "Bearer wvd-synthetic-invalid-firebase-token", "Origin": receipt["url"]})
        require(status == 401 and denial == {"error": "UNAUTHENTICATED"}, "PRIVATE_OWNER_API_DENIAL_REQUIRED")
    return {"status": "SERVICE_ACCESS_CONFIGURED", "release": receipt, "firebaseAuthorizedDomain": hostname, "ttl": ttl_report, "publicTransport": True, "ownerConfigured": False, "messagesSent": False, "permanentRolesGranted": False, "billingChanged": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("release_receipt", help="Exact CI-verified wvd-service-release.json")
    args = parser.parse_args()
    try:
        with open(args.release_receipt, "rb") as handle:
            raw = handle.read(4097)
        require(len(raw) <= 4096, "RELEASE_RECEIPT_TOO_LARGE")
        receipt = validate_receipt(json.loads(raw))
        # Capture output internally; never put a token in command arguments,
        # files, logs, receipt JSON, or a shell trace.
        auth = subprocess.run(["gcloud", "auth", "print-access-token"], check=True, capture_output=True, timeout=30, text=True)
        client = GoogleClient(auth.stdout.strip())
        result = run_setup(receipt, client, emit=lambda value: print(json.dumps(value), flush=True))
        print(json.dumps(result), flush=True)
    except Exception as error:
        code = str(error)
        print(json.dumps({"status": "FAILED", "error": code if re.fullmatch(r"[A-Z0-9_]+", code) else "SERVICE_ACCESS_SETUP_FAILED"}), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
