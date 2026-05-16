import type { IAgentSlotKey } from "@agents/shared-types";
import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/api";
import { getMutationErrorMessage, useMeQuery, usePatchAuthMeMutation } from "@/hooks";
import type { ISlotDraft } from "./interface";
import {
  agentDraftsEqual,
  draftFromServerAgentSlots,
  initialAgentDraftRecord,
  mergeAgentSlotDraft,
  patchBodyFromAgentDraft,
  validateAgentSlotBeforeSave,
} from "./utils";

export const useAgentModelsPage = () => {
  const meQ = useMeQuery();
  const patchM = usePatchAuthMeMutation();

  const agentSlots = meQ.data?.user.agentSlots;

  const [draft, setDraft] = useState<Record<IAgentSlotKey, ISlotDraft>>(initialAgentDraftRecord);
  const [slotErrors, setSlotErrors] = useState<Partial<Record<IAgentSlotKey, string>>>({});

  useEffect(() => {
    if (!agentSlots) return;
    setDraft(draftFromServerAgentSlots(agentSlots));
    setSlotErrors({});
  }, [agentSlots]);

  const loadError = meQ.isError
    ? meQ.error instanceof ApiError
      ? meQ.error.message
      : "Failed to load profile"
    : null;

  const serverSnapshot = useMemo(() => (agentSlots ? draftFromServerAgentSlots(agentSlots) : null), [agentSlots]);

  const patchSlotDraft = (key: IAgentSlotKey, partial: Partial<ISlotDraft>): void => {
    setSlotErrors((prev) => {
      if (prev[key] === undefined) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setDraft((prev) => mergeAgentSlotDraft(prev, key, partial));
  };

  const discardSlot = (key: IAgentSlotKey): void => {
    if (!serverSnapshot) return;
    setSlotErrors((prev) => {
      if (prev[key] === undefined) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setDraft((prev) => ({ ...prev, [key]: serverSnapshot[key] }));
  };

  const saveSlot = (key: IAgentSlotKey): void => {
    const d = draft[key];
    const serverSlot = agentSlots?.[key];
    const validation = validateAgentSlotBeforeSave(d, serverSlot);
    if (validation) {
      setSlotErrors((prev) => ({ ...prev, [key]: validation }));
      return;
    }
    setSlotErrors((prev) => {
      if (prev[key] === undefined) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    const body = patchBodyFromAgentDraft(d);
    patchM.mutate(
      { agentSlots: { [key]: body } },
      {
        onError: (e) => {
          setSlotErrors((prev) => ({
            ...prev,
            [key]: getMutationErrorMessage(e, "保存失败"),
          }));
        },
      },
    );
  };

  return {
    meQ,
    patchM,
    agentSlots,
    draft,
    slotErrors,
    loadError,
    serverSnapshot,
    patchSlotDraft,
    discardSlot,
    saveSlot,
    draftsEqual: agentDraftsEqual,
  };
};

export type IAgentModelsPageViewModel = ReturnType<typeof useAgentModelsPage>;
