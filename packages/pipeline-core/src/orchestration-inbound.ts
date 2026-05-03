/**
 * 编排 HTTP 入口分类（Console Web UI vs 飞书等），用于观测与不混淆出站通道。
 * 对应请求 `metadata` 字段 {@link AGENTS_PIPELINE_INBOUND_KIND_META_KEY}。
 */
export type AgentsPipelineInboundKind = 'agent_console' | 'feishu';

/** Agent Console `/api/pipeline/invoke` → orchestrator 时代码写入的值 */
export const AGENTS_PIPELINE_CONSOLE_INBOUND_KIND = 'agent_console' as const;

/** `metadata` 中的键名；不落任务持久化时应由编排层剥离（见 orchestrator stripConsoleRequirementsAttachmentsFromMetadata）。 */
export const AGENTS_PIPELINE_INBOUND_KIND_META_KEY =
  'agentsPipelineInboundKind' as const;
