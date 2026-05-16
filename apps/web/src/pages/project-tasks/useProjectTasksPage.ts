import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { ApiError } from "@/api";
import {
  getTasksMutationErrorMessage,
  useEnqueueTaskMutation,
  useRunnersListQuery,
  useTaskDetailQuery,
  useTasksByProjectQuery,
} from "@/hooks";

export const useProjectTasksPage = () => {
  const params = useParams();
  const projectId = params.projectId ?? "";

  const runnersQ = useRunnersListQuery();
  const tasksQ = useTasksByProjectQuery(projectId);
  const runners = useMemo(() => runnersQ.data ?? [], [runnersQ.data]);
  const tasks = useMemo(() => tasksQ.data ?? [], [tasksQ.data]);

  const [runnerDeviceId, setRunnerDeviceId] = useState("");
  const [payloadText, setPayloadText] = useState("{}");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [pollMs, setPollMs] = useState(2500);
  const [payloadError, setPayloadError] = useState<string | null>(null);

  const detailQ = useTaskDetailQuery(selectedTaskId, pollMs);
  const detail = detailQ.data ?? null;

  const enqueueM = useEnqueueTaskMutation(projectId);

  const selectedRunnerOnline = useMemo(() => {
    const r = runners.find((x) => x.id === runnerDeviceId);
    if (!r?.lastSeenAt) return false;
    const last = new Date(r.lastSeenAt).getTime();
    return Date.now() - last <= 120_000;
  }, [runnerDeviceId, runners]);

  useEffect(() => {
    if (!runnerDeviceId && runners.length > 0) {
      setRunnerDeviceId(runners[0].id);
    }
  }, [runnerDeviceId, runners]);

  const listLoadError = runnersQ.isError
    ? runnersQ.error instanceof ApiError
      ? runnersQ.error.message
      : "Failed to load runners"
    : null;
  const tasksLoadError = tasksQ.isError
    ? tasksQ.error instanceof ApiError
      ? tasksQ.error.message
      : "Failed to load tasks"
    : null;
  const enqueueError = enqueueM.isError ? getTasksMutationErrorMessage(enqueueM.error) : null;
  const error = listLoadError ?? tasksLoadError ?? payloadError ?? enqueueError;

  const onEnqueue = (e: FormEvent): void => {
    e.preventDefault();
    setPayloadError(null);
    enqueueM.reset();
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(payloadText) as Record<string, unknown>;
    } catch {
      setPayloadError("payload 必须是合法 JSON");
      return;
    }
    enqueueM.mutate({ projectId, runnerDeviceId, payload });
  };

  const reloadLists = (): void => {
    void runnersQ.refetch();
    void tasksQ.refetch();
  };

  return {
    projectId,
    runnersQ,
    tasksQ,
    runners,
    tasks,
    runnerDeviceId,
    setRunnerDeviceId,
    payloadText,
    setPayloadText,
    selectedTaskId,
    setSelectedTaskId,
    pollMs,
    setPollMs,
    detailQ,
    detail,
    enqueueM,
    selectedRunnerOnline,
    error,
    onEnqueue,
    reloadLists,
  };
};

export type IProjectTasksPageViewModel = ReturnType<typeof useProjectTasksPage>;
