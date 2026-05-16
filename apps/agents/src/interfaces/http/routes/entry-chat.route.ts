import type express from "express";
import { z } from "zod";
import { streamEntryChatEvents } from "@/application";
import { AgentSlotsAccessError } from "@/domain";
import type { IAppRuntime } from "../runtime";
import { writeEntryChatSseEvent } from "../sse";

const chatMessageIn = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(32_000),
});

const entryChatRequest = z.object({
  messages: z.array(chatMessageIn).min(1).max(80),
  projectId: z.string().max(128).optional(),
});

export const mountEntryChatRoute = (
  app: express.Express,
  runtime: IAppRuntime,
): void => {
  app.post("/v1/agent/entry/chat", async (req, res) => {
    const parsed = entryChatRequest.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "请求体无效" });
      return;
    }

    const messages = parsed.data.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const gen = streamEntryChatEvents(
      {
        messages,
        budget: {
          budgetTotal: runtime.config.entryChatRoundTokenBudget,
          routerOverhead: runtime.config.entryChatRouterOverheadTokens,
        },
      },
      { slots: runtime.agentSlots, llm: runtime.llm },
    );

    let first;
    try {
      first = await gen.next();
    } catch (e) {
      if (e instanceof AgentSlotsAccessError) {
        const st = e.httpStatus;
        if (st === 401 || st === 403) {
          res
            .status(502)
            .json({ message: "Runner 设备凭据无效或已过期，请重新注册或一键绑定。" });
          return;
        }
        res.status(502).json({ message: "无法从控制面读取 Agent 槽位" });
        return;
      }
      res.status(502).json({
        message:
          e instanceof Error && e.message
            ? e.message.slice(0, 400)
            : "入口对话初始化失败，请稍后重试。",
      });
      return;
    }

    if (first.done) return;

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.flushHeaders?.();

    try {
      writeEntryChatSseEvent(res, first.value);
      for await (const ev of gen) {
        writeEntryChatSseEvent(res, ev);
        if (ev.type === "error") break;
      }
    } catch (e) {
      const tail = e instanceof Error && e.message ? `（${e.message.slice(0, 200)}）` : "";
      writeEntryChatSseEvent(res, { type: "error", message: `模型调用失败，请稍后重试。${tail}` });
    }
    res.end();
  });
};
