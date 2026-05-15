export const agentPreviewPayload = () => ({
  stepKind: "mock.plan" as const,
  mockOutput: {
    message: "Phase 1 stub: replace with real agent routing in phase 2",
    suggestions: ["enqueue a task", "claim from runner"],
  },
});
