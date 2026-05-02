export type IConsoleModuleId =
  | 'general'
  | 'requirements'
  | 'coding'
  | 'review'
  | 'test'
  | 'ops'
  | 'serverProbe';

export type IEnvFieldMeta = {
  readonly key: string;
  readonly label: string;
  readonly required: boolean;
  readonly requiredInModules?: readonly IConsoleModuleId[];
  readonly modules: readonly IConsoleModuleId[];
  readonly hint?: string;
  readonly sensitive?: boolean;
};

const g = (m: readonly IConsoleModuleId[]): readonly IConsoleModuleId[] => m;

const ENV_HINT_AGENT_HTTP_BASE_DERIVES =
  '留空则编排器按 AGENTS_INTERNAL_HTTP_HOST 与同名片段 *_PORT 拼接基址；跨机或 HTTPS 时再填完整 URL。';

export const CONSOLE_MODULE_LABELS: Record<IConsoleModuleId, string> = {
  general: '通用',
  requirements: '需求分析',
  coding: '编码',
  review: '代码审核',
  test: '测试',
  ops: '运维',
  serverProbe: '服务器巡检',
};

export const CONSOLE_MODULE_ORDER: readonly IConsoleModuleId[] = [
  'general',
  'requirements',
  'coding',
  'review',
  'test',
  'ops',
  'serverProbe',
];

export const isEnvFieldRequiredInModule = (
  f: IEnvFieldMeta,
  moduleId: IConsoleModuleId,
): boolean => {
  if (f.required === true) {
    return true;
  }
  return f.requiredInModules?.includes(moduleId) === true;
};

export type IEnvSectionId =
  | 'orchestration'
  | 'console'
  | 'task-logging'
  | 'feishu'
  | 'workspace-git'
  | 'security'
  | 'llm-default'
  | 'llm-module-override'
  | 'agent-requirements'
  | 'agent-coding'
  | 'review-rules'
  | 'agent-review'
  | 'agent-test'
  | 'ops-packaging'
  | 'ops-deploy'
  | 'ops-backup-rollback'
  | 'ops-generated'
  | 'ops-service'
  | 'probe'
  | 'misc';

export const ENV_SECTION_LABELS: Record<IEnvSectionId, string> = {
  orchestration: '编排与仓库路径',
  console: '控制台（本 UI）',
  'task-logging': '任务存储与日志',
  feishu: '飞书开放平台',
  'workspace-git': 'Git / 工作区解析',
  security: '敏感与安全',
  'llm-default': '模型（默认 LLM）',
  'llm-module-override': '模型（本链路专用）',
  'agent-requirements': '需求 Agent（HTTP）',
  'agent-coding': '编码 Agent（HTTP）',
  'review-rules': '代码审核 · 规则与门禁',
  'agent-review': '审核 Agent（HTTP）',
  'agent-test': '测试 Agent · 流水线',
  'ops-packaging': '运维 · 打包产物',
  'ops-deploy': '运维 · SSH 与部署路径',
  'ops-backup-rollback': '运维 · 备份与回滚',
  'ops-generated': '运维 · 生成物与清单',
  'ops-service': '运维 Agent（端口）',
  probe: '服务器巡检',
  misc: '其他',
};

export const ENV_SECTION_ORDER: readonly IEnvSectionId[] = [
  'orchestration',
  'console',
  'task-logging',
  'feishu',
  'workspace-git',
  'security',
  'llm-default',
  'llm-module-override',
  'agent-requirements',
  'agent-coding',
  'review-rules',
  'agent-review',
  'agent-test',
  'ops-packaging',
  'ops-deploy',
  'ops-backup-rollback',
  'ops-generated',
  'ops-service',
  'probe',
  'misc',
];

