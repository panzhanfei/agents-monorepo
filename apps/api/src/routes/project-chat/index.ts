import { Router } from "express";
import { projectChatController } from "@/controllers/project-chat";

export const projectChatRouter = Router({ mergeParams: true });

projectChatRouter.get("/conversations", projectChatController.getConversations);
projectChatRouter.post("/conversations", projectChatController.postConversation);
projectChatRouter.patch("/conversations/:conversationId", projectChatController.patchConversation);
projectChatRouter.delete("/conversations/:conversationId", projectChatController.deleteConversation);
projectChatRouter.get(
  "/conversations/:conversationId/messages",
  projectChatController.getMessages,
);
projectChatRouter.post(
  "/conversations/:conversationId/messages",
  projectChatController.postMessage,
);
projectChatRouter.delete(
  "/conversations/:conversationId/messages",
  projectChatController.deleteMessages,
);
