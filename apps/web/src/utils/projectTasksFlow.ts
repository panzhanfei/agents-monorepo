import type { Dispatch, SetStateAction } from "react";
import {
  ApiError,
  enqueueTask,
  fetchTasksForProject,
  fetchRunners,
  type IRunnerRow,
  type ITaskRow,
} from "@/api";

export type IReloadProjectTasksListsParams = {
  projectId: string;
  runnerDeviceId: string;
  setRunners: Dispatch<SetStateAction<IRunnerRow[]>>;
  setTasks: Dispatch<SetStateAction<ITaskRow[]>>;
  setRunnerDeviceId: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string | null>>;
};

export const runReloadProjectTasksLists = (p: IReloadProjectTasksListsParams): void => {
  const { projectId, runnerDeviceId, setRunners, setTasks, setRunnerDeviceId, setError } = p;
  setError(null);
  void Promise.all([fetchRunners(), fetchTasksForProject(projectId)])
    .then(([r1, r2]) => {
      setRunners(r1.runners);
      setTasks(r2.tasks);
      if (!runnerDeviceId && r1.runners[0]?.id) setRunnerDeviceId(r1.runners[0].id);
    })
    .catch((err: unknown) => {
      const msg = err instanceof ApiError ? err.message : "Failed to load";
      setError(msg);
    });
};

export const runEnqueueTask = async (
  projectId: string,
  runnerDeviceId: string,
  payload: Record<string, unknown>,
  afterOk: () => void,
  setError: Dispatch<SetStateAction<string | null>>,
): Promise<void> => {
  setError(null);
  try {
    await enqueueTask({ projectId, runnerDeviceId, payload });
    afterOk();
  } catch (err: unknown) {
    const msg = err instanceof ApiError ? err.message : "Enqueue failed";
    setError(msg);
  }
};