export const envSectionIdForKey = (key: string): IEnvSectionId => {
  if (
    key === 'ORCHESTRATOR_PORT' ||
    key === 'PORT' ||
    key === 'AGENTS_CONFIG_PATH' ||
    key === 'AGENTS_MONOREPO_ROOT' ||
    key === 'AGENTS_ORCHESTRATOR_URL'
  ) {
    return 'orchestration';
  }
  if (key.startsWith('AGENT_CONSOLE_')) {
    return 'console';
  }
  if (
    key === 'TASK_STORE_DRIVER' ||
    key === 'FEISHU_FLOW_TTY' ||
    key === 'AGENTS_LOG_DIR'
  ) {
    return 'task-logging';
  }
  if (key.startsWith('FEISHU_PARSE_')) {
    return 'workspace-git';
  }
  if (key.startsWith('GIT_')) {
    return 'workspace-git';
  }
  if (key.startsWith('FEISHU_')) {
    return 'feishu';
  }
  if (key === 'VERIFY_CODE') {
    return 'security';
  }
  if (key.startsWith('LLM_')) {
    return 'llm-default';
  }
  if (
    key.startsWith('REQUIREMENTS_LLM_') ||
    key.startsWith('CODING_LLM_') ||
    key.startsWith('REVIEW_LLM_') ||
    key === 'REVIEW_SKIP_LLM'
  ) {
    return 'llm-module-override';
  }
  if (key.startsWith('REQUIREMENTS_AGENT_')) {
    return 'agent-requirements';
  }
  if (key.startsWith('CODING_AGENT_')) {
    return 'agent-coding';
  }
  if (key.startsWith('REVIEW_AGENT_')) {
    return 'agent-review';
  }
  if (
    key.startsWith('REVIEW_RULES_') ||
    key.startsWith('REVIEW_CONFIG_') ||
    key.startsWith('REVIEW_CUSTOM_') ||
    key === 'REVIEW_BLOCKING_COMMAND' ||
    key === 'REVIEW_GATE_TIMEOUT_MS' ||
    key === 'REVIEW_RULES_MAX_CHARS'
  ) {
    return 'review-rules';
  }
  if (key.startsWith('TEST_AGENT_')) {
    return 'agent-test';
  }
  if (
    key === 'TEST_GATE_TIMEOUT_MS' ||
    key === 'PIPELINE_FULL_TEST_COMMAND'
  ) {
    return 'agent-test';
  }
  if (key === 'OPS_AGENT_PORT') {
    return 'ops-service';
  }
  if (key.startsWith('PACK_')) {
    return 'ops-packaging';
  }
  if (key.startsWith('DEPLOY_')) {
    return 'ops-deploy';
  }
  if (
    key.startsWith('OPS_BACKUP_') ||
    key.startsWith('OPS_ABORT_') ||
    key.startsWith('OPS_ROLLBACK_')
  ) {
    return 'ops-backup-rollback';
  }
  if (
    key.startsWith('AGENTS_GENERATED_OPS') ||
    key.startsWith('AGENTS_OPS_')
  ) {
    return 'ops-generated';
  }
  if (key.startsWith('OPS_PROBE_')) {
    return 'probe';
  }
  return 'misc';
};

export const fieldsGroupedBySectionForModule = (
  moduleId: IConsoleModuleId,
): readonly {
  readonly sectionId: IEnvSectionId;
  readonly fields: readonly IEnvFieldMeta[];
}[] => {
  const list = ENV_FIELD_CATALOG.filter((f) => f.modules.includes(moduleId));
  const buckets = new Map<IEnvSectionId, IEnvFieldMeta[]>();
  for (const sid of ENV_SECTION_ORDER) {
    buckets.set(sid, []);
  }
  for (const f of list) {
    const sid = envSectionIdForKey(f.key);
    const arr = buckets.get(sid);
    if (arr !== undefined) {
      arr.push(f);
    }
  }

  const sortInSection = (fields: IEnvFieldMeta[]): IEnvFieldMeta[] =>
    [...fields].sort((a, b) => {
      const ra = isEnvFieldRequiredInModule(a, moduleId);
      const rb = isEnvFieldRequiredInModule(b, moduleId);
      if (ra !== rb) {
        return ra === true ? -1 : 1;
      }
      return a.label.localeCompare(b.label, 'zh-CN');
    });

  return ENV_SECTION_ORDER.flatMap((sid) => {
    const raw = buckets.get(sid);
    if (raw === undefined || raw.length === 0) {
      return [];
    }
    return [{ sectionId: sid, fields: sortInSection(raw) }];
  });
};

