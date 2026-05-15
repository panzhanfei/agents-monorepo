import type { Prisma, RunnerDevice } from "@prisma/client";
import { prisma } from "@/lib";

export const insertRunnerDevice = (data: Prisma.RunnerDeviceCreateInput): Promise<RunnerDevice> =>
  prisma.runnerDevice.create({ data });

export const listRunnerDevicesForUser = (userId: string) =>
  prisma.runnerDevice.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      deviceKey: true,
      displayName: true,
      lastSeenAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

export const touchRunnerLastSeen = async (runnerId: string): Promise<Date> => {
  const now = new Date();
  await prisma.runnerDevice.update({
    where: { id: runnerId },
    data: { lastSeenAt: now },
  });
  return now;
};
