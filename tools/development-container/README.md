# Unattended development verification

The development worker owns the loop: push an authorised development change,
inspect CI results and bounded synthetic evidence, correct failures, repeat,
then report the tested source commit. A founder-local pull is optional review,
not a prerequisite for development verification. Production approval is separate.

## Current consumer

The WVD portal Dockerfile reuses the existing portal unit tests and real Firebase
Auth/Firestore emulator browser tests. It pins Node 22.23.3, Java 21 and the
Playwright image matching the root lockfile (1.62.1). Locked npm installs and
Firestore emulator download happen during image build. The test container runs
with `--network none`, so Auth and Firestore remain internal loopback services.
It receives no Google credentials, host SDK profiles, ports or Docker socket.
The only host mount is the evidence output directory. The image is disposable
and is never published to a registry.

GitHub workflow: `.github/workflows/development-container.yml`. It runs on
relevant development pushes and PR changes, cancels superseded runs, has a
20-minute job limit and uses a standard runner in the existing public repository.
The current source commit, Node/Playwright versions, image ID and test results
are recorded. Screenshots and a browser recording show Member approval denial,
Owner approval and disabled-user sign-out using synthetic emulator accounts.
Evidence is capped at 5 MiB and retained for one day in the existing GitHub Actions
artifact mechanism. No paid/larger runner, remote container host, image storage
service or new subscription is provisioned. Existing £0 authority applies; do
not change account billing or enable paid artifact capacity to bypass a quota.

View runs, job summaries and logs:
https://github.com/aquaviator/wvd/actions/workflows/development-container.yml
Open a completed run and download its `portal-container-evidence-<run-id>`
artifact to see PNG screenshots, a WebM recording and `results.json`. Artifact
availability expires after one day; logs and the run result remain available
under the repository's normal retention settings. Synthetic evidence only: never
add live account tokens, customer fixtures or screenshots of private data.

Native Windows checks remain in the existing workflow because a Linux container
cannot validate Windows PowerShell behaviour. Public-site browser/build checks
also remain in the existing workflow; this first container consumer covers the
portal. The factory standard carries this process into new project contexts and
plans; each consumer must still bind its own tests and evidence. Docker itself
does not prove that every product or test suite has migrated.

## Optional local reproduction

With an existing Docker engine, from the repository root:

```sh
docker build -f tools/development-container/Dockerfile -t wvd-development-test .
docker run --rm --init --network none --shm-size 1g --cap-drop ALL --security-opt no-new-privileges --memory 4g --cpus 2 wvd-development-test
```

The usual CI worker runs this, so the founder does not need to install Docker or
Java locally to verify each change. A local run without an evidence mount prints
the results; output disappears with the disposable container.

This is an unattended test environment with visible evidence, not an always-on
interactive preview. It does not give the assistant remote access to the
founder's Windows Docker engine. A shared interactive runtime would need an
explicit connection and cost verification before it can be used. The existing
local Firebase demo remains available for hands-on review when desired.
