# ARCHITECTURE（待维护）

本文件与 [v1 设计清单与实施进度](./v1-design-and-progress.md) 及控制面实现 **同步填充**，建议收录：

- HTTP / WebSocket / SSE 契约与错误体  
- Runner 心跳字段、在线判定、与入队门禁  
- 消息队列：分区键、幂等、重试、DLQ、失败回写任务状态  
- 部署拓扑与环境变量清单（不含密钥值）

**当前实现入口**：[apps/api README](../apps/api/README.md)。
