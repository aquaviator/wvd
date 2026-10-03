"""Scoped IAM bootstrap. Requires an existing authenticated gcloud installation.
Default: inspect and print plan. --apply: create missing resources after checks.
Never attaches billing, creates keys, grants Workspace access or overwrites drift.
"""
import json
import pathlib
import subprocess
import sys

BINDING = pathlib.Path(__file__).with_name('binding.json')

def main():
    if sys.argv[1:] not in ([], ['--apply']):
        raise RuntimeError('USAGE: python bootstrap.py [--apply]')
    apply = sys.argv[1:] == ['--apply']
    b = json.loads(BINDING.read_text())
    project = b['projectId']
    if (project, b['projectNumber'], b['serviceAccount'], b['repositoryId'], b['ownerId'], b['branch'], b['poolId'], b['providerId']) != ('wvd-development', '6616382131', 'wvd-portal-development@wvd-development.iam.gserviceaccount.com', '1347788556', '78605956', 'development/shared-factory-bootstrap', 'wvd-github-development', 'wvd-development-workflow'):
        raise RuntimeError('BINDING_NOT_VERIFIED')
    def read(*args):
        r = subprocess.run(['gcloud', *args, '--format=json', '--quiet'], capture_output=True, text=True, timeout=60)
        if r.returncode:
            raise RuntimeError('GOOGLE_ADMIN_READ_FAILED')
        return json.loads(r.stdout)
    def write(*args):
        # Print only fixed configuration, never credential material or stderr.
        print(json.dumps({'plannedCommand': ['gcloud', *args, '--quiet']}))
        if apply:
            r = subprocess.run(['gcloud', *args, '--quiet'], capture_output=True, timeout=60)
            if r.returncode:
                raise RuntimeError('GOOGLE_ADMIN_WRITE_FAILED')
    p = read('projects', 'describe', project)
    if p.get('projectId') != project or str(p.get('projectNumber')) != b['projectNumber'] or p.get('lifecycleState') != 'ACTIVE':
        raise RuntimeError('PROJECT_NOT_VERIFIED')
    billing = read('billing', 'projects', 'describe', project)
    if billing.get('projectId') != project or billing.get('billingEnabled') is not True:
        raise RuntimeError('BILLING_PREREQUISITE_UNMET_NO_UPGRADE_AUTHORISED')
    required = {'iam.googleapis.com', 'iamcredentials.googleapis.com', 'sts.googleapis.com', 'drive.googleapis.com', 'calendar-json.googleapis.com'}
    services = read('services', 'list', '--enabled', '--project='+project)
    enabled = {s['config']['name'] for s in services}
    if required - enabled:
        write('services', 'enable', *sorted(required-enabled), '--project='+project)
    accounts = read('iam', 'service-accounts', 'list', '--project='+project)
    account = next((s for s in accounts if s.get('email') == b['serviceAccount']), None)
    if account and account.get('disabled'):
        raise RuntimeError('EXISTING_SERVICE_ACCOUNT_DISABLED')
    if not account:
        write('iam', 'service-accounts', 'create', 'wvd-portal-development', '--project='+project, '--display-name=WVD development workflow')
    pools = read('iam', 'workload-identity-pools', 'list', '--project='+project, '--location=global')
    pool_name = f"projects/{b['projectNumber']}/locations/global/workloadIdentityPools/{b['poolId']}"
    pool = next((p for p in pools if p.get('name') == pool_name), None)
    if pool and (pool.get('disabled') or pool.get('state') != 'ACTIVE'):
        raise RuntimeError('EXISTING_POOL_NOT_ACTIVE')
    if not pool:
        write('iam', 'workload-identity-pools', 'create', b['poolId'], '--project='+project, '--location=global', '--display-name=WVD GitHub development')
    mapping = {'google.subject': 'assertion.sub', 'attribute.repository_id': 'assertion.repository_id'}
    ref = 'refs/heads/'+b['branch']
    workflow_ref = b['repository']+'/'+b['workflow']+'@'+ref
    condition = f"assertion.repository_id=='{b['repositoryId']}' && assertion.repository_owner_id=='{b['ownerId']}' && assertion.ref=='{ref}' && assertion.workflow_ref=='{workflow_ref}' && (assertion.event_name=='push' || assertion.event_name=='workflow_dispatch')"
    providers = read('iam', 'workload-identity-pools', 'providers', 'list', '--project='+project, '--location=global', '--workload-identity-pool='+b['poolId']) if pool or apply else []
    provider = next((p for p in providers if p.get('name') == pool_name+'/providers/'+b['providerId']), None)
    if provider:
        if provider.get('disabled') or provider.get('state') != 'ACTIVE' or provider.get('attributeMapping') != mapping or provider.get('attributeCondition') != condition or provider.get('oidc') != {'issuerUri':'https://token.actions.githubusercontent.com'}:
            raise RuntimeError('EXISTING_PROVIDER_DRIFT_REVIEW_REQUIRED')
    else:
        write('iam', 'workload-identity-pools', 'providers', 'create-oidc', b['providerId'], '--project='+project, '--location=global', '--workload-identity-pool='+b['poolId'], '--issuer-uri=https://token.actions.githubusercontent.com', '--attribute-mapping='+','.join(k+'='+v for k,v in mapping.items()), '--attribute-condition='+condition)
    # Impersonation only. No project editor/owner/deployment/storage/Auth grants.
    member=f"principalSet://iam.googleapis.com/{pool_name}/attribute.repository_id/{b['repositoryId']}"
    write('iam', 'service-accounts', 'add-iam-policy-binding', b['serviceAccount'], '--project='+project, '--role=roles/iam.workloadIdentityUser', '--member='+member)
    print(json.dumps({'status':'IAM_CONFIGURED_RESOURCE_GRANTS_REQUIRED' if apply else 'PLAN_ONLY', 'changesMade':apply}))

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        # gcloud credential-bearing output is never propagated.
        print(str(e) if isinstance(e, RuntimeError) else 'BOOTSTRAP_FAILED', file=sys.stderr)
        sys.exit(1)
