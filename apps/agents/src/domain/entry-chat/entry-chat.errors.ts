export class EntryChatConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntryChatConfigError";
  }
}

export class AgentSlotsAccessError extends Error {
  readonly httpStatus: number;

  constructor(message: string, httpStatus: number) {
    super(message);
    this.name = "AgentSlotsAccessError";
    this.httpStatus = httpStatus;
  }
}
