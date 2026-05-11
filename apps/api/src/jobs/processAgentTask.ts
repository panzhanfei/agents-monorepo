import type { AgentJobPayload } from "../queue/agentQueue.js";
import { prisma } from "../lib/prisma.js";
import { TaskStatus } from "@prisma/client";

export const processAgentJob = async (payload: AgentJobPayload): Promise<void> => {
  const row = await prisma.task.findUnique({
    where: { taskId: payload.taskId },
  });

  if (!row) {
    throw new Error(`Task not found: ${payload.taskId}`);
  }

  if (row.projectId !== payload.projectId) {
    throw new Error("projectId mismatch");
  }

  const runner = await prisma.runnerDevice.findUnique({
    where: { id: row.runnerDeviceId },
  });

  if (!runner || runner.deviceKey !== payload.runnerDeviceKey) {
    throw new Error("runnerDeviceKey mismatch");
  }

  await prisma.task.update({
    where: { id: row.id },
    data: { status: TaskStatus.PROCESSING },
  });

  // 占位：真实 Agent 在此执行；仅模拟异步耗时
  await new Promise((r) => setTimeout(r, 50));

  await prisma.task.update({
    where: { id: row.id },
    data: { status: TaskStatus.COMPLETED },
  });
};

export const markTaskFailed = async (taskId: string, message: string): Promise<void> => {
  await prisma.task.updateMany({
    where: { taskId },
    data: { status: TaskStatus.FAILED, lastError: message.slice(0, 2000) },
  });
};
