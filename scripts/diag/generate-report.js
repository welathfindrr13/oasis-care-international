const fs = require('fs');
const path = require('path');

function read(p) { 
  try { 
    return fs.readFileSync(path.join(process.cwd(), p), 'utf8'); 
  } catch { 
    return ''; 
  } 
}

function j(p) { 
  try { 
    return JSON.parse(read(p)); 
  } catch { 
    return null; 
  } 
}

const out = [];

const gen = read('_generated/diag/run_started_utc.txt').trim();
const sha = read('_generated/diag/git_sha.txt').trim();
const br = read('_generated/diag/git_branch.txt').trim();

out.push(`# Incident Triage: Staging Deployment`);
out.push(`**Generated:** ${gen}`);
out.push(`**Branch@SHA:** ${br} @ ${sha}`);
out.push(`**Region:** eu-west-2`);
out.push(`**Cluster:** oasis-care-staging-cluster`);
out.push('\n## Summary of Evidence\n');

// ECS Services
const ecsApi = j('_generated/diag/ecs_svc_oasis-api-staging.json');
const ecsWeb = j('_generated/diag/ecs_svc_oasis-web-staging.json');
const apiStatus = ecsApi?.services?.[0];
const webStatus = ecsWeb?.services?.[0];

function svcLine(s) {
  if (!s) return '- ❌ **Service not found** or API access denied';
  const status = s.status || 'UNKNOWN';
  const icon = status === 'ACTIVE' ? '🟢' : '🔴';
  return `- ${icon} **${s.serviceName}**: desired=${s.desiredCount} running=${s.runningCount} pending=${s.pendingCount} status=${status}`;
}

out.push('### ECS Services');
out.push(svcLine(apiStatus));
out.push(svcLine(webStatus));

// ECS Tasks
const apiTasks = j('_generated/diag/ecs_tasks_desc_oasis-api-staging.json');
const webTasks = j('_generated/diag/ecs_tasks_desc_oasis-web-staging.json');

function taskBrief(desc, label) {
  if (!desc?.tasks?.length) return `**${label}**: No tasks running`;
  const lines = desc.tasks.map(t => {
    const cont = (t.containers || [])[0] || {};
    const taskId = t.taskArn.split('/').pop().substring(0, 8);
    const status = t.lastStatus || 'UNKNOWN';
    const health = t.healthStatus || 'n/a';
    const exitCode = cont.exitCode !== undefined ? cont.exitCode : 'n/a';
    const reason = (t.stoppedReason || cont.reason || '').slice(0, 80);
    return `  - Task \`${taskId}\`: status=${status} health=${health} exitCode=${exitCode}${reason ? ` reason="${reason}"` : ''}`;
  });
  return `**${label}**:\n${lines.join('\n')}`;
}

out.push('\n### ECS Tasks Status');
out.push(taskBrief(apiTasks, 'API'));
out.push(taskBrief(webTasks, 'WEB'));

// ECR Images
function recentTags(repo, label) {
  const d = j(`_generated/diag/${repo}_recent.json`);
  if (!d || !Array.isArray(d) || d.length === 0) return `**${label}**: No recent images found`;
  const tags = d.map(x => ({
    pushedAt: x.imagePushedAt,
    tags: (x.imageTags || []).join(',') || 'untagged'
  })).slice(-3);
  const lines = tags.map(x => `  - ${x.pushedAt}: \`${x.tags}\``);
  return `**${label}** (last 3):\n${lines.join('\n')}`;
}

out.push('\n### ECR Recent Images');
out.push(recentTags('ecr_api', 'API'));
out.push(recentTags('ecr_web', 'WEB'));

// ALB
const lb = j('_generated/diag/alb_lbs.json');
out.push('\n### Application Load Balancer');
if (lb?.LoadBalancers?.length) {
  const L = lb.LoadBalancers[0];
  const stateCode = L.State?.Code || 'unknown';
  const icon = stateCode === 'active' ? '🟢' : '🔴';
  out.push(`${icon} **DNS:** \`${L.DNSName}\``);
  out.push(`  - State: ${stateCode} | Scheme: ${L.Scheme} | Type: ${L.Type}`);
} else {
  out.push('❌ **No ALB found** - infrastructure incomplete');
}

