import { fetchTaskById, type ITaskRow } from "@/api";

export const subscribeTaskDetailPolling = (
  taskId: string,
  pollMs: number,
  onTask: (task: ITaskRow) => void,
): (() => void) => {
  void fetchTaskById(taskId)
    .then((res) => onTask(res.task))
    .catch(() => undefined);
  const id = window.setInterval(() => {
    void fetchTaskById(taskId)
      .then((res) => onTask(res.task))
      .catch(() => undefined);
  }, pollMs);
  return () => window.clearInterval(id);
};
