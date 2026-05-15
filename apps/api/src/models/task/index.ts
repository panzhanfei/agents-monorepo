import type { InputJsonValue } from "@prisma/client/runtime/library";
import type { Project, RunnerDevice, Task } from "@prisma/client";
import { prisma } from "@/lib";

export const findProjectRowForUser = (userId: string, projectId: string): Promise<Project | null> =>
  prisma.project.findFirst({
    where: { id: projectId, userId },
  });

export const findRunnerForUser = (
  userId: string,
  runnerDeviceId: string,
): Promise<RunnerDevice | null> =>
  prisma.runnerDevice.findFirst({
    where: { id: runnerDeviceId, userId },
  });

export const insertTask = (params: {
  userId: string;
  projectId: string;
  runnerDeviceId: string;
  payload: InputJsonValue;
}): Promise<Task> =>
  prisma.task.create({
    data: {
      userId: params.userId,
      projectId: params.projectId,
      runnerDeviceId: params.runnerDeviceId,
      payload: params.payload,
    },
  });

export const setTaskBullmqJobId = (taskId: string, bullmqJobId: string): Promise<Task> =>
  prisma.task.update({
    where: { id: taskId },
    data: { bullmqJobId },
  });

export const findManyTasksByProjectId = (projectId: string): Promise<Task[]> =>
  prisma.task.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

export const findTaskByUserId = (userId: string, taskId: string): Promise<Task | null> =>
  prisma.task.findFirst({
    where: { id: taskId, userId },
  });