// Target Groups
const tgs = j('_generated/diag/alb_tgs.json')?.TargetGroups || [];
if (tgs.length) {
  out.push('\n### Target Groups Health');
  for (const tg of tgs) {
    const safe = tg.TargetGroupArn.replace(/[/:]/g, '__');
    const th = j(`_generated/diag/tg_health_${safe}.json`);
    const hs = th?.TargetHealthDescriptions || [];
    const healthy = hs.filter(h => h.TargetHealth?.State === 'healthy').length;
    const icon = healthy === hs.length && hs.length > 0 ? '🟢' : healthy > 0 ? '🟡' : '🔴';
    out.push(`${icon} **${tg.TargetGroupName}** (${tg.Port}/${tg.Protocol}): ${healthy}/${hs.length} healthy`);
    
    const unhealthy = hs.filter(h => h.TargetHealth?.State !== 'healthy');
    if (unhealthy.length) {
      const reasons = [...new Set(unhealthy.map(u => u.TargetHealth?.Reason))].filter(Boolean);
      out.push(`  - ⚠️ Unhealthy: ${reasons.join(', ') || 'Unknown reason'}`);
    }
  }
} else {
  out.push('\n### Target Groups');
  out.push('❌ No target groups found');
}

// Terraform
function tfNote(name) {
  const t = read(`_generated/diag/${name}.txt`);
  if (!t) return `❓ ${name}: no output`;
  const hasError = t.includes('Error:') || t.includes('denied') || t.includes('failed');
  const icon = hasError ? '🔴' : '🟢';
  return `${icon} ${name}${hasError ? ' (errors detected)' : ''}`;
}

out.push('\n### Terraform Status');
out.push(tfNote('tf_init'));
out.push(tfNote('tf_validate'));
out.push(tfNote('tf_plan_refresh_only'));

// GitHub Actions
function ghNote() {
  const runs = j('_generated/diag/gh_deploy_runs.json');
  if (!runs?.length) return '❓ No deploy runs fetched (gh CLI not available or auth issue)';
  const r = runs[0];
  const icon = r.conclusion === 'success' ? '🟢' : r.conclusion === 'failure' ? '🔴' : '🟡';
  return `${icon} **Last deploy**: ${r.conclusion || r.status} (${r.updatedAt})
  - Branch: ${r.headBranch} 
  - SHA: ${r.headSha?.substring(0, 7)}
  - Title: ${r.displayTitle || 'N/A'}`;
}

out.push('\n### GitHub Actions');
out.push(ghNote());

// RDS
const rds = j('_generated/diag/rds_endpoints_compact.json');
out.push('\n### RDS Database');
if (rds && rds.endpoint) {
  out.push(`🟢 **Endpoint:** \`${rds.endpoint}:${rds.port}\``);
  out.push(`  - Instance: ${rds.id}`);
  out.push(`  - Publicly Accessible: ${rds.publiclyAccessible ? 'Yes ⚠️' : 'No'}`);
} else {
  out.push('❌ No RDS instance found or access denied');
}

// Secrets
out.push('\n### Secrets Manager');
const secretNames = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL'];
for (const name of secretNames) {
  const s = j(`_generated/diag/secret_${name}.json`);
  const exists = s?.SecretList?.length > 0;
  out.push(`${exists ? '🟢' : '❌'} oasis/staging/${name}`);
}

// Diagnosis
out.push('\n## Preliminary Diagnosis\n');

function push(s) { out.push(`- ${s}`) }

const apiDesired = apiStatus?.desiredCount ?? 0;
const apiRunning = apiStatus?.runningCount ?? 0;
const webDesired = webStatus?.desiredCount ?? 0;
const webRunning = webStatus?.runningCount ?? 0;

if (!apiStatus || !webStatus) {
  push('🔴 **CRITICAL**: Unable to fetch ECS service status - IAM permissions issue or services do not exist');
}

if (apiDesired > 0 && apiRunning === 0) {
  push('🔴 **API service**: desired > 0 but 0 running tasks → likely task start failure');
  push('   - Check container image availability in ECR');
  push('   - Review task definition for correct port configuration');
  push('   - Inspect CloudWatch logs for container startup errors');
  push('   - Verify task execution role has permissions for ECR + SecretsManager');
}

if (webDesired > 0 && webRunning === 0) {
  push('🔴 **WEB service**: desired > 0 but 0 running tasks → investigate container start logs');
  push('   - Verify health check endpoint configuration');
  push('   - Check for environment variable issues');
}

if (apiDesired === 0 && webDesired === 0) {
  push('🔴 **Both services** have desired=0 → deployment scaling misconfigured or Terraform apply failed');
}

