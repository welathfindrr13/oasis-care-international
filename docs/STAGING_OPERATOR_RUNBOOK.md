# Staging Operator Runbook

This file is the practical handoff for Oasis staging work on `codex/repo-cleanup-20260321`.

It exists because the normal path is easy to get subtly wrong on this machine, and repeating those mistakes wastes time.

## Workspace And Branch

- Source-of-truth branch: `codex/repo-cleanup-20260321`
- Working codex repo path used for the live staging work:
  - `/private/tmp/oasis-codex-impl-review`

Do not keep making product changes from `/Users/tyreeseedwards/oasis international care` when the staging work is supposed to stay on the codex branch.

## Verified Staging Credentials

These are the real staging credentials that have been live-verified in the browser.

- Admin
  - email: `boss@yourdomain.com`
  - password: `SecurePassword123!1`
- Carer
  - email: `carer-demo@yourdomain.com`
  - password: `SecurePassword123!2`

Important:
- `Carer Demo` is the verified carer account for real browser checks.
- `Carer Diag` appears in the carer selector for reassignment flows, but its password has not been needed for the core live proofs so far.

## Current Live Baseline

As of the latest verified pass:

- API
  - service: `oasis-care-staging-api`
  - task definition: `oasis-care-staging-api:71`
  - digest: `sha256:253db579189715f4a113688dab4e67ff39b9496c0601bb86ae50684295c443a5`
- Web
  - service: `oasis-care-staging-web`
  - task definition: `oasis-care-staging-web:86`
  - digest: `sha256:ab365d56c9d320447f379f53d056ded7d47fb3a8940d34307ebc0d8beec72467`

## What Actually Works For Web Deploys

### Required build shape

For web deploys from this machine, the image must be built for:

- platform: `linux/amd64`

If you build plain local Docker images on Apple silicon without setting the platform, ECS fails with:

- `CannotPullContainerError: image Manifest does not contain descriptor matching platform 'linux/amd64'`

### Buildx push caveat on this machine

The flaky path on this machine is `docker buildx build --push`, not a plain `docker push` of an already-built local image.

What that means in practice:
- the amd64 image can finish building locally
- `buildx --push` can still go dark after the export/push phase
- the tag may never appear in ECR even though the local build succeeded

What did work cleanly in the latest pass:
- build the `linux/amd64` image locally
- push that local image with plain `docker push`
- verify the tag in ECR

### Fastest safe web publish path from this machine

1. Build the web image for `linux/amd64` and load it locally.
2. Push the local image tag with plain `docker push`.
3. Confirm the tag exists in ECR.
4. Register a new ECS task definition from the last healthy web revision.
5. Update the ECS service and wait for stability.

Use the OCI `oras cp` path only as a fallback if a plain `docker push` really fails.

## Commands That Were Actually Used

### 1. Build a web image locally for ECS

```bash
cd /private/tmp/oasis-codex-impl-review

docker buildx build \
  --platform linux/amd64 \
  --provenance=false \
  --load \
  -t 721689331449.dkr.ecr.eu-west-2.amazonaws.com/oasis-web:<tag> \
  -f apps/web/Dockerfile .
```

Example tag used successfully:

- `sha-6e29852`

### 2. Push the local image to ECR

```bash
docker push \
  721689331449.dkr.ecr.eu-west-2.amazonaws.com/oasis-web:<tag>
```

### 3. Confirm the tag exists in ECR

```bash
aws ecr describe-images \
  --region eu-west-2 \
  --repository-name oasis-web \
  --image-ids imageTag=<tag> \
  --query 'imageDetails[0].{digest:imageDigest,pushed:imagePushedAt}' \
  --output json
```

### 4. Register a new web task definition from the last healthy revision

Use the last healthy web revision as the base, not a failed one.

Example used:

