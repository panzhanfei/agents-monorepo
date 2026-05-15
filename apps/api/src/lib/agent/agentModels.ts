export const coerceAgentModelsJson = (value: unknown): Record<string, string> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  const obj = value as Record<string, unknown>;
  let count = 0;
  for (const [k, raw] of Object.entries(obj)) {
    if (count >= 40) break;
    if (k.length === 0 || k.length > 64) continue;
    if (typeof raw !== "string") continue;
    const t = raw.trim();
    if (t.length < 1 || t.length > 200) continue;
    out[k] = t;
    count += 1;
  }
  return out;
};
