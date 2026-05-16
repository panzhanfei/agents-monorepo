import {
  Box,
  Button,
  Flex,
  Heading,
  Spinner,
  Text,
  TextField,
} from "@radix-ui/themes";
import { Link as RouterLink } from "react-router-dom";
import { getRunnerBase } from "@/api";
import { DIALOGUE_SHELL } from "../constants";
import type { IProjectDialoguePageViewModel } from "../useProjectDialoguePage";
import { conversationRowLabel, tokenBarColorVar } from "../utils";
import { PanelCollapseStrip } from "./PanelCollapseStrip";

export type IProjectDialoguePageViewProps = {
  vm: IProjectDialoguePageViewModel;
};

export const ProjectDialoguePageView = ({
  vm,
}: IProjectDialoguePageViewProps) => {
  const {
    projectId,
    conversationId,
    project,
    setSearchParams,
    lines,
    input,
    setInput,
    logLines,
    sending,
    budgetRemaining,
    budgetTotal,
    editingConversationId,
    setEditingConversationId,
    editingTitleDraft,
    setEditingTitleDraft,
    sessionListCollapsed,
    setSessionListCollapsed,
    logsCollapsed,
    setLogsCollapsed,
    convScrollParentRef,
    msgsScrollParentRef,
    logsScrollParentRef,
    conversationsQ,
    messagesQ,
    clearMsgsM,
    deleteConvM,
    patchConvM,
    startNewConversationRound,
    clearCurrentConversationMessages,
    deleteConversationRow,
    saveConversationTitle,
    onSend,
    chatLoading,
    budgetLabel,
    tokenPct,
    conversations,
    sidebarBusy,
    conversationVirtualizer,
    msgVirtualizer,
    logVirtualizer,
  } = vm;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-hidden">
      <Flex
        align="start"
        justify="between"
        gap="4"
        wrap="wrap"
        className="shrink-0"
      >
        <Box>
          <Heading size="6" mb="1">
            对话
          </Heading>
          <Text color="gray" size="2" highContrast={false}>
            <RouterLink to="/projects" className="text-inherit">
              ← 返回项目列表
            </RouterLink>
            {project
              ? ` · ${project.name}`
              : projectId
                ? ` · ${projectId}`
                : null}
          </Text>
          <Text color="gray" size="2" highContrast={false} mt="1">
            消息按<strong>会话</strong>保存在云端（左侧列表切换）。推理走本机
            Agents（apps/agents）；{getRunnerBase()}
            ，可用 VITE_RUNNER_BASE 覆盖。
          </Text>
        </Box>
        <Flex gap="2" wrap="wrap" justify="end">
          <Button type="button" size="2" variant="soft" color="gray" asChild>
            <RouterLink to={`/projects/${projectId}/config`}>配置</RouterLink>
          </Button>
          <Button type="button" size="2" variant="soft" color="gray" asChild>
            <RouterLink to={`/projects/${projectId}/tasks`}>任务</RouterLink>
          </Button>
        </Flex>
      </Flex>

      <Flex
        direction={{ initial: "column", lg: "row" }}
        gap="3"
        className="min-h-[min(29rem,calc(100dvh-14rem))] min-w-0 flex-1 basis-0 items-stretch overflow-hidden"
      >
        {sessionListCollapsed ? (
          <PanelCollapseStrip
            label="会话列表"
            side="left"
            onExpand={() => setSessionListCollapsed(false)}
          />
        ) : (
          <section
            className={`${DIALOGUE_SHELL} flex min-h-0 w-full max-w-[308px] flex-none self-stretch flex-col p-4 lg:w-[308px]`}
          >
            <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden">
              <Flex direction="column" className="min-h-0 shrink-0" gap="2">
                <Flex align="center" justify="between" gap="2" wrap="wrap">
                  <Heading size="4" mb="0">
                    会话列表
                  </Heading>
                  <Button
                    type="button"
                    size="1"
                    variant="ghost"
                    color="gray"
                    onClick={() => setSessionListCollapsed(true)}
                  >
                    收起
                  </Button>
                </Flex>
                <Button
                  type="button"
                  size="1"
                  variant="soft"
                  mb="0"
                  disabled={sending || sidebarBusy || !projectId}
                  onClick={() => void startNewConversationRound("manual")}
                >
                  新会话
                </Button>
              </Flex>
              <Box
                ref={convScrollParentRef}
                className="min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] touch-pan-y [scrollbar-gutter:stable]"
              >
                {conversationsQ.isError ? (
                  <Text color="red" size="2">
                    无法加载会话列表。
                  </Text>
                ) : sidebarBusy ? (
                  <Flex align="center" gap="2">
                    <Spinner size="2" />
                    <Text color="gray" size="2" highContrast={false}>
                      加载中…
                    </Text>
                  </Flex>
                ) : (
                  <div
                    className="relative w-full"
                    style={{
                      height: `${conversationVirtualizer.getTotalSize()}px`,
                    }}
                  >
                    {conversationVirtualizer.getVirtualItems().map((vi) => {
                      const c = conversations[vi.index];
                      if (!c) return null;
                      const active = c.id === conversationId;
                      const isEditing = editingConversationId === c.id;
                      return (
                        <div
                          key={vi.key}
                          data-index={vi.index}
                          ref={conversationVirtualizer.measureElement}
                          className="absolute left-0 top-0 w-full pb-2"
                          style={{ transform: `translateY(${vi.start}px)` }}
                        >
                          <Flex
                            direction="column"
                            gap="2"
                            p="2"
                            className={[
                              "rounded-lg border-l-[3px]",
                              c.pinned
                                ? "border-l-[var(--amber-9)]"
                                : "border-l-transparent",
                              active
                                ? "bg-[var(--accent-a3)]"
                                : "bg-[var(--gray-a2)]",
                            ].join(" ")}
                          >
                            {isEditing ? (
                              <Flex direction="column" gap="2">
                                <TextField.Root
                                  placeholder="会话标题（留空则恢复默认展示）"
                                  value={editingTitleDraft}
                                  maxLength={200}
                                  onChange={(evt) =>
                                    setEditingTitleDraft(evt.target.value)
                                  }
                                  disabled={patchConvM.isPending}
                                />
                                <Flex gap="2" justify="end" wrap="wrap">
                                  <Button
                                    type="button"
                                    size="1"
                                    variant="soft"
                                    disabled={patchConvM.isPending}
                                    onClick={() => {
                                      setEditingConversationId(null);
                                      setEditingTitleDraft("");
                                    }}
                                  >
                                    取消
                                  </Button>
                                  <Button
                                    type="button"
                                    size="1"
                                    disabled={patchConvM.isPending}
                                    onClick={() => void saveConversationTitle()}
                                  >
                                    {patchConvM.isPending ? "保存中…" : "保存"}
                                  </Button>
                                </Flex>
                              </Flex>
                            ) : (
                              <>
                                <Flex align="center" gap="2" wrap="wrap">
                                  <Button
                                    type="button"
                                    size="1"
                                    variant={c.pinned ? "solid" : "soft"}
                                    color={c.pinned ? "amber" : "gray"}
                                    disabled={patchConvM.isPending || sending}
                                    title={c.pinned ? "取消置顶" : "置顶"}
                                    onClick={(evt) => {
                                      evt.preventDefault();
                                      void patchConvM.mutateAsync({
                                        projectId,
                                        conversationId: c.id,
                                        pinned: !c.pinned,
                                      });
                                    }}
                                  >
                                    {c.pinned ? "取消置顶" : "置顶"}
                                  </Button>
                                  <Box
                                    className="min-w-0 flex-[1_1_120px] cursor-pointer"
                                    onClick={() =>
                                      setSearchParams(
                                        { conversationId: c.id },
                                        { replace: true }
                                      )
                                    }
                                  >
                                    <Text
                                      size="2"
                                      weight={active ? "bold" : "medium"}
                                      asChild
                                    >
                                      <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                                        {conversationRowLabel(c)}
                                      </span>
                                    </Text>
                                  </Box>
                                </Flex>
                                <Flex gap="2" justify="end" wrap="wrap">
                                  <Button
                                    type="button"
                                    size="1"
                                    variant="ghost"
                                    disabled={patchConvM.isPending || sending}
                                    onClick={(evt) => {
                                      evt.preventDefault();
                                      setEditingConversationId(c.id);
                                      setEditingTitleDraft(
                                        c.title?.trim() ?? ""
                                      );
                                    }}
                                  >
                                    改名
                                  </Button>
                                  <Button
                                    type="button"
                                    size="1"
                                    variant="ghost"
                                    color="red"
                                    disabled={deleteConvM.isPending || sending}
                                    onClick={(evt) => {
                                      evt.preventDefault();
                                      void deleteConversationRow(c.id);
                                    }}
                                  >
                                    删除
                                  </Button>
                                </Flex>
                              </>
                            )}
                          </Flex>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Box>
            </div>
          </section>
        )}

        <Flex
          direction="column"
          gap="4"
          className="min-h-0 min-w-0 flex-1 basis-0 overflow-hidden"
        >
          <Flex
            direction={{ initial: "column", md: "row" }}
            gap="4"
            className="min-h-0 min-w-0 flex-1 basis-0 items-stretch overflow-hidden"
          >
            <section
              className={`${DIALOGUE_SHELL} min-h-0 min-w-0 flex-1 basis-0 p-4`}
            >
              <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3 overflow-hidden">
                <Flex
                  align="center"
                  justify="between"
                  gap="3"
                  wrap="wrap"
                  className="min-h-0 shrink-0"
                >
                  <Heading size="4" mb="0">
                    会话
                  </Heading>
                  <Flex align="center" gap="2" wrap="wrap">
                    <Button
                      type="button"
                      size="1"
                      variant="soft"
                      disabled={sending || sidebarBusy || !projectId}
                      onClick={() => void startNewConversationRound("manual")}
                    >
                      新会话
                    </Button>
                    <Button
                      type="button"
                      size="1"
                      variant="soft"
                      color="red"
                      disabled={
                        sending ||
                        messagesQ.isPending ||
                        clearMsgsM.isPending ||
                        !projectId ||
                        conversationId.length === 0
                      }
                      onClick={() => void clearCurrentConversationMessages()}
                    >
                      {clearMsgsM.isPending ? "清空中…" : "清空对话"}
                    </Button>
                  </Flex>
                </Flex>

                <Box className="min-h-0 shrink-0">
                  <Flex
                    justify="between"
                    align="center"
                    gap="2"
                    wrap="wrap"
                    mb="1"
                  >
                    <Text size="1" color="gray" highContrast={false}>
                      本轮 Token（估算）
                    </Text>
                    <Text size="1" color="gray" highContrast={false}>
                      剩余 <strong>{budgetLabel}</strong>
                      {tokenPct !== null ? (
                        <span className="ml-1 opacity-90">
                          · {Math.round(tokenPct)}%
                        </span>
                      ) : null}
                    </Text>
                  </Flex>
                  {tokenPct !== null ? (
                    <Box
                      role="progressbar"
                      aria-valuenow={budgetRemaining ?? undefined}
                      aria-valuemin={0}
                      aria-valuemax={budgetTotal ?? undefined}
                      className="h-1 overflow-hidden rounded-full bg-[var(--gray-a4)]"
                    >
                      <Box
                        className="h-full transition-[width] duration-300 ease-in-out"
                        style={{
                          width: `${tokenPct}%`,
                          background: tokenBarColorVar(tokenPct),
                        }}
                      />
                    </Box>
                  ) : (
                    <Text size="1" color="gray" highContrast={false}>
                      发送消息后随 Runner SSE 更新。
                    </Text>
                  )}
                  {messagesQ.isError ? (
                    <Text color="red" size="2" mt="2">
                      无法加载当前会话消息。
                    </Text>
                  ) : null}
                </Box>

                <Box
                  ref={msgsScrollParentRef}
                  className="relative z-0 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] touch-pan-y [scrollbar-gutter:stable]"
                >
                  {conversationId.length === 0 ? (
                    <Flex align="center" justify="center" py="8">
                      <Text color="gray" size="2" highContrast={false}>
                        正在准备会话…
                      </Text>
                    </Flex>
                  ) : chatLoading ? (
                    <Flex align="center" justify="center" gap="2" py="8">
                      <Spinner size="2" />
                      <Text color="gray" size="2" highContrast={false}>
                        正在加载历史消息…
                      </Text>
                    </Flex>
                  ) : lines.length === 0 ? (
                    <Flex align="center" justify="center" py="8" px="2">
                      <Text
                        color="gray"
                        size="2"
                        highContrast={false}
                        className="text-center"
                      >
                        尚无消息。请确认本机 apps/agents 已启动（默认
                        3998），并已在「Agent 配置」中填写 router
                        槽位的模型与网关。
                      </Text>
                    </Flex>
                  ) : (
                    <div
                      className="relative mx-auto w-full max-w-2xl px-1 py-2"
                      style={{ height: `${msgVirtualizer.getTotalSize()}px` }}
                    >
                      {msgVirtualizer.getVirtualItems().map((vi) => {
                        const m = lines[vi.index];
                        if (!m) return null;
                        return (
                          <div
                            key={vi.key}
                            data-index={vi.index}
                            ref={msgVirtualizer.measureElement}
                            className="absolute left-0 top-0 w-full pb-3"
                            style={{ transform: `translateY(${vi.start}px)` }}
                          >
                            <Box
                              px="3"
                              py="2"
                              className={[
                                "max-w-[min(92%,36rem)] rounded-2xl text-[15px] leading-relaxed",
                                m.role === "user"
                                  ? "ml-auto bg-[var(--gray-a4)] text-[var(--gray-12)]"
                                  : "mr-auto border border-[var(--gray-a6)] bg-[var(--gray-a3)] text-[var(--gray-12)]",
                              ].join(" ")}
                            >
                              <Text size="1" weight="bold" mb="1" color="gray">
                                {m.role === "user" ? "你" : "入口 Agent"}
                              </Text>
                              <Text
                                size="2"
                                className="whitespace-pre-wrap break-words"
                              >
                                {m.text}
                              </Text>
                            </Box>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Box>

                <form onSubmit={onSend} className="min-h-0 shrink-0">
                  <Box className="rounded-2xl border border-[var(--gray-a7)] bg-[var(--gray-a3)] p-3 shadow-[0_12px_40px_-16px_rgb(0_0_0/0.45)]">
                    <Flex gap="3" align="end">
                      <Box className="min-w-0 flex-1 [&_.rt-TextFieldInput]:min-h-[44px] [&_.rt-TextFieldInput]:rounded-xl [&_.rt-TextFieldInput]:border-[var(--gray-a7)] [&_.rt-TextFieldInput]:bg-[var(--gray-a2)]">
                        <TextField.Root
                          placeholder="发消息或输入指令…"
                          value={input}
                          onChange={(evt) => setInput(evt.target.value)}
                          disabled={
                            sending ||
                            messagesQ.isPending ||
                            conversationId.length === 0
                          }
                        />
                      </Box>
                      <Button
                        type="submit"
                        size="3"
                        disabled={
                          sending ||
                          messagesQ.isPending ||
                          conversationId.length === 0
                        }
                        className="shrink-0 rounded-xl px-5"
                      >
                        {sending ? "生成中…" : "发送"}
                      </Button>
                    </Flex>
                  </Box>
                </form>
              </div>
            </section>

            {logsCollapsed ? (
              <PanelCollapseStrip
                label="日志"
                side="right"
                onExpand={() => setLogsCollapsed(false)}
              />
            ) : (
              <section
                className={`${DIALOGUE_SHELL} flex min-h-0 w-full max-w-[min(360px,42vw)] flex-none self-stretch flex-col p-4 md:w-[320px]`}
              >
                <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden">
                  <Flex
                    align="center"
                    justify="between"
                    gap="2"
                    wrap="wrap"
                    className="min-h-0 shrink-0"
                  >
                    <Heading size="4" mb="0">
                      日志
                    </Heading>
                    <Button
                      type="button"
                      size="1"
                      variant="ghost"
                      color="gray"
                      onClick={() => setLogsCollapsed(true)}
                    >
                      收起
                    </Button>
                  </Flex>
                  <Box
                    ref={logsScrollParentRef}
                    className="min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] touch-pan-y [scrollbar-gutter:stable]"
                  >
                    {logLines.length === 0 ? (
                      <Text
                        color="gray"
                        size="2"
                        highContrast={false}
                        className="break-words pr-2 [font-family:var(--mono-font-family,ui-monospace)]"
                      >
                        与本页 Runner 请求相关的一行级日志。
                      </Text>
                    ) : (
                      <div
                        className="relative w-full pr-2 [font-family:var(--mono-font-family,ui-monospace)]"
                        style={{ height: `${logVirtualizer.getTotalSize()}px` }}
                      >
                        {logVirtualizer.getVirtualItems().map((vi) => (
                          <div
                            key={vi.key}
                            data-index={vi.index}
                            ref={logVirtualizer.measureElement}
                            className="absolute left-0 top-0 w-full pb-1.5 whitespace-pre-wrap break-words text-[length:var(--font-size-2)]"
                            style={{ transform: `translateY(${vi.start}px)` }}
                          >
                            {logLines[vi.index]}
                          </div>
                        ))}
                      </div>
                    )}
                  </Box>
                </div>
              </section>
            )}
          </Flex>
        </Flex>
      </Flex>
    </div>
  );
};
