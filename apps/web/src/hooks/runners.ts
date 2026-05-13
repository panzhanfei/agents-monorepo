import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRunners, postRunnerHeartbeat, registerRunner, type IRunnerRegisterBody } from "@/api";
import { useAuth } from "@/auth";
import { queryKeys } from "@/query/keys";

const runnerHeartbeatBody = {
  contractVersion: "0-placeholder",
  mountedProjectIds: [] as string[],
} as const;

export const useRunnersListQuery = () => {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: queryKeys.runners.list(),
    queryFn: fetchRunners,
    select: (d) => d.runners,
    enabled: Boolean(accessToken),
  });
};

export const useRegisterRunnerMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: IRunnerRegisterBody) => registerRunner(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.runners.list() });
    },
  });
};

export type IRunnerHeartbeatVars = {
  deviceKey: string;
  deviceSecret: string;
};

export const useRunnerHeartbeatMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceKey, deviceSecret }: IRunnerHeartbeatVars) =>
      postRunnerHeartbeat(deviceKey, deviceSecret, runnerHeartbeatBody),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.runners.list() });
    },
  });
};