export const ENV_FIELD_CATALOG: readonly IEnvFieldMeta[] = [
  {
    key: 'ORCHESTRATOR_PORT',
    label: '编排器 HTTP 端口',
    required: false,
    requiredInModules: g(['general']),
    modules: g(['general']),
  },
  { key: 'PORT', label: '兼容端口（仅 orchestrator）', required: false, modules: g(['general']) },
  {
    key: 'AGENTS_CONFIG_PATH',
    label: 'agents.config.yaml 路径（可选）',
    required: false,
    modules: g(['general']),
  },
  {
    key: 'AGENTS_MONOREPO_ROOT',
    label: '编排仓库根目录覆盖（可选）',
    required: false,
    modules: g(['general']),
  },
  {
    key: 'AGENTS_ORCHESTRATOR_URL',
    label: '编排器对外 URL（控制台转发等）',
    required: false,
    modules: g(['general']),
  },
  {
    key: 'TASK_STORE_DRIVER',
    label: '任务存储驱动',
    required: false,
    requiredInModules: g(['general']),
    modules: g(['general']),
  },
  {
    key: 'FEISHU_FLOW_TTY',
    label: '飞书链路终端摘要',
    required: false,
    modules: g(['general']),
  },
  {
    key: 'AGENTS_LOG_DIR',
    label: 'JSON 日志目录',
    required: false,
    modules: g(['general']),
  },
  {
    key: 'AGENT_CONSOLE_VITE_PORT',
    label: '控制台 Vite 端口',
    required: false,
    modules: g(['general']),
  },
  {
    key: 'AGENT_CONSOLE_API_PORT',
    label: '控制台 API 端口',
    required: false,
    modules: g(['general']),
  },
  {
    key: 'AGENT_CONSOLE_API_TOKEN',
    label: '控制台 API Bearer Token',
    required: false,
    modules: g(['general']),
    sensitive: true,
  },
  {
    key: 'FEISHU_APP_ID',
    label: '飞书 App Id',
    required: false,
    modules: g(['general']),
  },
  {
    key: 'FEISHU_APP_SECRET',
    label: '飞书 App Secret',
    required: false,
    modules: g(['general']),
    sensitive: true,
  },
  {
    key: 'FEISHU_ENCRYPT_KEY',
    label: '飞书 Encrypt Key',
    required: false,
    modules: g(['general']),
    sensitive: true,
  },
  {
    key: 'FEISHU_AUTO_REPLY',
    label: '飞书自动回消息',
    required: false,
    modules: g(['general']),
  },
  {
    key: 'FEISHU_OPEN_API_BASE',
    label: '飞书 Open API Base',
    required: false,
    modules: g(['general']),
  },
  {
    key: 'FEISHU_PARSE_WORKSPACE_PATH_FROM_MESSAGE',
    label: '从消息解析工作区路径',
    required: false,
    modules: g(['general', 'coding']),
  },
  {
    key: 'FEISHU_PARSE_GIT_REMOTE_URL_FROM_MESSAGE',
    label: '从消息解析 Git 远端',
    required: false,
    modules: g(['general', 'coding']),
  },
  {
    key: 'GIT_AUTO_INIT_WHEN_REMOTE_PROVIDED',
    label: '提供远端时自动 git init',
    required: false,
    modules: g(['general', 'coding', 'ops']),
  },
  {
    key: 'GIT_REMOTE_NAME',
    label: 'Git remote 名称',
    required: false,
    modules: g(['general', 'coding']),
  },
  {
    key: 'VERIFY_CODE',
    label: '敏感操作静态验证码',
    required: false,
    modules: g(['general', 'ops', 'review']),
    sensitive: true,
  },
  {
    key: 'LLM_PROVIDER',
    label: 'LLM 提供方',
    required: false,
    modules: g(['general', 'requirements', 'coding', 'review']),
  },
  {
    key: 'LLM_BASE_URL',
    label: 'LLM Base URL（OpenAI 兼容）',
    required: false,
    requiredInModules: g(['requirements', 'coding', 'review']),
    modules: g(['general', 'requirements', 'coding', 'review']),
  },
  {
    key: 'LLM_MODEL',
    label: '默认 LLM 模型',
    required: false,
    requiredInModules: g(['requirements', 'coding', 'review']),
    modules: g(['general', 'requirements', 'coding', 'review']),
  },
  {
    key: 'LLM_API_KEY',
    label: 'LLM API Key',
    required: false,
    modules: g(['general', 'requirements', 'coding', 'review']),
    sensitive: true,
  },
  {
    key: 'LLM_TIMEOUT_MS',
    label: 'LLM 超时（毫秒）',
    required: false,
    modules: g(['general', 'requirements', 'coding', 'review']),
  },
  {
    key: 'REQUIREMENTS_AGENT_BASE_URL',
    label: '需求 Agent 基址',
    required: false,
    modules: g(['general', 'requirements']),
    hint: ENV_HINT_AGENT_HTTP_BASE_DERIVES,
  },
  {
    key: 'REQUIREMENTS_AGENT_HTTP_TIMEOUT_MS',
    label: '需求 Agent HTTP 超时',
    required: false,
    modules: g(['general', 'requirements']),
  },
  {
    key: 'REQUIREMENTS_AGENT_INTERNAL_TOKEN',
    label: '需求 Agent 内部 Token',
    required: false,
    modules: g(['general', 'requirements']),
    sensitive: true,
  },
  {
    key: 'REQUIREMENTS_LLM_MODEL',
    label: '需求分析专用模型',
    required: false,
    requiredInModules: g(['requirements']),
    modules: g(['requirements', 'general']),
  },
  {
    key: 'REQUIREMENTS_LLM_MAX_RETRIES',
    label: '需求 LLM 重试次数',
    required: false,
    modules: g(['requirements']),
  },
  {
    key: 'CODING_AGENT_PORT',
    label: '编码 Agent 端口',
    required: false,
    modules: g(['general', 'coding']),
  },
  {
    key: 'CODING_AGENT_BASE_URL',
    label: '编码 Agent 基址',
    required: false,
    modules: g(['general', 'coding']),
    hint: ENV_HINT_AGENT_HTTP_BASE_DERIVES,
  },
  {
    key: 'CODING_AGENT_INTERNAL_TOKEN',
    label: '编码 Agent 内部 Token',
    required: false,
    modules: g(['coding', 'general']),
    sensitive: true,
  },
  {
    key: 'CODING_AGENT_HTTP_TIMEOUT_MS',
    label: '编码 Agent HTTP 超时',
    required: false,
    modules: g(['coding']),
  },
  {
    key: 'CODING_LLM_MODEL',
    label: '编码专用模型（若实现侧读取）',
    required: false,
    modules: g(['coding', 'general']),
  },
  {
    key: 'REVIEW_AGENT_PORT',
    label: '审核 Agent 端口',
    required: false,
    modules: g(['general', 'review']),
  },
  {
    key: 'REVIEW_AGENT_BASE_URL',
    label: '审核 Agent 基址',
    required: false,
    modules: g(['general', 'review']),
    hint: ENV_HINT_AGENT_HTTP_BASE_DERIVES,
  },
  {
    key: 'REVIEW_AGENT_INTERNAL_TOKEN',
    label: '审核 Agent 内部 Token',
    required: false,
    modules: g(['review', 'general']),
    sensitive: true,
  },
  {
    key: 'REVIEW_AGENT_HTTP_TIMEOUT_MS',
    label: '审核 Agent HTTP 超时',
    required: false,
    modules: g(['review']),
  },


  {
    key: 'REVIEW_RULES_PROFILE',
    label: '审核配置 profile 名',
    required: false,
    requiredInModules: g(['review']),
    modules: g(['review']),
  },
  {
    key: 'REVIEW_CUSTOM_RULES_DIR',
    label: '客户规则目录',
    required: false,
    modules: g(['review']),
  },
  {
    key: 'REVIEW_RULES_RELOAD_EACH_RUN',
    label: '每次审核重载规则',
    required: false,
    modules: g(['review']),
  },
  {
    key: 'REVIEW_CONFIG_FILES',
    label: '额外评审配置文件（逗号分隔）',
    required: false,
    modules: g(['review']),
  },
  {
    key: 'REVIEW_BLOCKING_COMMAND',
    label: '审核 blocking 命令',
    required: false,
    requiredInModules: g(['review']),
    modules: g(['review']),
  },
  {
    key: 'REVIEW_GATE_TIMEOUT_MS',
    label: '单条门禁超时',
    required: false,
    modules: g(['review']),
  },
  {
    key: 'REVIEW_SKIP_LLM',
    label: '跳过语义审核（仅门禁）',
    required: false,
    modules: g(['review']),
  },
  {
    key: 'REVIEW_LLM_MODEL',
    label: '审核专用模型',
    required: false,
    modules: g(['review', 'general']),
  },
  {
    key: 'REVIEW_LLM_MAX_RETRIES',
    label: '审核 LLM 重试',
    required: false,
    modules: g(['review']),
  },
  {
    key: 'REVIEW_RULES_MAX_CHARS',
    label: '规则拼接最大字符',
    required: false,
    modules: g(['review']),
  },
  {
    key: 'TEST_AGENT_PORT',
    label: '测试 Agent 端口',
    required: false,
    modules: g(['general', 'test']),
  },
  {
    key: 'TEST_AGENT_BASE_URL',
    label: '测试 Agent 基址',
    required: false,
    modules: g(['general', 'test']),
    hint: ENV_HINT_AGENT_HTTP_BASE_DERIVES,
  },
  {
    key: 'TEST_AGENT_INTERNAL_TOKEN',
    label: '测试 Agent 内部 Token',
    required: false,
    modules: g(['test', 'general']),
    sensitive: true,
  },
  {
    key: 'TEST_AGENT_HTTP_TIMEOUT_MS',
    label: '测试 Agent HTTP 超时',
    required: false,
    modules: g(['test']),
  },
  {
    key: 'TEST_GATE_TIMEOUT_MS',
    label: '全量测试门禁超时',
    required: false,
    modules: g(['test']),
  },
  {
    key: 'PIPELINE_FULL_TEST_COMMAND',
    label: '流水线全测命令覆盖',
    required: false,
    requiredInModules: g(['test']),
    modules: g(['test', 'general']),
  },
  {
    key: 'OPS_AGENT_PORT',
    label: '运维 Agent 端口',
    required: false,
    modules: g(['general', 'ops']),
  },
  {
    key: 'PACK_BUILD_OUTPUT_DIR',
    label: '构建产出目录',
    required: false,
    modules: g(['ops', 'general']),
  },
  {
    key: 'PACK_ARTIFACT_LOCAL_DIR',
    label: '产物本地目录',
    required: false,
    modules: g(['ops']),
  },
  {
    key: 'PACK_STAGING_DIR',
    label: '暂存目录',
    required: false,
    modules: g(['ops']),
  },
  {
    key: 'DEPLOY_SSH_HOST',
    label: '部署 SSH 主机',
    required: false,
    requiredInModules: g(['ops']),
    modules: g(['ops', 'serverProbe']),
  },
  {
    key: 'DEPLOY_SSH_USER',
    label: '部署 SSH 用户',
    required: false,
    requiredInModules: g(['ops']),
    modules: g(['ops', 'serverProbe']),
  },
  {
    key: 'DEPLOY_SSH_PORT',
    label: '部署 SSH 端口',
    required: false,
    modules: g(['ops']),
  },
  {
    key: 'DEPLOY_REMOTE_PATH',
    label: '远端部署路径',
    required: false,
    requiredInModules: g(['ops']),
    modules: g(['ops', 'serverProbe']),
  },
  {
    key: 'OPS_BACKUP_BEFORE_DEPLOY',
    label: '发布前备份',
    required: false,
    modules: g(['ops']),
  },
  {
    key: 'OPS_BACKUP_REMOTE_PARENT',
    label: '远端备份父目录',
    required: false,
    modules: g(['ops']),
  },
  {
    key: 'OPS_BACKUP_KEEP_REVISIONS',
    label: '保留备份份数',
    required: false,
    modules: g(['ops']),
  },
  {
    key: 'OPS_ABORT_PUBLISH_IF_BACKUP_FAILS',
    label: '备份失败则中止发布',
    required: false,
    modules: g(['ops']),
  },
  {
    key: 'OPS_ROLLBACK_SCRIPT_NAME',
    label: '回滚脚本文件名',
    required: false,
    modules: g(['ops']),
  },
  {
    key: 'OPS_ROLLBACK_REQUIRE_CONFIRM',
    label: '回滚需飞书确认',
    required: false,
    modules: g(['ops']),
  },
  {
    key: 'AGENTS_GENERATED_OPS_DIR',
    label: '生成运维脚本目录',
    required: false,
    modules: g(['ops', 'general']),
  },
  {
    key: 'AGENTS_OPS_MANIFEST',
    label: '运维 manifest 路径',
    required: false,
    modules: g(['ops']),
  },
  {
    key: 'AGENTS_OPS_ENFORCE_MANIFEST_FINGERPRINT',
    label: '强制 manifest 指纹',
    required: false,
    modules: g(['ops']),
  },
  {
    key: 'OPS_PROBE_LISTEN_PORTS',
    label: '巡检关注端口（逗号分隔）',
    required: false,
    requiredInModules: g(['serverProbe']),
    modules: g(['serverProbe', 'ops']),
  },
  {
    key: 'OPS_PROBE_RUN_SS_LNTP',
    label: '远端执行 ss 监听检查',
    required: false,
    modules: g(['serverProbe']),
  },
  {
    key: 'OPS_PROBE_RUN_HOST_INFO',
    label: '采集主机信息摘要',
    required: false,
    modules: g(['serverProbe']),
  },
  {
    key: 'OPS_PROBE_SYSTEMD_UNITS',
    label: 'systemd 单元列表（逗号分隔）',
    required: false,
    modules: g(['serverProbe']),
  },
  {
    key: 'OPS_PROBE_DOCKER_PS',
    label: '执行 docker ps',
    required: false,
    modules: g(['serverProbe']),
  },
];

export const ENV_CATALOG_KEY_SET = new Set(
  ENV_FIELD_CATALOG.map((f) => f.key),
);

export const moduleOrderForModulesInCatalog =
  (): readonly IConsoleModuleId[] =>
    CONSOLE_MODULE_ORDER.filter((id) =>
      ENV_FIELD_CATALOG.some((f) => f.modules.includes(id)),
    );
