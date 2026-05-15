export type IReadyPayload = {
  ok: boolean;
  checks: Record<string, "ok" | "error">;
};

export const toReadyPayload = (ok: boolean, checks: Record<string, "ok" | "error">): IReadyPayload => ({
  ok,
  checks,
});
