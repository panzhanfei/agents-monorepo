import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteProjectChatConversation,
  deleteProjectConversationMessages,
  fetchProjectChatConversations,
  fetchProjectChatMessages,
  patchProjectChatConversation,
  postProjectChatConversation,
  postProjectChatMessage,
} from "@/api";

export const projectChatConversationsQueryKey = (
  projectId: string,
): [string, string, "chat", "conversations"] => ["project", projectId, "chat", "conversations"];

export const projectChatMessagesQueryKey = (
  projectId: string,
  conversationId: string,
): [string, string, "chat", "conversation", string, "messages"] => [
  "project",
  projectId,
  "chat",
  "conversation",
  conversationId,
  "messages",
];

export const invalidateProjectChatQueries = (
  qc: { invalidateQueries: (opts: { queryKey: readonly unknown[] }) => Promise<unknown> },
  projectId: string,
): Promise<unknown> =>
  qc.invalidateQueries({ queryKey: ["project", projectId, "chat"] });

export const useProjectChatConversationsQuery = (projectId: string) =>
  useQuery({
    queryKey: projectChatConversationsQueryKey(projectId),
    queryFn: () => fetchProjectChatConversations(projectId),
    enabled: projectId.length > 0,
  });

export const useProjectChatMessagesQuery = (projectId: string, conversationId: string) =>
  useQuery({
    queryKey: projectChatMessagesQueryKey(projectId, conversationId),
    queryFn: () => fetchProjectChatMessages(projectId, conversationId),
    enabled: projectId.length > 0 && conversationId.length > 0,
  });

export const useCreateProjectChatConversationMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { projectId: string; title?: string }) =>
      postProjectChatConversation(vars.projectId, vars.title ? { title: vars.title } : {}),
    onSuccess: (_data, vars) => void invalidateProjectChatQueries(qc, vars.projectId),
  });
};

export const usePatchProjectChatConversationMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      projectId: string;
      conversationId: string;
      title?: string | null;
      pinned?: boolean;
    }) =>
      patchProjectChatConversation(vars.projectId, vars.conversationId, {
        ...(vars.title !== undefined ? { title: vars.title } : {}),
        ...(vars.pinned !== undefined ? { pinned: vars.pinned } : {}),
      }),
    onSuccess: (_data, vars) => void invalidateProjectChatQueries(qc, vars.projectId),
  });
};

export const useAppendProjectChatMessageMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      projectId: string;
      conversationId: string;
      role: "user" | "assistant" | "system";
      content: string;
    }) =>
      postProjectChatMessage(vars.projectId, vars.conversationId, {
        role: vars.role,
        content: vars.content,
      }),
    onSuccess: (_data, vars) => void invalidateProjectChatQueries(qc, vars.projectId),
  });
};

export const useClearConversationMessagesMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { projectId: string; conversationId: string }) =>
      deleteProjectConversationMessages(vars.projectId, vars.conversationId),
    onSuccess: (_data, vars) => void invalidateProjectChatQueries(qc, vars.projectId),
  });
};

export const useDeleteProjectChatConversationMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { projectId: string; conversationId: string }) =>
      deleteProjectChatConversation(vars.projectId, vars.conversationId),
    onSuccess: (_data, vars) => void invalidateProjectChatQueries(qc, vars.projectId),
  });
};