```bash
aws ecs describe-task-definition \
  --region eu-west-2 \
  --task-definition oasis-care-staging-web:85 \
  --query 'taskDefinition' \
  --output json > /tmp/oasis-web-base.json

jq '.containerDefinitions |= map(
  if .name == "web"
  then .image = "721689331449.dkr.ecr.eu-west-2.amazonaws.com/oasis-web@sha256:<digest>"
  else .
  end
) | del(.taskDefinitionArn,.revision,.status,.requiresAttributes,.compatibilities,.registeredAt,.registeredBy)' \
  /tmp/oasis-web-base.json > /tmp/oasis-web-next.json

aws ecs register-task-definition \
  --region eu-west-2 \
  --cli-input-json file:///tmp/oasis-web-next.json \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text
```

### 5. Roll the ECS service

```bash
aws ecs update-service \
  --region eu-west-2 \
  --cluster oasis-care-staging-cluster \
  --service oasis-care-staging-web \
  --task-definition oasis-care-staging-web:<revision> \
  --query 'service.taskDefinition' \
  --output text

aws ecs wait services-stable \
  --region eu-west-2 \
  --cluster oasis-care-staging-cluster \
  --services oasis-care-staging-web
```

### 6. Useful live diagnostics

Current web service state:

```bash
aws ecs describe-services \
  --region eu-west-2 \
  --cluster oasis-care-staging-cluster \
  --services oasis-care-staging-web \
  --query 'services[0].{taskDefinition:taskDefinition,running:runningCount,pending:pendingCount}' \
  --output json
```

Latest web logs:

```bash
aws logs describe-log-streams \
  --region eu-west-2 \
  --log-group-name /ecs/oasis-web-staging \
  --order-by LastEventTime \
  --descending \
  --max-items 5

aws logs get-log-events \
  --region eu-west-2 \
  --log-group-name /ecs/oasis-web-staging \
  --log-stream-name web/web/<task-id> \
  --limit 200 \
  --output json
```

## Known Failure Modes

### 1. Wrong architecture

Symptom:
- new ECS task fails to start

Observed error:
- `CannotPullContainerError: pull image manifest has been retried 7 time(s): image Manifest does not contain descriptor matching platform 'linux/amd64'`

Meaning:
- the image was built for Apple silicon locally instead of ECS `amd64`

Fix:
- rebuild with `--platform linux/amd64`

### 2. Plain Docker push hangs on final commit

Symptom:
- `docker buildx build --push` never finishes publishing
- the local build succeeds but the tag does not appear in ECR

Meaning:
- the broken path is the local `buildx --push` registry export on this machine

Fix:
- build with `--load`
- push the local image with plain `docker push`
- verify the tag exists in ECR before rolling ECS

### 3. Fresh web task shows empty data surfaces even though shell loads

Observed symptom:
- header still shows the logged-in user
- pages like `/visits` or `/clients` show empty fallback states
- web logs show:
  - `GraphQL error: Unauthorized`

Meaning:
- the freshly rolled web task may need a clean browser re-auth before server-side GraphQL fetches recover against the new task/session state

Fix:
- log out or revisit `/login`
- sign in again with the verified staging credentials above
- then re-check the route

This was live-observed on the `:84` rollout, and a clean admin re-login restored normal data rendering.

## Browser Verification Defaults

When proving real product workflows, use the real browser and these defaults:

- Client for repeated operational checks:
  - `Browser Test Client`
- Main verified admin:
  - `boss@yourdomain.com`
- Main verified carer:
  - `carer-demo@yourdomain.com`

Prefer:
- real visits via `/visits/new`
- real prescriptions via client prescription routes
- real medication outcomes via `/emar` or visit detail

Avoid:
- fake dashboard proofs
- fake admin CRUD surfaces
- reseeding broad demo data unless absolutely necessary

## Coordinator Visit Management Proof Already Completed

Live-proven on staging:

- create future visit
- edit visit
- reassign carer
- reschedule start/end
- cancel visit
- confirm queue/detail coherence afterward

Fresh visit used in the proof:

- `19563fcd-846c-4248-920e-b72f81b0a77a`

## Final Reminder

Before saying a deploy is good:

1. confirm the digest exists in ECR
2. confirm ECS is actually running the new task definition
3. re-auth in the browser if data routes look empty
4. verify a real workflow, not just the page shell
