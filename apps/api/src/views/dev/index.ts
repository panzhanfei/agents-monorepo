export const devWhoamiPayload = (userCount: number) => ({
  ok: true as const,
  userCount,
  note: "Dev-only diagnostics; disable in production unless ENABLE_DEV_ROUTES=true",
});
