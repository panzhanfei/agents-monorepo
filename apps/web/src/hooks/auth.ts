import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { IAuthPatchMeBody } from "@agents/shared-types";
import { ApiError, fetchMe, patchAuthMe, postLogin, postRegister, type ILoginBody } from "@/api";
import { useAuth } from "@/auth";
import { queryKeys } from "@/query/keys";

export const useMeQuery = () => {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: fetchMe,
    enabled: Boolean(accessToken),
    staleTime: 60_000,
  });
};

export const useLoginMutation = () => {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: ILoginBody) => postLogin(body),
    onSuccess: (res) => {
      setSession(res.accessToken, res.refreshToken, res.user);
      qc.setQueryData(queryKeys.auth.me, { user: res.user });
      void qc.invalidateQueries({ queryKey: queryKeys.auth.me });
      navigate("/projects", { replace: true });
    },
  });
};

export const useRegisterMutation = () => {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: ILoginBody) => postRegister(body),
    onSuccess: (res) => {
      setSession(res.accessToken, res.refreshToken, res.user);
      qc.setQueryData(queryKeys.auth.me, { user: res.user });
      void qc.invalidateQueries({ queryKey: queryKeys.auth.me });
      navigate("/projects", { replace: true });
    },
  });
};

const createMePatchSuccess =
  (qc: QueryClient, reloadProfile: () => Promise<void>) =>
  async (): Promise<void> => {
    void qc.invalidateQueries({ queryKey: queryKeys.auth.me });
    await reloadProfile();
  };

export const usePatchAuthMeMutation = () => {
  const qc = useQueryClient();
  const { reloadProfile } = useAuth();

  return useMutation({
    mutationFn: (body: IAuthPatchMeBody) => patchAuthMe(body),
    onSuccess: createMePatchSuccess(qc, reloadProfile),
  });
};

export const getMutationErrorMessage = (e: unknown, fallback: string): string =>
  e instanceof ApiError ? e.message : fallback;
