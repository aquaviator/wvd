"""Synthetic administrator-helper tests; invoked with a Node-built fixture."""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest

if len(sys.argv) != 2:
    raise SystemExit("SYNTHETIC_FIXTURE_PATH_REQUIRED")
with open(sys.argv.pop(), encoding="utf-8") as handle:
    FIXTURE = json.load(handle)
spec = importlib.util.spec_from_file_location("wvd_service_access", Path(__file__).resolve().parents[2] / "portal-runtime" / "enable-service-access.py")
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class FakeGoogle:
    def __init__(self, alias="6616382131"):
        self.service = copy.deepcopy(FIXTURE["service"])
        self.auth = {"name": "projects/" + alias + "/config", "authorizedDomains": ["localhost", "wvd-development.firebaseapp.com", "legacy.example.com"]}
        self.provider = {"name": "projects/" + alias + "/defaultSupportedIdpConfigs/google.com", "enabled": True}
        self.field = None
        self.calls = []
        self.public_calls = []
        self.auth_reads = 0
        self.fresh_auth = None
        self.fail_write = None
        self.ttl_operation = "projects/wvd-development/databases/(default)/operations/ttl-one"
        self.denial_status = 401

    @property
    def writes(self):
        return [row for row in self.calls if row[1] != "GET"]

    def call(self, url, method="GET", body=None, allow_missing=False):
        assert setup.GoogleClient.permitted(url, method), (url, method)
        assert not allow_missing or url == setup.FIELD_GET and method == "GET"
        self.calls.append((url, method, copy.deepcopy(body)))
        if method != "GET" and self.fail_write == url:
            raise RuntimeError("GOOGLE_WRITE_OUTCOME_UNKNOWN")
        if url == setup.PROJECT_URL:
            return {"name": "projects/6616382131", "projectId": "wvd-development", "state": "ACTIVE"}
        if url == setup.DATABASE_URL:
            return {"name": "projects/wvd-development/databases/(default)", "type": "FIRESTORE_NATIVE", "locationId": "eur3"}
        if url == setup.RUN_URL:
            return copy.deepcopy(self.service)
        if url == setup.GOOGLE_PROVIDER_URL:
            return copy.deepcopy(self.provider)
        if url == setup.AUTH_GET:
            self.auth_reads += 1
            if self.auth_reads == 2 and self.fresh_auth is not None:
                self.auth = copy.deepcopy(self.fresh_auth)
            return copy.deepcopy(self.auth)
        if url == setup.AUTH_PATCH:
            assert set(body) == {"name", "authorizedDomains"}
            assert body["name"] == self.auth["name"]
            self.auth = copy.deepcopy(body)
            return copy.deepcopy(self.auth)
        if url == setup.FIELD_GET:
            return copy.deepcopy(self.field)
        if url == setup.FIELD_PATCH:
            assert body == {"name": setup.FIELD, "ttlConfig": {}}
            self.field = {"name": setup.FIELD, "ttlConfig": {"state": "CREATING"}}
            return {"name": self.ttl_operation, "done": False}
        if url == setup.RUN_PATCH:
            assert body == {"name": setup.SERVICE, "etag": self.service["etag"], "invokerIamDisabled": True}
            self.service["invokerIamDisabled"] = True
            self.service["etag"] = "public-etag"
            return {"name": "projects/wvd-development/locations/europe-west2/operations/public-one", "done": True}
        raise AssertionError("UNEXPECTED_REQUEST: " + url)

    def public_json(self, origin, path, headers=None):
        assert origin == FIXTURE["receipt"]["url"]
        self.public_calls.append((path, copy.deepcopy(headers)))
        if path == "/health":
            if not self.service["invokerIamDisabled"]:
                return 403, None
            return 200, {"status": "ok", "mode": "live-portal", "providerAccessChecked": False}
        if path == "/auth-config.json":
            config = json.loads(self.service["template"]["containers"][0]["env"][0]["value"])
            return 200, {"mode": "firebase-live", "firebase": config["portal"]["web"], "ownerConfigured": False, "enquiriesEnabled": True}
        assert path in {"/api/portal/workspace-access", "/api/admin/enquiries"}
        assert headers == {"Authorization": "Bearer wvd-synthetic-invalid-firebase-token", "Origin": origin}
        return self.denial_status, {"error": "UNAUTHENTICATED"}


