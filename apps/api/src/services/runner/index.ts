import type { RunnerDevice } from "@prisma/client";
import { generateDeviceKey, generateDeviceSecretPlain, hashDeviceSecret } from "@/lib";
import {
  insertRunnerDevice,
  listRunnerDevicesForUser as listRunnerDeviceRows,
  touchRunnerLastSeen,
} from "@/models/runner";

export const registerRunnerForUser = async (
  userId: string,
  displayName: string | undefined,
): Promise<{
  runner: Pick<RunnerDevice, "id" | "deviceKey" | "displayName" | "createdAt">;
  deviceSecretPlain: string;
}> => {
  const deviceKey = generateDeviceKey();
  const deviceSecretPlain = generateDeviceSecretPlain();
  const secretHash = await hashDeviceSecret(deviceSecretPlain);

  const runner = await insertRunnerDevice({
    user: { connect: { id: userId } },
    deviceKey,
    secretHash,
    displayName,
  });

  return {
    runner: {
      id: runner.id,
      deviceKey: runner.deviceKey,
      displayName: runner.displayName,
      createdAt: runner.createdAt,
    },
    deviceSecretPlain,
  };
};

export const listRunnerDevicesForUser = (userId: string) => listRunnerDeviceRows(userId);

export const touchRunnerHeartbeat = (runnerId: string): Promise<Date> => touchRunnerLastSeen(runnerId);
