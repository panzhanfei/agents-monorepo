export type ITaskRow = {
  id: string;
  status: string;
  runnerDeviceId: string;
  payload: unknown;
  lastError: string | null;
  bullmqJobId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ITasksListResponse = {
  tasks: ITaskRow[];
};

export type ITaskDetailResponse = {
  task: ITaskRow;
};

export type IEnqueueTaskBody = {
  projectId: string;
  runnerDeviceId: string;
  payload: Record<string, unknown>;
};
