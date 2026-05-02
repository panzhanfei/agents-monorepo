/**
 * One-off migration: consolidate customer/target-oriented keys from repo-root `.env`
 * into `customer-targets/<id>/target.yaml` + merges into `agents.config.yaml`,
 * then removes those keys from `.env`.
 *
 * Usage (from repo root): node scripts/migrate-customer-env-to-target.mjs
 */
/* eslint-disable no-console */
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ID = 'default';

/** @type {readonly string[]} */
const KEYS_TO_STRIP_FROM_ENV = [
  'TARGET_PROJECT_SOURCE',
  'TARGET_GIT_REPO_URL',
  'TARGET_GIT_DEFAULT_BRANCH',
  'TARGET_WORKSPACE_PATH',
  'TARGET_DEFAULT_PROJECT_ID',
  'FEISHU_PARSE_WORKSPACE_PATH_FROM_MESSAGE',
  'FEISHU_PARSE_GIT_REMOTE_URL_FROM_MESSAGE',
  'GIT_AUTO_INIT_WHEN_REMOTE_PROVIDED',
  'GIT_REMOTE_NAME',
  'REVIEW_CUSTOM_RULES_DIR',
  'REVIEW_RULES_RELOAD_EACH_RUN',
  'REVIEW_CONFIG_FILES',
  'REVIEW_BLOCKING_COMMAND',
  'PACK_BUILD_OUTPUT_DIR',
  'PACK_ARTIFACT_LOCAL_DIR',
  'PACK_STAGING_DIR',
  'DEPLOY_SSH_HOST',
  'DEPLOY_SSH_USER',
  'DEPLOY_SSH_PORT',
  'DEPLOY_REMOTE_PATH',
  'OPS_BACKUP_BEFORE_DEPLOY',
  'OPS_BACKUP_REMOTE_PARENT',
  'OPS_BACKUP_KEEP_REVISIONS',
  'OPS_ABORT_PUBLISH_IF_BACKUP_FAILS',
  'OPS_ROLLBACK_SCRIPT_NAME',
  'OPS_ROLLBACK_REQUIRE_CONFIRM',
  'OPS_PROBE_LISTEN_PORTS',
  'OPS_PROBE_RUN_SS_LNTP',
  'OPS_PROBE_RUN_HOST_INFO',
  'OPS_PROBE_SYSTEMD_UNITS',
  'OPS_PROBE_DOCKER_PS',
  'AGENTS_GENERATED_OPS_DIR',
  'AGENTS_OPS_MANIFEST',
  'AGENTS_OPS_ENFORCE_MANIFEST_FINGERPRINT',
  'PIPELINE_FULL_TEST_COMMAND',
  'TEST_GATE_TIMEOUT_MS',
];

const STRIP_SET = new Set(KEYS_TO_STRIP_FROM_ENV);

const dirname = path.dirname(fileURLToPath(import.meta.url));
const monoRoot = path.resolve(dirname, '..');
const require = createRequire(import.meta.url);
const YAML = require(path.join(monoRoot, 'packages/agents-config/node_modules/yaml'));

const parseDotEnvMap = (raw) => {
  const out = /** @type {Record<string,string>} */ ({});
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) !== true) {
      continue;
    }
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
};

/** @returns {boolean | undefined} */
const parseBoolLike = (input) => {
  if (typeof input !== 'string') {
    return undefined;
  }
  const t = input.trim();
  if (t === 'true' || t === '1') {
    return true;
  }
  if (t === 'false' || t === '0') {
    return false;
  }
  return undefined;
};

/** @returns {readonly string[]} */
const splitBlocking = (compound) =>
  compound
    .split('&&')
    .map((p) => p.trim())
    .filter((s) => s !== '');

const envPortCsvToYamlProbePorts = (portsCsv) =>
  portsCsv
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n));

