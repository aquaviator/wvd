"""Exercise the real Cloud Shell script against a synthetic gcloud executable."""
import json
import os
import pathlib
import subprocess
import tempfile
import unittest

SCRIPT = pathlib.Path(__file__).with_name("enable-booking-delegation.sh")
PROVIDER = {
    "state": "ACTIVE",
    "oidc": {"issuerUri": "https://token.actions.githubusercontent.com"},
    "attributeMapping": {
        "google.subject": "assertion.sub",
        "attribute.repository_id": "assertion.repository_id",
        "attribute.repository_owner_id": "assertion.repository_owner_id",
        "attribute.ref": "assertion.ref",
        "attribute.event_name": "assertion.event_name",
    },
}


class DelegationScriptTests(unittest.TestCase):
    def run_script(self, provider):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder)
            fake = root / "gcloud"
            fake.write_text("""#!/usr/bin/env python3
import json,os,sys
args=sys.argv[1:]
with open(os.environ["WVD_TEST_COMMANDS"],"a") as f:
    f.write(json.dumps(args)+"\\n")
if args[:2]==["projects","describe"]: print("6616382131")
elif args[:3]==["iam","service-accounts","describe"]: print("123456789")
elif "describe" in args: print(os.environ["WVD_TEST_PROVIDER"])
else: print("synthetic-etag")
""")
            fake.chmod(0o700)
            commands = root / "commands.jsonl"
            env = {**os.environ, "PATH": str(root) + os.pathsep + os.environ["PATH"],
                   "WVD_TEST_PROVIDER": json.dumps(provider),
                   "WVD_TEST_COMMANDS": str(commands)}
            result = subprocess.run(["bash", str(SCRIPT)], env=env,
                                    capture_output=True, text=True, timeout=10)
            calls = [json.loads(line) for line in commands.read_text().splitlines()]
            writes = [call for call in calls if "update-oidc" in call or "add-iam-policy-binding" in call]
            return result, writes

    def test_existing_additional_mappings_are_preserved(self):
        result, writes = self.run_script(PROVIDER)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(writes), 2)
        self.assertFalse(any(arg.startswith("--attribute-mapping") for call in writes for arg in call))
        condition = next(arg for arg in writes[0] if arg.startswith("--attribute-condition="))
        self.assertIn("assertion.workflow_ref=='aquaviator/wvd/.github/workflows/google-development-access.yml@", condition)
        self.assertIn("--role=roles/iam.serviceAccountTokenCreator", writes[1])
        self.assertEqual(writes[1][:3], ["iam", "service-accounts", "add-iam-policy-binding"])
        self.assertIn("wvd-development@wvd-development.iam.gserviceaccount.com", writes[1])
        self.assertIn("WORKSPACE_CLIENT_ID=123456789", result.stdout)

    def test_wrong_core_mapping_makes_no_changes(self):
        provider = json.loads(json.dumps(PROVIDER))
        provider["attributeMapping"]["attribute.repository_id"] = "assertion.repository"
        result, writes = self.run_script(provider)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(writes, [])

    def test_wrong_issuer_makes_no_changes(self):
        provider = json.loads(json.dumps(PROVIDER))
        provider["oidc"]["issuerUri"] = "https://example.invalid"
        result, writes = self.run_script(provider)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(writes, [])

    def test_disabled_provider_makes_no_changes(self):
        result, writes = self.run_script({**PROVIDER, "disabled": True})
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(writes, [])


if __name__ == "__main__":
    unittest.main()
