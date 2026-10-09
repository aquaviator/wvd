import unittest
import json
import base64
import subprocess
from types import SimpleNamespace
from discover import gcloud, inspect, PROJECT, NUMBER, ACCOUNT, POOL

class DiscoveryTests(unittest.TestCase):
    def runner(self, existing=False):
        calls=[]
        def run(args):
            calls.append(args)
            head=args[:3]
            if head==['projects','describe',PROJECT]:return {'projectId':PROJECT,'projectNumber':NUMBER,'lifecycleState':'ACTIVE'}
            if head==['billing','projects','describe']:return {'projectId':PROJECT,'billingEnabled':True}
            if head==['iam','service-accounts','list']:return [{'email':ACCOUNT}] if existing else []
            if head==['services','list','--enabled']:return [{'config':{'name':'drive.googleapis.com'}}]
            if head==['iam','workload-identity-pools','list']:return [{'name':f'projects/{NUMBER}/locations/global/workloadIdentityPools/{POOL}','state':'ACTIVE'}] if existing else []
            if head==['iam','workload-identity-pools','providers']:return [{'name':f'projects/{NUMBER}/locations/global/workloadIdentityPools/{POOL}/providers/github','state':'ACTIVE','attributeCondition':'exact-existing-condition'}]
            if head==['iam','service-accounts','get-iam-policy']:return {'bindings':[]}
            if head==['projects','get-iam-policy',PROJECT]:return {'bindings':[{'role':'roles/datastore.user','members':['serviceAccount:'+ACCOUNT]}, {'role':'roles/owner','members':['user:unrelated@example.test']}]}
            self.fail('unexpected command')
        return run,calls
    def test_missing_resources_are_reported_without_creation(self):
        run,calls=self.runner();r=inspect(run)
        self.assertFalse(r['serviceAccountPresent']);self.assertFalse(r['providerPresent']);self.assertFalse(r['changesMade'])
        self.assertFalse(any('providers' in x for x in calls))
    def test_existing_policy_report_is_scoped_and_preserves_condition(self):
        run,calls=self.runner(True);r=inspect(run)
        self.assertEqual(r['provider']['attributeCondition'],'exact-existing-condition')
        self.assertEqual(r['serviceAccountProjectRoles'],['roles/datastore.user'])
        self.assertFalse(r['workloadIdentityBindingPresent'])
        self.assertNotIn('unrelated',str(r))
        self.assertTrue(all(x[1] in ['describe','projects','service-accounts','workload-identity-pools','list','get-iam-policy'] for x in calls))
    def test_wrong_project_and_permission_failure_stop(self):
        with self.assertRaisesRegex(RuntimeError,'PROJECT_NOT_VERIFIED'):inspect(lambda _: {'projectId':'foreign'})
        def denied(_):raise RuntimeError('denied')
        with self.assertRaisesRegex(RuntimeError,'denied'):inspect(denied)

class LauncherTests(unittest.TestCase):
    def test_windows_wrapper_keeps_arguments_separate(self):
        args=['iam','service-accounts','get-iam-policy',ACCOUNT,'--format=json']
        def execute(command, **options):
            self.assertEqual(command[0],'powershell.exe')
            script=base64.b64decode(command[-1]).decode('utf-16le')
            self.assertIn('Get-Command gcloud',script)
            self.assertNotIn(ACCOUNT,script)
            self.assertEqual(json.loads(options['env']['WVD_GCLOUD_ARGUMENTS']),args)
            self.assertNotIn('shell',options)
            return SimpleNamespace(returncode=0,stdout='{"ok":true}')
        self.assertEqual(gcloud(args,platform='win32',execute=execute,env={}),{'ok':True})
    def test_non_windows_uses_direct_sdk(self):
        def execute(command,**options):
            self.assertEqual(command,['gcloud','projects','describe',PROJECT])
            return SimpleNamespace(returncode=0,stdout='{}')
        self.assertEqual(gcloud(['projects','describe',PROJECT],platform='linux',execute=execute),{})
    def test_errors_are_specific_and_never_echo_credentials(self):
        def missing(*args,**kwargs):raise FileNotFoundError('private-data')
        with self.assertRaisesRegex(RuntimeError,'GCLOUD_LAUNCHER_NOT_AVAILABLE'):gcloud([],execute=missing)
        def denied(*args,**kwargs):return SimpleNamespace(returncode=1,stdout='private-data')
        with self.assertRaisesRegex(RuntimeError,'GOOGLE_ADMIN_READ_FAILED_CHECK_GCLOUD_LOGIN_AND_PERMISSIONS'):gcloud([],execute=denied)
        def invalid(*args,**kwargs):return SimpleNamespace(returncode=0,stdout='private-data')
        with self.assertRaisesRegex(RuntimeError,'GOOGLE_ADMIN_RESPONSE_NOT_JSON'):gcloud([],execute=invalid)

if __name__=='__main__':unittest.main()