await (async () => {
  const envPath = path.join(monoRoot, '.env');
  const yamlPath = path.join(monoRoot, 'agents.config.yaml');
  const envRaw = await fs.readFile(envPath, 'utf8');
  const env = parseDotEnvMap(envRaw);

  const wsRaw = env.TARGET_WORKSPACE_PATH?.trim() ?? '';
  if (wsRaw === '') {
    throw new Error('.env lacks TARGET_WORKSPACE_PATH; refusing to migrate');
  }

  /** @type {Record<string, unknown>} */
  const targetDef = {
    workspacePath: wsRaw,
    gitRepoUrl: env.TARGET_GIT_REPO_URL?.trim() || undefined,
    defaultBranch: env.TARGET_GIT_DEFAULT_BRANCH?.trim() || undefined,
    packBuildOutputDir: env.PACK_BUILD_OUTPUT_DIR?.trim() || undefined,
    deploySshHost: env.DEPLOY_SSH_HOST?.trim() || undefined,
    deploySshUser: env.DEPLOY_SSH_USER?.trim() || undefined,
    deploySshPort:
      env.DEPLOY_SSH_PORT?.trim() !== undefined && env.DEPLOY_SSH_PORT?.trim() !== ''
        ? env.DEPLOY_SSH_PORT.trim()
        : undefined,
    deployRemotePath: env.DEPLOY_REMOTE_PATH?.trim() || undefined,
    probeListenPorts: env.OPS_PROBE_LISTEN_PORTS?.trim() || undefined,
    fullTestCommand: env.PIPELINE_FULL_TEST_COMMAND?.trim() || undefined,
  };
  for (const k of Object.keys(targetDef)) {
    if (targetDef[k] === undefined) {
      delete targetDef[k];
    }
  }

  const targetDir = path.join(monoRoot, 'customer-targets', PROJECT_ID);
  await fs.mkdir(targetDir, { recursive: true });
  const defPath = path.join(targetDir, 'target.yaml');
  await fs.writeFile(
    defPath,
    `${YAML.stringify(targetDef, { lineWidth: 120 }).trim()}\n`,
    'utf8',
  );
  console.log(`Wrote ${path.relative(monoRoot, defPath)}`);

  const cfgRaw = await fs.readFile(yamlPath, 'utf8');
  const cfg = YAML.parse(cfgRaw);

  const sourceRaw = env.TARGET_PROJECT_SOURCE?.trim();
  if (sourceRaw === 'git' || sourceRaw === 'local') {
    cfg.target = { ...(cfg.target ?? {}), source: sourceRaw };
  }
  const explicitDefaultId = env.TARGET_DEFAULT_PROJECT_ID?.trim();
  cfg.target = {
    ...(cfg.target ?? {}),
    defaultProjectId:
      explicitDefaultId !== undefined && explicitDefaultId !== ''
        ? explicitDefaultId
        : PROJECT_ID,
    projects: [
      {
        id: PROJECT_ID,
        definitionPath: `customer-targets/${PROJECT_ID}/target.yaml`,
      },
    ],
  };
  delete cfg.target.workspacePath;
  delete cfg.target.gitRepoUrl;
  delete cfg.target.defaultBranch;

  const testGate = env.TEST_GATE_TIMEOUT_MS?.trim();
  if (testGate !== undefined && testGate !== '') {
    const n = Number(testGate);
    if (Number.isFinite(n) && n > 0) {
      cfg.pipeline = { ...(cfg.pipeline ?? {}), testGateTimeoutMs: n };
    }
  }

  cfg.packaging = { ...(cfg.packaging ?? {}) };
  if ((env.PACK_BUILD_OUTPUT_DIR?.trim() ?? '') !== '') {
    cfg.packaging.buildOutputDir = env.PACK_BUILD_OUTPUT_DIR.trim();
  }
  if ((env.PACK_ARTIFACT_LOCAL_DIR?.trim() ?? '') !== '') {
    cfg.packaging.artifactLocalDir = env.PACK_ARTIFACT_LOCAL_DIR.trim();
  }
  if ((env.PACK_STAGING_DIR?.trim() ?? '') !== '') {
    cfg.packaging.stagingDir = env.PACK_STAGING_DIR.trim();
  }

  cfg.server = { ...(cfg.server ?? {}) };
  if ((env.DEPLOY_SSH_HOST?.trim() ?? '') !== '') {
    cfg.server.sshHost = env.DEPLOY_SSH_HOST.trim();
  }
  if ((env.DEPLOY_SSH_USER?.trim() ?? '') !== '') {
    cfg.server.sshUser = env.DEPLOY_SSH_USER.trim();
  }
  const depPortRaw = env.DEPLOY_SSH_PORT?.trim() ?? '';
  if (depPortRaw !== '') {
    cfg.server.sshPort = Number(depPortRaw);
  }
  if ((env.DEPLOY_REMOTE_PATH?.trim() ?? '') !== '') {
    cfg.server.remoteDeployPath = env.DEPLOY_REMOTE_PATH.trim();
  }

  cfg.server.backup = { ...(cfg.server.backup ?? {}) };
  const bu = env.OPS_BACKUP_BEFORE_DEPLOY?.trim();
  if (bu !== '') {
    const pb = parseBoolLike(env.OPS_BACKUP_BEFORE_DEPLOY);
    if (pb !== undefined) {
      cfg.server.backup.enabled = pb;
    }
  }
  if ((env.OPS_BACKUP_REMOTE_PARENT?.trim() ?? '') !== '') {
    cfg.server.backup.remoteParentDir = env.OPS_BACKUP_REMOTE_PARENT.trim();
  }
  const keepRev = env.OPS_BACKUP_KEEP_REVISIONS?.trim() ?? '';
  if (keepRev !== '') {
    cfg.server.backup.keepRevisions = Number(keepRev);
  }
  if (env.OPS_ABORT_PUBLISH_IF_BACKUP_FAILS !== undefined) {
    const ab = parseBoolLike(env.OPS_ABORT_PUBLISH_IF_BACKUP_FAILS);
    if (ab !== undefined) {
      cfg.server.backup.abortPublishIfBackupFails = ab;
    }
  }

  cfg.server.rollback = { ...(cfg.server.rollback ?? {}) };
  if ((env.OPS_ROLLBACK_SCRIPT_NAME?.trim() ?? '') !== '') {
    cfg.server.rollback.scriptName = env.OPS_ROLLBACK_SCRIPT_NAME.trim();
  }
  if (env.OPS_ROLLBACK_REQUIRE_CONFIRM !== undefined) {
    const rb = parseBoolLike(env.OPS_ROLLBACK_REQUIRE_CONFIRM);
    if (rb !== undefined) {
      cfg.server.rollback.requireFeishuConfirm = rb;
    }
  }

  cfg.server.probe = { ...(cfg.server.probe ?? {}) };
  const probesCsv = env.OPS_PROBE_LISTEN_PORTS?.trim() ?? '';
  if (probesCsv !== '') {
    cfg.server.probe.listenPorts = envPortCsvToYamlProbePorts(env.OPS_PROBE_LISTEN_PORTS);
  }
  if (env.OPS_PROBE_RUN_SS_LNTP !== undefined) {
    const v = parseBoolLike(env.OPS_PROBE_RUN_SS_LNTP);
    if (v !== undefined) {
      cfg.server.probe.runSsListenTcp = v;
    }
  }
  if (env.OPS_PROBE_RUN_HOST_INFO !== undefined) {
    const v = parseBoolLike(env.OPS_PROBE_RUN_HOST_INFO);
    if (v !== undefined) {
      cfg.server.probe.runHostInfo = v;
    }
  }
  if ((env.OPS_PROBE_SYSTEMD_UNITS?.trim() ?? '') !== '') {
    cfg.server.probe.systemdUnits = env.OPS_PROBE_SYSTEMD_UNITS.split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  }
  if (env.OPS_PROBE_DOCKER_PS !== undefined) {
    const v = parseBoolLike(env.OPS_PROBE_DOCKER_PS);
    if (v !== undefined) {
      cfg.server.probe.dockerPs = v;
    }
  }

  cfg.generatedOps = { ...(cfg.generatedOps ?? {}) };
  if ((env.AGENTS_GENERATED_OPS_DIR?.trim() ?? '') !== '') {
    cfg.generatedOps.scriptsDir = env.AGENTS_GENERATED_OPS_DIR.trim();
  }
  if ((env.AGENTS_OPS_MANIFEST?.trim() ?? '') !== '') {
    cfg.generatedOps.manifestPath = env.AGENTS_OPS_MANIFEST.trim();
  }
  if (env.AGENTS_OPS_ENFORCE_MANIFEST_FINGERPRINT !== undefined) {
    const v = parseBoolLike(env.AGENTS_OPS_ENFORCE_MANIFEST_FINGERPRINT);
    if (v !== undefined) {
      cfg.generatedOps.enforceManifestFingerprint = v;
    }
  }

  cfg.feishu = { ...(cfg.feishu ?? {}) };
  if (env.FEISHU_PARSE_WORKSPACE_PATH_FROM_MESSAGE !== undefined) {
    const v = parseBoolLike(env.FEISHU_PARSE_WORKSPACE_PATH_FROM_MESSAGE);
    if (v !== undefined) {
      cfg.feishu.parseWorkspacePathFromMessage = v;
    }
  }
  if (env.FEISHU_PARSE_GIT_REMOTE_URL_FROM_MESSAGE !== undefined) {
    const v = parseBoolLike(env.FEISHU_PARSE_GIT_REMOTE_URL_FROM_MESSAGE);
    if (v !== undefined) {
      cfg.feishu.parseGitRemoteUrlFromMessage = v;
    }
  }

  const active =
    env.REVIEW_RULES_PROFILE?.trim() !== ''
      ? env.REVIEW_RULES_PROFILE.trim()
      : cfg.review.activeProfile ?? 'default';
  cfg.review = { ...(cfg.review ?? {}), activeProfile: active };

  cfg.review.profiles = { ...(cfg.review.profiles ?? {}) };
  const profShape = cfg.review.profiles[active] ?? {};
  const blockCmd = env.REVIEW_BLOCKING_COMMAND?.trim();

  cfg.review.profiles[active] = {
    ...profShape,
    ...(env.REVIEW_CUSTOM_RULES_DIR?.trim() !== ''
      ? { customerRulesDir: env.REVIEW_CUSTOM_RULES_DIR.trim() }
      : {}),
    ...(blockCmd !== undefined && blockCmd !== ''
      ? {
          blockingCommands: splitBlocking(blockCmd),
        }
      : {}),
  };

  if (env.REVIEW_CONFIG_FILES?.trim() !== '') {
    cfg.review.extraConfigFiles = env.REVIEW_CONFIG_FILES.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  await fs.writeFile(
    yamlPath,
    `${YAML.stringify(cfg, {
      indent: 2,
      lineWidth: 120,
    }).trimEnd()}\n`,
    'utf8',
  );
  console.log(`Updated agents.config.yaml`);

  const strippedLines = [];
  for (const line of envRaw.split(/\r?\n/)) {
    const t = line.trim();
    if (t === '' || t.startsWith('#')) {
      strippedLines.push(line);
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      strippedLines.push(line);
      continue;
    }
    const key = line.slice(0, eq).trim();
    if (STRIP_SET.has(key)) {
      continue;
    }
    strippedLines.push(line);
  }

  /** Collapse trailing blank runs */
  let outRaw = strippedLines.join('\n');
  while (outRaw.endsWith('\n\n\n')) {
    outRaw = outRaw.slice(0, -1);
  }
  if (!outRaw.endsWith('\n')) {
    outRaw += '\n';
  }
  await fs.writeFile(envPath, outRaw, 'utf8');
  console.log(`Stripped migrated keys from .env`);

  console.log('\n✓ Done. Reload agents / console; sanity check: hydrate target projects.');
})();
