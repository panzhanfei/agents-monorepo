/**
 * 飞书触发的部分动作在调用下游前做配置自检，避免白跑任务并给出可操作的说明。
 * 与 apps/coding-agent 消费的环境变量对齐（见 coding-run handler）。
 */

export type ICodingFeishuPrereqIssue =
  | 'missing_target_workspace_path'
  | 'invalid_coding_agent_base_url';

export const collectCodingFeishuPrereqIssues = (
  env: NodeJS.ProcessEnv = process.env
): ICodingFeishuPrereqIssue[] => {
  const issues: ICodingFeishuPrereqIssue[] = [];
  const workspace = env.TARGET_WORKSPACE_PATH?.trim() ?? '';
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
      '■ 必填：TARGET_WORKSPACE_PATH',
      '  含义：客户业务项目根目录，编码 / 审核 / 全量测试都会在该目录下执行。',
      '  示例：`./workspace/target-repo`（相对 monorepo 根）或本机绝对路径。',
      '  说明：未设置时，coding-agent 视为「未绑定工作区」，编排侧会直接拦截。',
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
    '— 可选（默认连本机 4020 端口即可）—',
    '• CODING_AGENT_INTERNAL_TOKEN：若 coding-agent 进程配置了 Bearer 校验，编排器侧必须设为**相同**令牌，否则会得到 401。',
    '• `agents.config.yaml` 里 `agents.coding-agent.port` 应与实际监听端口一致，并和 `CODING_AGENT_BASE_URL` 对应。',
    '',
    '更多占位与说明见仓库根目录 `.env.example`。'
  );

  return lines.join('\n');
};
