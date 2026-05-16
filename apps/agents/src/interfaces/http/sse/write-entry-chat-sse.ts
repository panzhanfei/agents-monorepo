import type express from "express";
import type { IEntryChatSseEvent } from "@/application/entry-chat/stream-entry-chat.use-case";

const writeSseLine = (res: express.Response, event: string, data: string): void => {
  res.write(`event: ${event}\ndata: ${data}\n\n`);
};

export const writeEntryChatSseEvent = (res: express.Response, ev: IEntryChatSseEvent): void => {
  if (ev.type === "route") {
    writeSseLine(
      res,
      "route",
      JSON.stringify({
        nextSlot: ev.nextSlot,
        reason: ev.reason,
        configSlot: ev.configSlot,
      }),
    );
    return;
  }
  if (ev.type === "budget") {
    writeSseLine(res, "budget", JSON.stringify({ remaining: ev.remaining, total: ev.total }));
    return;
  }
  if (ev.type === "token") {
    writeSseLine(res, "token", JSON.stringify({ text: ev.text }));
    return;
  }
  if (ev.type === "budget_exhausted") {
    writeSseLine(res, "budget_exhausted", "{}");
    return;
  }
  if (ev.type === "done") {
    writeSseLine(
      res,
      "done",
      JSON.stringify({ budgetRemaining: ev.budgetRemaining, budgetTotal: ev.budgetTotal }),
    );
    return;
  }
  writeSseLine(res, "error", JSON.stringify({ message: ev.message }));
};
