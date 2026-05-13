export type {
  IAuthMeResponse,
  IAuthSessionResponse,
  IAuthUser,
  ICreateProjectBody,
  IEnqueueTaskBody,
  IProjectMutationResponse,
  IProjectRow,
  IProjectsListResponse,
  IRunnerRegisterResponse,
  IRunnerRow,
  IRunnersListResponse,
  ITaskDetailResponse,
  ITaskRow,
  ITasksListResponse,
} from "@agents/shared-types";

export type IApiErrorBody = {
  code?: string;
  message?: string;
  traceId?: string;
};

export type IFetchJsonOptions = RequestInit & {
  auth?: boolean;
};
