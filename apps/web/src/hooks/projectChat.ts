import { useMutation, useQuery } from "@tanstack/react-query";
import {
  fetchProjectChatMessages,
  postProjectChatMessage,
} from "@/api";

export const projectChatQueryKey = (projectId: string): [string, string, "chat"] => [
  "project",
  projectId,
  "chat",
];

export const useProjectChatQuery = (projectId: string) =>
  useQuery({
    queryKey: projectChatQueryKey(projectId),
    queryFn: () => fetchProjectChatMessages(projectId),
    enabled: projectId.length > 0,
  });

export const useAppendProjectChatMessageMutation = () =>
  useMutation({
    mutationFn: (vars: { projectId: string; role: "user" | "assistant" | "system"; content: string }) =>
      postProjectChatMessage(vars.projectId, { role: vars.role, content: vars.content }),
  });
