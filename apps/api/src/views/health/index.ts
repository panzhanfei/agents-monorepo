export type IHealthPayload = { ok: true };

export const livenessPayload = (): IHealthPayload => ({ ok: true });
