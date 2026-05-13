export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly detail?: unknown;

  constructor(statusCode: number, code: string, message: string, detail?: unknown) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
    this.detail = detail;
  }
}
