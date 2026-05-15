export const runnerRegisterPayload = (params: {
  runner: {
    id: string;
    deviceKey: string;
    displayName: string | null;
    createdAt: Date;
  };
  deviceSecretPlain: string;
}) => ({
  runner: {
    id: params.runner.id,
    deviceKey: params.runner.deviceKey,
    displayName: params.runner.displayName,
    createdAt: params.runner.createdAt,
  },
  deviceSecret: params.deviceSecretPlain,
});

export const runnersListPayload = <
  T extends {
    id: string;
    deviceKey: string;
    displayName: string | null;
    lastSeenAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
>(
  runners: T[],
) => ({ runners });

export const heartbeatPayload = (lastSeenAtIso: string) => ({
  ok: true as const,
  lastSeenAt: lastSeenAtIso,
});
