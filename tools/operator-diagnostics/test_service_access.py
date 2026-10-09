"""Synthetic stdlib checks for the standalone read-only diagnostic."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import urllib.error

spec = importlib.util.spec_from_file_location("wvd_service_diagnostic", Path(__file__).with_name("service-access.py"))
diagnostic = importlib.util.module_from_spec(spec)
spec.loader.exec_module(diagnostic)
TOKEN = "synthetic-token-that-must-never-be-printed"
PRIVATE = "PRIVATE PROVIDER MESSAGE AND CONFIGURATION"


def success(check):
    if check in diagnostic.PERMISSIONS:
        return {"permissions": list(diagnostic.PERMISSIONS[check][1])}
    return {
        "project": {"name": "projects/6616382131", "projectId": "wvd-development", "state": "ACTIVE"},
        "database": {"name": "projects/wvd-development/databases/(default)", "type": "FIRESTORE_NATIVE", "locationId": "eur3"},
        "service": {"name": diagnostic.SERVICE, "uri": "https://" + diagnostic.HOST, "invokerIamDisabled": False, "template": {"env": PRIVATE}},
        "google-provider": {"name": "projects/6616382131/defaultSupportedIdpConfigs/google.com", "enabled": True, "clientSecret": PRIVATE},
        "authorized-domains": {"name": "projects/6616382131/config", "authorizedDomains": ["localhost", diagnostic.HOST], "hashConfig": PRIVATE},
        "enquiry-ttl": {"name": diagnostic.FIELD, "ttlConfig": {"state": "CREATING"}},
    }[check]


def error_body():
    return {"error": {"code": 403, "status": "PERMISSION_DENIED", "message": PRIVATE + TOKEN, "details": [
        {"@type": "type.googleapis.com/google.rpc.ErrorInfo", "reason": "SERVICE_DISABLED", "domain": "googleapis.com", "metadata": {"service": "identitytoolkit.googleapis.com", "consumer": "projects/32555940559", "permission": "firebaseauth.configs.get", "token": TOKEN, "other": PRIVATE}},
        {"@type": "type.googleapis.com/google.rpc.DebugInfo", "detail": PRIVATE, "stackEntries": [TOKEN]},
    ]}}


class Response:
    def __init__(self, body, status=200, raw=False):
        self.code = status
        self.payload = body if raw else json.dumps(body).encode("utf-8")
        self.read_sizes = []
        self.closed = False

    def read(self, size=-1):
        self.read_sizes.append(size)
        return self.payload if size < 0 else self.payload[:size]

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        self.closed = True


class Opener:
    def __init__(self, responder):
        self.responder = responder
        self.requests = []

    def open(self, request, timeout):
        self.requests.append((request, timeout))
        response = self.responder(request) if callable(self.responder) else self.responder
        if isinstance(response, BaseException):
            raise response
        return response


class ServiceAccessDiagnosticTests(unittest.TestCase):
    def test_read_targets_are_exact_and_do_not_accept_mutation_or_foreign_targets(self):
        expected = {
            "project": "https://cloudresourcemanager.googleapis.com/v3/projects/wvd-development",
            "database": "https://firestore.googleapis.com/v1/projects/wvd-development/databases/(default)",
            "service": "https://run.googleapis.com/v2/projects/wvd-development/locations/europe-west2/services/wvd-service",
            "google-provider": "https://identitytoolkit.googleapis.com/admin/v2/projects/wvd-development/defaultSupportedIdpConfigs/google.com?fields=name,enabled",
            "authorized-domains": "https://identitytoolkit.googleapis.com/admin/v2/projects/wvd-development/config?fields=name,authorizedDomains",
            "enquiry-ttl": "https://firestore.googleapis.com/v1/projects/wvd-development/databases/(default)/collectionGroups/wvd_service_enquiries_v1/fields/deleteAt?fields=name,ttlConfig",
        }
        self.assertEqual(diagnostic.READS, expected)
        for check, url in expected.items():
            with self.subTest(check=check):
                response = Response(success(check))
                opener = Opener(response)
                output = diagnostic.GoogleClient(TOKEN, opener).call(check)
                request, timeout = opener.requests[0]
                self.assertEqual(request.full_url, url)
                self.assertEqual(request.get_method(), "GET")
                self.assertIsNone(request.data)
                self.assertEqual(timeout, 12)
                self.assertEqual(request.get_header("Authorization"), "Bearer " + TOKEN)
                self.assertIsNone(request.get_header("X-goog-user-project"))
                self.assertTrue(output["targetMatches"])
                self.assertNotIn(TOKEN, json.dumps(output))
                self.assertNotIn(PRIVATE, json.dumps(output))
                self.assertEqual(response.read_sizes, [diagnostic.MAX_RESPONSE + 1])
                self.assertTrue(response.closed)

    def test_permission_bodies_are_fixed_read_only_queries(self):
        expected = {
            "project-permissions": ("https://cloudresourcemanager.googleapis.com/v3/projects/wvd-development:testIamPermissions", ["resourcemanager.projects.get", "datastore.databases.getMetadata", "firebaseauth.configs.get", "firebaseauth.configs.update", "datastore.indexes.get", "datastore.indexes.update", "serviceusage.services.use"]),
            "service-permissions": ("https://run.googleapis.com/v2/projects/wvd-development/locations/europe-west2/services/wvd-service:testIamPermissions", ["run.services.get", "run.services.update", "run.services.setIamPolicy"]),
        }
        for check, (url, permissions) in expected.items():
            with self.subTest(check=check):
                opener = Opener(Response({"permissions": permissions[:1]}))
                result = diagnostic.GoogleClient(TOKEN, opener).call(check, quota=True)
                request, _ = opener.requests[0]
                self.assertEqual(request.full_url, url)
                self.assertEqual(request.get_method(), "POST")
                self.assertEqual(json.loads(request.data), {"permissions": permissions})
                self.assertEqual(request.get_header("X-goog-user-project"), "wvd-development")
                self.assertEqual(result["permissionResult"], "SCOPED_RESULT")
                self.assertEqual(result["granted"], permissions[:1])
                self.assertEqual(result["notReturned"], permissions[1:])

    def test_unknown_checks_quota_values_and_caller_supplied_bodies_are_denied_before_http(self):
        opener = Opener(Response({}))
        client = diagnostic.GoogleClient(TOKEN, opener)
        for check in ["https://foreign.example", "setIamPolicy", "authorized-domains?updateMask=all", "enquiries", ""]:
            with self.assertRaises(RuntimeError):
                client.call(check)
        for quota in ["foreign-project", 1, None, {}]:
            with self.assertRaises(RuntimeError):
                client.call("project", quota=quota)
        with self.assertRaises(TypeError):
            client.call("project", method="PATCH", body={"anything": "unexpected"})
        self.assertEqual(opener.requests, [])

    def test_default_opener_disables_redirects_and_redirect_response_is_not_followed(self):
        handler = diagnostic.NoRedirect()
        self.assertIsNone(handler.redirect_request(None, None, 302, "Redirect", {}, "https://foreign.example"))
        response = urllib.error.HTTPError(diagnostic.PROJECT_URL, 302, "Redirect", {"Location": "https://foreign.example/" + TOKEN}, io.BytesIO(json.dumps(error_body()).encode()))
        opener = Opener(response)
        with patch.object(diagnostic.urllib.request, "build_opener", return_value=opener) as build:
            result = diagnostic.GoogleClient(TOKEN).call("project")
        self.assertIsInstance(build.call_args.args[0], diagnostic.NoRedirect)
        self.assertEqual(len(opener.requests), 1)
        self.assertEqual(result["httpStatus"], 302)
        self.assertNotIn("foreign.example", json.dumps(result))
        self.assertNotIn(TOKEN, json.dumps(result))

    def test_only_safe_structured_error_fields_survive_redaction(self):
        result = diagnostic.GoogleClient(TOKEN, Opener(Response(error_body(), 403))).call("google-provider")
        self.assertEqual(result["googleStatus"], "PERMISSION_DENIED")
        self.assertEqual(result["errorInfo"], [{"reason": "SERVICE_DISABLED", "domain": "googleapis.com", "service": "identitytoolkit.googleapis.com", "consumer": "projects/32555940559", "permission": "firebaseauth.configs.get"}])
        for forbidden in [TOKEN, PRIVATE, "message", "stackEntries", "clientSecret"]:
            self.assertNotIn(forbidden, json.dumps(result))

    def test_token_is_redacted_even_if_placed_in_normally_allowed_reason_fields(self):
        token = "PRIVATE_TOKEN"
        body = {"error": {"status": token, "details": [{"@type": "type.googleapis.com/google.rpc.ErrorInfo", "reason": token, "metadata": {"permission": token + ".read"}}]}}
        result = diagnostic.GoogleClient(token, Opener(Response(body, 403))).call("project")
        self.assertNotIn(token, json.dumps(result))

    def test_transport_failure_never_exposes_exception_or_token(self):
        opener = Opener(OSError(PRIVATE + TOKEN))
        result = diagnostic.GoogleClient(TOKEN, opener).call("service")
        self.assertEqual(result["error"], "READ_FAILED")
        self.assertNotIn(PRIVATE, json.dumps(result))
        self.assertNotIn(TOKEN, json.dumps(result))

    def test_non_success_permission_responses_remain_inconclusive(self):
        for status in [301, 401, 403, 404, 429, 500, 503]:
            with self.subTest(status=status):
                body = {**success("project-permissions"), **error_body()}
                result = diagnostic.GoogleClient(TOKEN, Opener(Response(body, status))).call("project-permissions")
                self.assertEqual(result["permissionResult"], "INCONCLUSIVE")
                self.assertNotIn("granted", result)
                self.assertNotIn("notReturned", result)

    def test_malformed_success_permission_responses_are_not_reported_as_missing_grants(self):
        invalid = [error_body(), {"permissions": "all"}, {"permissions": [None]}, {"permissions": ["foreign.admin"]}, {"permissions": [], "extra": PRIVATE}]
        for body in invalid:
            with self.subTest(body=body):
                result = diagnostic.GoogleClient(TOKEN, Opener(Response(body))).call("project-permissions")
                self.assertEqual(result["permissionResult"], "INCONCLUSIVE")
                self.assertIn("error", result)
                self.assertNotIn("notReturned", result)

    def test_empty_success_permission_response_is_a_valid_scoped_empty_result(self):
        result = diagnostic.GoogleClient(TOKEN, Opener(Response({}))).call("service-permissions")
        self.assertEqual(result["permissionResult"], "SCOPED_RESULT")
        self.assertEqual(result["granted"], [])
        self.assertEqual(result["notReturned"], list(diagnostic.PERMISSIONS["service-permissions"][1]))

    def test_non_json_wrong_shape_invalid_encoding_and_oversized_responses_are_bounded(self):
        for raw, expected in [(b"not json " + TOKEN.encode(), "NON_JSON_RESPONSE"), (b"\xff", "NON_JSON_RESPONSE"), (b"[]", "INVALID_RESPONSE"), (b" "+b"x"*diagnostic.MAX_RESPONSE, "RESPONSE_TOO_LARGE")]:
            with self.subTest(expected=expected):
                response = Response(raw, raw=True)
                result = diagnostic.GoogleClient(TOKEN, Opener(response)).call("project-permissions")
                self.assertEqual(result["error"], expected)
                self.assertEqual(result["permissionResult"], "INCONCLUSIVE")
                self.assertEqual(response.read_sizes, [diagnostic.MAX_RESPONSE + 1])
                self.assertTrue(response.closed)
                self.assertNotIn(TOKEN, json.dumps(result))

    def make_diagnosis(self, quota_body=None, quota_status=200):
        url_checks = {url: check for check, url in diagnostic.READS.items()}
        url_checks.update({value[0]: check for check, value in diagnostic.PERMISSIONS.items()})
        def respond(request):
            check = url_checks[request.full_url]
            if check == "google-provider":
                if request.get_header("X-goog-user-project") is None:
                    return Response(error_body(), 403)
                return Response(success(check) if quota_body is None else quota_body, quota_status)
            return Response(success(check))
        opener = Opener(respond)
        emitted = []
        result = diagnostic.diagnose(diagnostic.GoogleClient(TOKEN, opener), emitted.append)
        return result, emitted, opener.requests

    def test_quota_recovery_requires_successful_same_target_read_and_no_write(self):
        result, emitted, requests = self.make_diagnosis()
        self.assertEqual(result["quotaHeaderRecovered"], ["google-provider"])
        self.assertEqual(result["stillDenied"], [])
        self.assertEqual(result["incompleteChecks"], [])
        self.assertIs(result["changesMade"], False)
        self.assertEqual(len(requests), 11)
        self.assertEqual([row["quotaHeader"] for row in emitted if row["check"] == "google-provider"], ["none", "wvd-development"])
        self.assertTrue(all(request.get_method() == "GET" or request.full_url.endswith(":testIamPermissions") for request, _ in requests))
        self.assertNotIn(TOKEN, json.dumps([result, emitted]))

    def test_quota_200_with_missing_or_foreign_target_is_not_reported_as_recovery(self):
        for body in [{}, {"name": "projects/foreign/defaultSupportedIdpConfigs/google.com", "enabled": True}]:
            with self.subTest(body=body):
                result, _, _ = self.make_diagnosis(quota_body=body)
                self.assertEqual(result["quotaHeaderRecovered"], [])
                self.assertIn("google-provider", result["incompleteChecks"])

    def test_quota_403_remains_denied_without_another_retry(self):
        result, _, requests = self.make_diagnosis(quota_body=error_body(), quota_status=403)
        self.assertEqual(result["quotaHeaderRecovered"], [])
        self.assertEqual(result["stillDenied"], ["google-provider"])
        self.assertEqual(len(requests), 11)

    def test_successful_default_permission_query_is_not_misreported_as_still_denied(self):
        url_checks = {url: check for check, url in diagnostic.READS.items()}
        url_checks.update({value[0]: check for check, value in diagnostic.PERMISSIONS.items()})
        def respond(request):
            check = url_checks[request.full_url]
            if check == "service-permissions" and request.get_header("X-goog-user-project"):
                return Response(error_body(), 403)
            return Response(success(check))
        emitted = []
        result = diagnostic.diagnose(diagnostic.GoogleClient(TOKEN, Opener(respond)), emitted.append)
        self.assertEqual(result["stillDenied"], [])
        self.assertEqual(result["quotaHeaderDenied"], ["service-permissions"])
        self.assertEqual([row["permissionResult"] for row in emitted if row["check"] == "service-permissions"], ["SCOPED_RESULT", "INCONCLUSIVE"])

    def test_context_reports_overrides_as_booleans_without_paths_or_credentials(self):
        raw = {"core": {"account": "owner@example.test", "project": diagnostic.PROJECT}, "auth": {"impersonate_service_account": "service@wvd-development.iam.gserviceaccount.com", "access_token_file": "/private/" + TOKEN, "credential_file_override": "/private/" + PRIVATE}, "billing": {"quota_project": diagnostic.PROJECT}}
        with patch.object(diagnostic, "gcloud", return_value=json.dumps(raw)) as command, patch.dict(diagnostic.os.environ, {"CLOUDSDK_AUTH_ACCESS_TOKEN": TOKEN}, clear=True):
            result = diagnostic.context()
        self.assertEqual(command.call_args.args[0][:2], ["config", "list"])
        self.assertEqual(result["account"], "owner@example.test")
        for key in ["tokenOverridePresent", "tokenFileOverridePresent", "credentialFileOverridePresent"]:
            self.assertIs(result[key], True)
        self.assertNotIn(TOKEN, json.dumps(result))
        self.assertNotIn(PRIVATE, json.dumps(result))
        self.assertNotIn("/private/", json.dumps(result))

    def test_main_redacts_unexpected_local_errors_and_does_not_accept_arguments(self):
        for argv in [["service-access.py"], ["service-access.py", "--run-setup"]]:
            with self.subTest(argv=argv):
                output = io.StringIO()
                with patch.object(diagnostic.sys, "argv", argv), patch.object(diagnostic, "context", side_effect=OSError(PRIVATE + TOKEN)), contextlib.redirect_stdout(output):
                    status = diagnostic.main()
                self.assertEqual(status, 1)
                self.assertNotIn(TOKEN, output.getvalue())
                self.assertNotIn(PRIVATE, output.getvalue())
                self.assertIs(json.loads(output.getvalue())["changesMade"], False)

    def test_gcloud_uses_separate_arguments_and_never_emits_credential_stdout(self):
        with patch.object(diagnostic.subprocess, "run", return_value=SimpleNamespace(returncode=0, stdout=TOKEN, stderr=PRIVATE)) as command, contextlib.redirect_stdout(io.StringIO()) as output:
            token = diagnostic.gcloud(["auth", "print-access-token"])
        self.assertEqual(token, TOKEN)
        self.assertEqual(command.call_args.args[0], ["gcloud", "auth", "print-access-token", "--quiet"])
        self.assertNotIn("shell", command.call_args.kwargs)
        self.assertEqual(output.getvalue(), "")
        with patch.object(diagnostic.subprocess, "run", return_value=SimpleNamespace(returncode=1, stdout=TOKEN, stderr=PRIVATE)):
            with self.assertRaisesRegex(RuntimeError, "^GCLOUD_COMMAND_FAILED$"):
                diagnostic.gcloud(["auth", "print-access-token"])


if __name__ == "__main__":
    unittest.main()
