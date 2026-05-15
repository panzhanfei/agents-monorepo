import type { Task } from "@prisma/client";

export const taskEnqueuePayload = (task: Task & { bullmqJobId: string | null }) => ({
  task: { ...task, bullmqJobId: task.bullmqJobId },
});

export const tasksListPayload = (tasks: Task[]) => ({ tasks });

export const taskOnePayload = (task: Task) => ({ task });
