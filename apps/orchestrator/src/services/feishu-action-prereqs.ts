/**
 * 飞书触发的部分动作在调用下游前做配置自检，避免白跑任务并给出可操作的说明。
 * 与 apps/coding-agent 消费的环境变量对齐（见 coding-run handler）。
 */

export type ICodingFeishuPrereqIssue =
  | 'missing_target_workspace_path'
  | 'invalid_coding_agent_base_url';

export type ICodingFeishuPrereqsOptions = {
  /**
   * 由编排解析后的客户业务仓库根路径（trim 非空）；若给定则不再强求 `TARGET_WORKSPACE_PATH`
   * 环境变量必填（多目标 / 仅从 YAML 提供路径时使用）。
   */
  readonly effectiveWorkspacePathTrimmed?: string;
};

export const collectCodingFeishuPrereqIssues = (
  env: NodeJS.ProcessEnv = process.env,
  opts?: ICodingFeishuPrereqsOptions
): ICodingFeishuPrereqIssue[] => {
  const issues: ICodingFeishuPrereqIssue[] = [];
  const trimmedOpt =
    opts?.effectiveWorkspacePathTrimmed !== undefined &&
    opts.effectiveWorkspacePathTrimmed.trim() !== ''
      ? opts.effectiveWorkspacePathTrimmed.trim()
      : undefined;
  const workspace =
    trimmedOpt ?? (env.TARGET_WORKSPACE_PATH?.trim() ?? '');
  if (workspace === '') {
    issues.push('missing_target_workspace_path');
  }
  const baseRaw = env.CODING_AGENT_BASE_URL?.trim() ?? '';
  if (baseRaw !== '') {
    try {
      const parsed = new URL(baseRaw);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        issues.push('invalid_coding_agent_base_url');
      }
    } catch {
      issues.push('invalid_coding_agent_base_url');
    }
  }
  return issues;
};

export const buildCodingPrereqBlockedFeishuReply = (
  issues: readonly ICodingFeishuPrereqIssue[]
): string => {
  const lines: string[] = [
    '【编码 · 配置自检未通过】',
    '',
    '当前无法向 coding-agent 下发编码任务。请在本仓库根目录的 `.env`（或由部署方注入的同名环境变量）中补齐下面项，保存后**重启** orchestrator 与 coding-agent，再重试「编码：…」。',
    '',
  ];

  if (issues.includes('missing_target_workspace_path')) {
    lines.push(
      '■ 工作区缺失',
      '  编排器无法解析可用的客户仓库根路径。请任选其一：`TARGET_WORKSPACE_PATH`（见 `.env`）；或在 `agents.config.yaml` 的 `target.projects`（多目标）；或先于飞书会话「切换目标：<id>」/「目标列表」。',
      '  （当编排器解析出绝对路径并由请求体下发 `workspacePath` 给 coding-agent 时，可无 `TARGET_WORKSPACE_PATH`。）',
      ''
    );
  }

  if (issues.includes('invalid_coding_agent_base_url')) {
    lines.push(
      '■ 需修正：CODING_AGENT_BASE_URL',
      '  当前值不是合法 URL。请写成完整地址，例如 `http://127.0.0.1:4020`（无尾部多余字符）。',
      ''
    );
  }

  lines.push(
    '— 可选（本机单机默认可不写完整基址）—',
    '• CODING_AGENT_INTERNAL_TOKEN：若 coding-agent 进程配置了 Bearer 校验，编排器侧必须设为**相同**令牌，否则会得到 401。',
    '• `CODING_AGENT_PORT`（或默认值 4020）与 coding-agent 实际监听端口一致即可；不写 `CODING_AGENT_BASE_URL` 时编排器会按 `AGENTS_INTERNAL_HTTP_HOST`（默认同机 127.0.0.1）自动生成 `http://…:端口`。跨机或 HTTPS / 网关再写完整 BASE_URL。',
    '• `agents.config.yaml` 里 `agents.coding-agent.port` 仅供文档与各进程约定，env 仍为权威覆盖。',
    '',
    '更多占位与说明见仓库根目录 `.env.example`。'
  );

  return lines.join('\n');
};