class ServiceAccessTests(unittest.TestCase):
    def run_setup(self, client):
        return setup.run_setup(copy.deepcopy(FIXTURE["receipt"]), client, wait=lambda _seconds: None)

    def test_initial_setup_changes_only_scoped_domain_ttl_and_public_transport(self):
        client = FakeGoogle()
        result = self.run_setup(client)
        self.assertEqual([row[0] for row in client.writes], [setup.AUTH_PATCH, setup.FIELD_PATCH, setup.RUN_PATCH])
        self.assertEqual(result["status"], "SERVICE_ACCESS_CONFIGURED")
        self.assertEqual(result["ttl"]["state"], "CREATING")
        self.assertTrue(result["publicTransport"])
        for field in ["ownerConfigured", "messagesSent", "permanentRolesGranted", "billingChanged"]:
            self.assertIs(result[field], False)
        self.assertEqual(client.writes[0][2]["name"], "projects/6616382131/config")
        self.assertEqual(client.auth["authorizedDomains"], ["localhost", "wvd-development.firebaseapp.com", "legacy.example.com", result["firebaseAuthorizedDomain"]])
        self.assertEqual([row[0] for row in client.public_calls], ["/health", "/health", "/auth-config.json", "/api/portal/workspace-access", "/api/admin/enquiries"])

    def test_both_exact_project_aliases_are_accepted_and_returned_name_is_retained(self):
        for alias in ["wvd-development", "6616382131"]:
            with self.subTest(alias=alias):
                client = FakeGoogle(alias)
                self.run_setup(client)
                self.assertEqual(client.writes[0][2]["name"], "projects/" + alias + "/config")

    def test_fresh_domain_list_and_its_resource_name_are_preserved(self):
        client = FakeGoogle("wvd-development")
        client.fresh_auth = {"name": "projects/6616382131/config", "authorizedDomains": client.auth["authorizedDomains"] + ["added-during-preflight.example.com"]}
        result = self.run_setup(client)
        self.assertEqual(client.writes[0][2]["name"], "projects/6616382131/config")
        self.assertEqual(client.auth["authorizedDomains"], client.fresh_auth["authorizedDomains"] + [result["firebaseAuthorizedDomain"]])

    def test_noop_retry_verifies_existing_configuration_without_writes(self):
        client = FakeGoogle()
        first = self.run_setup(client)
        client.field["ttlConfig"]["state"] = "ACTIVE"
        client.calls.clear()
        second = self.run_setup(client)
        self.assertEqual(client.writes, [])
        self.assertEqual(second["ttl"], {"state": "ACTIVE"})
        self.assertEqual(first["release"], second["release"])

    def test_foreign_firebase_config_or_provider_stops_before_any_write(self):
        for alias in ["foreign-project", "66163821310", "wvd-development/other"]:
            for which in ["auth", "provider"]:
                with self.subTest(alias=alias, which=which):
                    client = FakeGoogle()
                    getattr(client, which)["name"] = "projects/" + alias + ("/config" if which == "auth" else "/defaultSupportedIdpConfigs/google.com")
                    with self.assertRaisesRegex(RuntimeError, "FIREBASE_CONFIG_TARGET_MISMATCH|GOOGLE_SIGN_IN_PROVIDER_REQUIRED"):
                        self.run_setup(client)
                    self.assertEqual(client.writes, [])

    def test_manual_image_change_or_missing_annotation_is_rejected(self):
        for change in ["image", "annotation", "missing"]:
            with self.subTest(change=change):
                client = FakeGoogle()
                receipt = copy.deepcopy(FIXTURE["receipt"])
                if change == "image":
                    image = setup.IMAGE_PREFIX + "d" * 64
                    client.service["template"]["containers"][0]["image"] = image
                    receipt["image"] = image
                elif change == "annotation":
                    client.service["annotations"][setup.IMAGE_ANNOTATION] = "d" * 64
                else:
                    del client.service["annotations"][setup.IMAGE_ANNOTATION]
                with self.assertRaisesRegex(RuntimeError, "SERVICE_IMAGE_HASH_MISMATCH"):
                    setup.run_setup(receipt, client)
                self.assertEqual(client.writes, [])

    def test_service_capacity_identity_or_owner_drift_stops_before_any_write(self):
        for change in ["capacity", "identity", "owner", "source", "traffic"]:
            with self.subTest(change=change):
                client = FakeGoogle()
                if change == "capacity":
                    client.service["scaling"]["maxInstanceCount"] = 2
                elif change == "identity":
                    client.service["template"]["serviceAccount"] = "foreign@example.com"
                elif change == "source":
                    client.service["labels"]["source-revision"] = "f" * 40
                elif change == "traffic":
                    client.service["traffic"] = [{"type": "TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION", "percent": 100, "revision": "foreign"}]
                else:
                    config = json.loads(client.service["template"]["containers"][0]["env"][0]["value"])
                    config["portal"]["owner"] = {"uid": "invented-owner", "email": "admin@wearvalleydigital.com"}
                    client.service["template"]["containers"][0]["env"][0]["value"] = setup.canonical(config)
                with self.assertRaises(RuntimeError):
                    self.run_setup(client)
                self.assertEqual(client.writes, [])

    def test_only_the_dedicated_enquiry_ttl_field_is_allowed(self):
        self.assertEqual(setup.FIELD, FIXTURE["ttlField"])
        self.assertEqual(setup.FIELD, "projects/wvd-development/databases/(default)/collectionGroups/wvd_service_enquiries_v1/fields/deleteAt")
        self.assertTrue(setup.GoogleClient.permitted(setup.FIELD_GET, "GET"))
        self.assertTrue(setup.GoogleClient.permitted(setup.FIELD_PATCH, "PATCH"))
        for collection in ["enquiries", "salon_service_enquiries_v1", "wvd_service_enquiries_v1_nested"]:
            self.assertFalse(setup.GoogleClient.permitted(setup.FIELD_PATCH.replace("wvd_service_enquiries_v1", collection), "PATCH"))
        self.assertFalse(setup.GoogleClient.permitted(setup.RUN_URL + ":setIamPolicy", "POST"))
        self.assertFalse(setup.GoogleClient.permitted(setup.RUN_PATCH.replace("wvd-service", "wvd-booking-development"), "PATCH"))
        self.assertFalse(setup.GoogleClient.permitted(setup.AUTH_URL + "?updateMask=signIn", "PATCH"))

    def test_conflicting_ttl_policy_stops_before_any_write(self):
        for field in [
            {"name": setup.FIELD.replace("wvd_service_enquiries_v1", "enquiries"), "ttlConfig": {"state": "ACTIVE"}},
            {"name": setup.FIELD, "ttlConfig": {"state": "ACTIVE", "expirationOffset": "7776000s"}},
            {"name": setup.FIELD, "ttlConfig": {"state": "NEEDS_REPAIR"}},
        ]:
            with self.subTest(field=field):
                client = FakeGoogle()
                client.field = field
                with self.assertRaises(RuntimeError):
                    self.run_setup(client)
                self.assertEqual(client.writes, [])

    def test_unknown_write_outcome_is_not_retried_and_transport_remains_closed(self):
        client = FakeGoogle()
        client.fail_write = setup.AUTH_PATCH
        with self.assertRaisesRegex(RuntimeError, "GOOGLE_WRITE_OUTCOME_UNKNOWN"):
            self.run_setup(client)
        self.assertEqual([row[0] for row in client.writes], [setup.AUTH_PATCH])
        self.assertFalse(client.service["invokerIamDisabled"])

    def test_foreign_ttl_operation_does_not_open_public_transport(self):
        client = FakeGoogle()
        client.ttl_operation = "projects/foreign-project/databases/(default)/operations/foreign"
        with self.assertRaisesRegex(RuntimeError, "TTL_WRITE_OUTCOME_UNKNOWN"):
            self.run_setup(client)
        self.assertNotIn(setup.RUN_PATCH, [row[0] for row in client.writes])

    def test_public_private_api_denial_is_required_to_report_success(self):
        client = FakeGoogle()
        client.denial_status = 200
        with self.assertRaisesRegex(RuntimeError, "PRIVATE_OWNER_API_DENIAL_REQUIRED"):
            self.run_setup(client)
        self.assertEqual([row[0] for row in client.writes].count(setup.RUN_PATCH), 1)


if __name__ == "__main__":
    unittest.main()
