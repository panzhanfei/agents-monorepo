export type {
  IAgentInferenceMode,
  IAgentInferencePublic,
  IAgentSlotKey,
  IAgentSlotPublic,
  IAuthMeResponse,
  IAuthRefreshResponse,
  IAuthSessionResponse,
  IAuthInferenceTestBody,
  IAuthInferenceTestResponse,
  IAuthPatchAgentSlotBody,
  IAuthPatchMeBody,
  IAuthUser,
  ICreateProjectBody,
  IEnqueueTaskBody,
  IProjectMutationResponse,
  IProjectRow,
  IProjectsListResponse,
  IUpdateProjectBody,
  IRunnerRegisterResponse,
  IRunnerRow,
  IRunnersListResponse,
  ITaskDetailResponse,
  ITaskRow,
  ITasksListResponse,
} from "@agents/shared-types";
export { AGENT_SLOT_KEYS } from "@agents/shared-types";

export type IApiErrorBody = {
  code?: string;
  message?: string;
  traceId?: string;
};

export type IFetchJsonOptions = RequestInit & {
  auth?: boolean;
  /** @internal */
  _refreshAttempted?: boolean;
};
