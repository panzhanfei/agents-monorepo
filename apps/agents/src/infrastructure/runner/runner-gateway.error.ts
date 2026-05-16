/** Control-plane Runner HTTP failures (heartbeat, later agent-slots, …). */
export class RunnerGatewayError extends Error {
  readonly status?: number;

  readonly bodySnippet?: string;

  constructor(message: string, opts?: { status?: number; bodySnippet?: string }) {
    super(message);
    this.name = "RunnerGatewayError";
    this.status = opts?.status;
    this.bodySnippet = opts?.bodySnippet;
  }
}
