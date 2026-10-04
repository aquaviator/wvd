"""Read-only recovery evidence from an already authenticated gcloud terminal.
No credential exports, API enabling, IAM edits or Workspace content requests.
"""
import json
import base64
import os
import subprocess
import sys

PROJECT = 'wvd-development'
NUMBER = '6616382131'
ACCOUNT = 'wvd-development@wvd-development.iam.gserviceaccount.com'
POOL = 'wvd-github-development'
PROVIDER = 'github'

def inspect(run):
    def read(*args):
        return run([*args, '--format=json', '--quiet'])
    project=read('projects','describe',PROJECT)
    if project.get('projectId') != PROJECT or str(project.get('projectNumber')) != NUMBER or project.get('lifecycleState') != 'ACTIVE':
        raise RuntimeError('PROJECT_NOT_VERIFIED')
    billing=read('billing','projects','describe',PROJECT)
    if billing.get('projectId') != PROJECT or not isinstance(billing.get('billingEnabled'), bool):
        raise RuntimeError('BILLING_NOT_VERIFIED')
    accounts=read('iam','service-accounts','list','--project='+PROJECT)
    services=read('services','list','--enabled','--project='+PROJECT)
    pools=read('iam','workload-identity-pools','list','--project='+PROJECT,'--location=global')
    pool_name=f'projects/{NUMBER}/locations/global/workloadIdentityPools/{POOL}'
    selected_pool=next((p for p in pools if p.get('name') == pool_name),None)
    providers=read('iam','workload-identity-pools','providers','list','--project='+PROJECT,'--location=global','--workload-identity-pool='+POOL) if selected_pool else []
    selected_account=next((a for a in accounts if a.get('email') == ACCOUNT),None)
    selected_provider=next((p for p in providers if p.get('name') == pool_name+'/providers/'+PROVIDER),None)
    account_policy=read('iam','service-accounts','get-iam-policy',ACCOUNT,'--project='+PROJECT) if selected_account else {'bindings':[]}
    project_policy=read('projects','get-iam-policy',PROJECT)
    expected_member=f'principalSet://iam.googleapis.com/{pool_name}/attribute.repository_id/1347788556'
    return {
      'projectId':PROJECT,'projectNumber':NUMBER,'billingEnabled':billing['billingEnabled'],'changesMade':False,
      'intendedServiceAccount':ACCOUNT,'serviceAccountPresent':selected_account is not None,
      'serviceAccountDisabled':selected_account.get('disabled',False) if selected_account else None,
      'otherWvdServiceAccounts':[a['email'] for a in accounts if a.get('email','').startswith('wvd-') and a.get('email') != ACCOUNT],
      'enabledRequiredApis':sorted(s['config']['name'] for s in services if s.get('config',{}).get('name') in {'iam.googleapis.com','iamcredentials.googleapis.com','sts.googleapis.com','drive.googleapis.com','calendar-json.googleapis.com'}),
      'intendedPool':pool_name,'poolState':selected_pool.get('state') if selected_pool else None,'poolDisabled':selected_pool.get('disabled',False) if selected_pool else None,
      'intendedProvider':PROVIDER,'providerPresent':selected_provider is not None,
      'otherProviderIds':[p['name'].rsplit('/',1)[-1] for p in providers if p != selected_provider],
      'provider':{k:selected_provider.get(k) for k in ['state','disabled','attributeMapping','attributeCondition','oidc']} if selected_provider else None,
      'workloadIdentityBindingPresent':any(x.get('role')=='roles/iam.workloadIdentityUser' and expected_member in x.get('members',[]) and not x.get('condition') for x in account_policy.get('bindings',[])),
      'serviceAccountProjectRoles':sorted({x['role'] for x in project_policy.get('bindings',[]) if 'serviceAccount:'+ACCOUNT in x.get('members',[])}),
      'workspacePermissions':'NOT_CHECKED','applicationIntegration':'NOT_VERIFIED'
    }

def gcloud(args, platform=sys.platform, execute=subprocess.run, env=None):
    # Reuses the fixed PowerShell launcher pattern in portal-proof/google-preflight.mjs.
    # SDK arguments travel as JSON, never as interpolated shell commands.
    command=['gcloud',*args]
    options={'capture_output':True,'text':True,'timeout':60}
    if platform == 'win32':
        script="$ErrorActionPreference = 'Stop'; $arguments = ConvertFrom-Json $env:WVD_GCLOUD_ARGUMENTS; $command = Get-Command gcloud -CommandType ExternalScript,Application -ErrorAction Stop; & $command.Source @arguments; if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }"
        command=['powershell.exe','-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',base64.b64encode(script.encode('utf-16le')).decode('ascii')]
        options['env']={**(os.environ if env is None else env),'WVD_GCLOUD_ARGUMENTS':json.dumps(args)}
    try:
        r=execute(command,**options)
    except FileNotFoundError:
        raise RuntimeError('GCLOUD_LAUNCHER_NOT_AVAILABLE') from None
    except subprocess.TimeoutExpired:
        raise RuntimeError('GOOGLE_ADMIN_READ_TIMEOUT') from None
    if r.returncode:raise RuntimeError('GOOGLE_ADMIN_READ_FAILED_CHECK_GCLOUD_LOGIN_AND_PERMISSIONS')
    try:return json.loads(r.stdout)
    except (ValueError,TypeError):raise RuntimeError('GOOGLE_ADMIN_RESPONSE_NOT_JSON') from None

if __name__=='__main__':
    try:
        if len(sys.argv)!=1:raise RuntimeError('NO_ARGUMENTS_EXPECTED')
        print(json.dumps(inspect(gcloud),indent=2))
    except Exception as e:
        print(str(e) if isinstance(e,RuntimeError) else 'DISCOVERY_FAILED',file=sys.stderr)
        sys.exit(1)