if (!lb?.LoadBalancers?.length) {
  push('🔴 **No ALB found** → Infrastructure deployment incomplete (Phase 5 failure)');
  push('   - Review terraform apply logs for ALB creation errors');
  push('   - Check for missing IAM permissions (ec2:GetSecurityGroupsForVpc)');
}

if (tgs.length > 0) {
  let total = 0, healthy = 0;
  for (const tg of tgs) {
    const safe = tg.TargetGroupArn.replace(/[/:]/g, '__');
    const th = j(`_generated/diag/tg_health_${safe}.json`);
    const hs = th?.TargetHealthDescriptions || [];
    total += hs.length;
    healthy += hs.filter(h => h.TargetHealth?.State === 'healthy').length;
  }
  if (total > 0 && healthy === 0) {
    push('🔴 **ALB reports 0 healthy targets** → health check path/port mismatch or tasks failing checks');
    push('   - Verify health check path in target group settings');
    push('   - Ensure container port matches target group port');
    push('   - Check security group rules allow ALB → ECS communication');
  }
}

const tfPlan = read('_generated/diag/tf_plan_refresh_only.txt');
if (tfPlan.includes('Error:') || tfPlan.includes('denied')) {
  push('🟡 **Terraform refresh shows errors** → state drift or missing IAM permissions');
}

const ecrApi = j('_generated/diag/ecr_api_recent.json');
const ecrWeb = j('_generated/diag/ecr_web_recent.json');
if (!ecrApi?.length) push('🔴 **No recent API images** in ECR → build/push failed');
if (!ecrWeb?.length) push('🔴 **No recent WEB images** in ECR → build/push failed');

out.push('\n## Next Actions (Prioritized)\n');
out.push('### Immediate (Red Flags)');
if (!apiStatus || !webStatus) {
  out.push('1. **Verify AWS credentials and IAM permissions** for ECS describe operations');
}
if (!lb?.LoadBalancers?.length) {
  out.push('1. **Fix ALB creation failure**:');
  out.push('   - Add `ec2:GetSecurityGroupsForVpc` to IAM policy');
  out.push('   - Re-run Terraform apply for infrastructure deployment');
}
if ((apiDesired > 0 && apiRunning === 0) || (webDesired > 0 && webRunning === 0)) {
  out.push('1. **Investigate task startup failures**:');
  out.push('   ```bash');
  out.push('   # View CloudWatch logs');
  out.push('   aws logs tail /ecs/oasis-api-staging --follow --region eu-west-2');
  out.push('   aws logs tail /ecs/oasis-web-staging --follow --region eu-west-2');
  out.push('   ```');
}

out.push('\n### Short-term (Configuration)');
out.push('2. **Verify container configuration**:');
out.push('   - API container port should match target group port (usually 4000 or 3000)');
out.push('   - WEB container port should match target group port (usually 3000)');
out.push('   - Health check paths: API=`/health`, WEB=`/` or `/api/health`');
out.push('');
out.push('3. **Check task execution role permissions**:');
out.push('   - ECR: `ecr:GetAuthorizationToken`, `ecr:BatchGetImage`');
out.push('   - Logs: `logs:CreateLogStream`, `logs:PutLogEvents`');
out.push('   - Secrets: `secretsmanager:GetSecretValue`');

out.push('\n### Medium-term (State Management)');
out.push('4. **Import existing resources into Terraform state**:');
out.push('   ```bash');
out.push('   cd infrastructure/staging');
out.push('   terraform import aws_ecr_repository.api oasis-api');
out.push('   terraform import aws_ecr_repository.web oasis-web');
out.push('   # Import other conflicting resources as identified');
out.push('   ```');

out.push('\n## Evidence Files');
out.push(`\nAll diagnostic data saved to \`_generated/diag/\` (${fs.readdirSync('_generated/diag').length} files)`);
out.push('\nKey files:');
out.push('- `ecs_svc_*.json` - ECS service status');
out.push('- `ecs_tasks_desc_*.json` - Task details with exit codes');
out.push('- `alb_*.json` - Load balancer and target group config');
out.push('- `ecr_*_recent.json` - Recent container images');
out.push('- `tf_*.txt` - Terraform validation results');
out.push('- `rds_*.json` - Database endpoint info');
out.push('- `secret_*.json` - Secrets Manager inventory (names only)');

out.push('\n---\n**Report End** - Generated by automated diagnostic tool');

fs.writeFileSync('_reports/INCIDENT_TRIAGE.md', out.join('\n'));
console.log('✅ Report written to _reports/INCIDENT_TRIAGE.md');
