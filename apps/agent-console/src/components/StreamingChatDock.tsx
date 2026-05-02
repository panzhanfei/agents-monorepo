import type { DragEvent, JSX } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import {
  ConsoleTextarea,
  ConsoleTextInput,
} from '~/components/ui/console-input';
import { ConsoleLabel } from '~/components/ui/console-label';
import { ConsoleSelect } from '~/components/ui/console-select';
import {
  persistConsoleBearer,
  readConsoleBearer,
} from '~/lib/console-storage';
import { authorizedJsonHeaders } from '~/lib/request-headers';
import {
  materializeConsoleRequirementAttachments,
  type IMaterializedConsoleAttachments,
} from '~/lib/materialize-requirement-attachments';
import { useThoughtBackdropDrive } from '~/components/thought-backdrop-drive';

export type IChatBubble = {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly taskId?: string;
};

type IInstructionMode =
  | 'llm'
  | 'requirements'
  | 'code'
  | 'review'
  | 'test'
  | 'publish'
  | 'probe'
  | 'help'
  | 'status'
  | 'list_targets';

type IQuote = {
  readonly id: string;
  readonly preview: string;
  readonly taskId?: string;
};

const CONSOLE_PIPELINE_CHANNEL = 'agent-console';

const REQ_FILE_ACCEPT =
  '.txt,.md,.markdown,.json,.yaml,.yml,.csv,.pdf,application/pdf,image/png,image/jpeg,image/webp,image/gif';

const MAX_REQ_PDF_BYTES = 40 * 1024 * 1024;

const REQ_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

type IReqPendingTextish = { readonly id: string; readonly file: File };
type IReqPendingImage = { readonly id: string; readonly file: File };

const isReqPdfFile = (f: File): boolean =>
  f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

const isReqTextFile = (f: File): boolean =>
  isReqPdfFile(f) !== true &&
  (f.type.startsWith('text/') === true ||
    /\.(txt|md|markdown|json|yaml|yml|csv)$/i.test(f.name));

const INSTRUCTION_MODE_OPTIONS: readonly {
  readonly value: IInstructionMode;
  readonly label: string;
}[] = [
  { value: 'llm', label: '自由对话（LLM）' },
  { value: 'requirements', label: '需求分析' },
  { value: 'code', label: '代码编写' },
  { value: 'review', label: '代码审核' },
  { value: 'test', label: '全量测试' },
  { value: 'publish', label: '运维发包' },
  { value: 'probe', label: '服务器巡检' },
  { value: 'help', label: '帮助说明' },
  { value: 'status', label: '任务状态' },
  { value: 'list_targets', label: '目标列表' },
] as const;

const previewForQuote = (content: string, max = 140): string => {
  const oneLine = content.replace(/\s+/g, ' ').trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max)}…`;
};

const composeInstructionText = (
  mode: IInstructionMode,
  input: string,
  quote: IQuote | null,
  opts?: { readonly hasRequirementAttachments?: boolean }
):
  | { ok: true; text: string }
  | { ok: false; error: string } => {
  const t = input.trim();
  const hasAtt = opts?.hasRequirementAttachments === true;
  if (mode === 'llm') {
    return { ok: false, error: 'internal' };
  }
  if (mode === 'requirements') {
    if (quote !== null) {
      if (t === '' && hasAtt !== true) {
        return { ok: false, error: '请填写对 PRD 的补充或修订说明。' };
      }
      if (t === '') {
        return { ok: true, text: '（见上传的文档/截图）' };
      }
      return { ok: true, text: t };
    }
    if (t === '' && hasAtt !== true) {
      return { ok: false, error: '请填写需求说明或添加文档/图片附件。' };
    }
    if (t === '') {
      return { ok: true, text: '需求分析：（需求来源见上传附件）' };
    }
    return { ok: true, text: `需求分析：${t}` };
  }
  if (mode === 'code') {
    if (t === '') {
      return { ok: false, error: '请填写编码说明。' };
    }
    return { ok: true, text: `编码：${t}` };
  }
  if (mode === 'review') {
    return {
      ok: true,
      text: t === '' ? '审核：当前分支全部改动' : `审核：${t}`,
    };
  }
  if (mode === 'test') {
    return { ok: true, text: t === '' ? '指令：全量测试' : `测试：${t}` };
  }
  if (mode === 'publish') {
    return { ok: true, text: t === '' ? '发包' : `发包\n说明：${t}` };
  }
  if (mode === 'probe') {
    return {
      ok: true,
      text: t === '' ? '指令：巡检服务器' : `巡检：${t}`,
    };
  }
  if (mode === 'help') {
    return { ok: true, text: '帮助' };
  }
  if (mode === 'status') {
    return { ok: true, text: '状态' };
  }
  if (mode === 'list_targets') {
    return { ok: true, text: '目标列表' };
  }
  return { ok: false, error: '未知模式' };
};

const extractPipelineReply = (
  json: unknown,
): { text: string; taskId?: string } => {
  if (json === null || typeof json !== 'object') {
    return { text: '（无解析结果）' };
  }
  const o = json as Record<string, unknown>;
  if (typeof o.feishuReplyText === 'string' && o.feishuReplyText !== '') {
    const taskRaw = o.task;
    let taskId: string | undefined;
    if (taskRaw !== null && typeof taskRaw === 'object') {
      const tid = (taskRaw as { taskId?: unknown }).taskId;
      taskId = typeof tid === 'string' ? tid : undefined;
    }
    return { text: o.feishuReplyText, taskId };
  }
  if (typeof o.message === 'string' && o.message !== '') {
    return { text: o.message };
  }
  return { text: JSON.stringify(json).slice(0, 1200) };
};

const formatUserBubbleBody = (
  quote: IQuote | null,
  pipelineText: string,
  att?: { readonly text: number; readonly images: number }
): string => {
  const attNote =
    att !== undefined && (att.text > 0 || att.images > 0)
      ? `\n\n〔待发附件〕文本 ${String(att.text)} · 图 ${String(att.images)}`
      : '';
  if (quote === null) {
    return `${pipelineText}${attNote}`;
  }
  return `〔引用〕${previewForQuote(quote.preview, 180)}\n\n${pipelineText}${attNote}`;
};

/** 粗略解析 OpenAI-style SSE：`data:` JSON chunks；忽略 tool calls */
const accumulateFromSseLine = (
  accumulated: string,
  lineTrimmed: string,
): string => {
  if (!lineTrimmed.startsWith('data:')) {
    return accumulated;
  }
  const payload = lineTrimmed.slice(5).trim();
  if (payload === '[DONE]') {
    return accumulated;
  }
  try {
    const parsed = JSON.parse(payload) as {
      choices?: readonly {
        delta?: { content?: string };
      }[];
    };
    const slice = parsed.choices?.[0]?.delta?.content;
    return slice !== undefined ? `${accumulated}${slice}` : accumulated;
  } catch {
    return accumulated;
  }
};

export type IStreamingChatProps = {
  readonly className?: string;
};

export const StreamingChatDock = ({
  className,
}: IStreamingChatProps): JSX.Element => {
  const [messages, setMessages] = useState<IChatBubble[]>([
    {
      id: 'sys',
      role: 'assistant',
      content:
        '**自由对话** 走 `/api/chat/stream`（LLM）；**流水线指令** 走 `/api/pipeline/invoke` → 编排器 `mock-feishu`，与飞书指令同一套能力。**需求分析** 可选中或拖拽 **暂存** 文档/图片（不会立刻解析）；在下方输入框写好说明后，点击 **「发送」** 才读取 PDF/文本/图并提交流水线。支持 `.txt` / `.md` / JSON、**PDF（文本层；扫描件请用图片 + 视觉模型）**、PNG/JPEG/WebP/GIF。引用 PRD 后再发补充，将像飞书引用回复一样合并修订。请在本机启动 orchestrator（默认 :4010），可在 `.env` 设置 `AGENTS_ORCHESTRATOR_URL`。',
    },
  ]);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const listParentRef = useRef<HTMLDivElement>(null);

  const msgVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: () => 96,
    overscan: 6,
  });

  const [instructionMode, setInstructionMode] =
    useState<IInstructionMode>('llm');
  const [quote, setQuote] = useState<IQuote | null>(null);
  const [reqPendingTextish, setReqPendingTextish] = useState<
    IReqPendingTextish[]
  >([]);
  const [reqPendingImages, setReqPendingImages] = useState<
    IReqPendingImage[]
  >([]);
  const [reqDropHighlight, setReqDropHighlight] = useState(false);
  const reqFileInputRef = useRef<HTMLInputElement>(null);
  const reqPendingSnapRef = useRef({
    textish: [] as IReqPendingTextish[],
    images: [] as IReqPendingImage[],
  });
  reqPendingSnapRef.current = {
    textish: reqPendingTextish,
    images: reqPendingImages,
  };
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bufferRef = useRef('');
  const { setLinked: setBackdropLinked } = useThoughtBackdropDrive();

  useEffect(() => {
    setBackdropLinked(streaming || input.trim().length > 0);
  }, [streaming, input, setBackdropLinked]);

  const tailFingerprint =
    `${String(messages[messages.length - 1]?.id ?? '')}:${String(
      messages[messages.length - 1]?.content.length ?? '',
    )}`;

  useEffect(() => {
    if (instructionMode !== 'requirements') {
      setReqPendingTextish([]);
      setReqPendingImages([]);
    }
  }, [instructionMode]);

  /** 长会话与新块到来时锚定到底（measure 后与 TanStack Virtual 对齐） */
  useLayoutEffect(() => {
    const lastIndex = messages.length - 1;
    if (lastIndex < 0) {
      return;
    }
    msgVirtualizer.scrollToIndex(lastIndex, { align: 'end' });
  }, [messages.length, tailFingerprint, streaming, msgVirtualizer]);

  const ingestReqFilesFromList = (list: FileList | null): void => {
    if (list === null || list.length === 0) {
      return;
    }

    const nextT = [...reqPendingSnapRef.current.textish];
    const nextI = [...reqPendingSnapRef.current.images];
    const errors: string[] = [];
    const MAX_TEXTISH_BYTES = 25 * 1024 * 1024;
    const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

    for (const f of [...list]) {
      const mimeOk =
        f.type.startsWith('image/') === true && REQ_IMAGE_MIMES.has(f.type);

      if (mimeOk) {
        if (nextI.length >= 6) {
          errors.push('图片最多 6 张');
          break;
        }
        if (f.size > MAX_IMAGE_BYTES) {
          errors.push(`${f.name}：图片过大（建议 ≤15MB）`);
          continue;
        }
        nextI.push({
          id: globalThis.crypto.randomUUID(),
          file: f,
        });
        continue;
      }

      if (isReqPdfFile(f)) {
        if (nextT.length >= 8) {
          errors.push('文本类附件最多 8 个');
          break;
        }
        if (f.size > MAX_REQ_PDF_BYTES) {
          errors.push(`${f.name}：PDF 超过 40MB`);
          continue;
        }
        nextT.push({
          id: globalThis.crypto.randomUUID(),
          file: f,
        });
        continue;
      }

      if (isReqTextFile(f)) {
        if (nextT.length >= 8) {
          errors.push('文本类附件最多 8 个');
          break;
        }
        if (f.size > MAX_TEXTISH_BYTES) {
          errors.push(`${f.name}：文件过大（建议 ≤25MB）`);
          continue;
        }
        nextT.push({
          id: globalThis.crypto.randomUUID(),
          file: f,
        });
        continue;
      }

      errors.push(
        `${f.name}：类型不支持（文本 / PDF / PNG / JPEG / WebP / GIF）`
      );
    }

    setReqPendingTextish(nextT);
    setReqPendingImages(nextI);

    if (errors.length > 0) {
      setMessages((p) => [
        ...p,
        {
          id: `e:${String(Date.now())}`,
          role: 'assistant',
          content: `（附件）${errors.slice(0, 5).join('；')}`,
        },
      ]);
    }
  };

  const sendPipeline = async (
    pipelineText: string,
    assistantId: string,
    metadata?: Record<string, unknown>,
    parentMessageId?: string,
  ): Promise<void> => {
    const body: Record<string, unknown> = {
      text: pipelineText,
      channelId: CONSOLE_PIPELINE_CHANNEL,
      ...(parentMessageId !== undefined ? { parentMessageId } : {}),
      ...(metadata !== undefined && Object.keys(metadata).length > 0
        ? { metadata }
        : {}),
    };

    const res = await fetch('/api/pipeline/invoke', {
      method: 'POST',
      headers: authorizedJsonHeaders(),
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as unknown;
    const extracted = extractPipelineReply(json);
    let content = extracted.text;
    if (res.ok !== true) {
      content = `（HTTP ${String(res.status)}）\n${content}`;
    }

    setMessages((prev) =>
      prev.map((x) =>
        x.id === assistantId
          ? {
              ...x,
              content,
              ...(extracted.taskId !== undefined
                ? { taskId: extracted.taskId }
                : {}),
            }
          : x,
      ),
    );
  };

  const send = async (): Promise<void> => {
    if (streaming === true) {
      return;
    }

    const rawInput = input;
    const trimmed = rawInput.trim();

    if (instructionMode === 'llm') {
      if (trimmed === '') {
        return;
      }

      const userMsg: IChatBubble = {
        id: `u:${String(Date.now())}`,
        role: 'user',
        content: trimmed,
      };

      const outbound = [
        ...messagesRef.current.filter((m) => m.id !== 'sys'),
        userMsg,
      ];

      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setStreaming(true);

      try {
        const res = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: authorizedJsonHeaders(),
          body: JSON.stringify({
            messages: outbound.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (!res.ok) {
          let errTxt = `${String(res.status)}`;
          try {
            const ej = (await res.json()) as { message?: string };
            errTxt =
              ej.message !== undefined && ej.message !== ''
                ? ej.message
                : errTxt;
          } catch {
            //
          }

          throw new Error(errTxt);
        }

        const reader = res.body?.getReader();
        if (reader === undefined) {
          throw new Error('响应无 ReadableStream body');
        }

        const decoder = new TextDecoder();
        const botId = `a:${String(Date.now())}`;
        setMessages((prev) => [
          ...prev,
          { id: botId, role: 'assistant', content: '' },
        ]);

        let acc = '';

        bufferRef.current = '';

        while (true) {
          const { done, value } = await reader.read();

          const chunk = decoder.decode(value ?? undefined, {
            stream: done !== true,
          });
          bufferRef.current += chunk;

          const lines = bufferRef.current.split('\n');
          bufferRef.current =
            typeof lines[lines.length - 1] === 'string'
              ? (lines.pop() ?? '')
              : '';

          let nextAcc = acc;
          for (const raw of lines) {
            nextAcc = accumulateFromSseLine(nextAcc, raw.trim());
          }
          acc = nextAcc;

          setMessages((prev) =>
            prev.map((x) =>
              x.id === botId ? { ...x, content: nextAcc } : x,
            ),
          );

          if (done === true) {
            break;
          }
        }

        if (bufferRef.current.trim() !== '') {
          const finalAcc = accumulateFromSseLine(
            acc,
            bufferRef.current.trim(),
          );

          setMessages((prev) =>
            prev.map((x) =>
              x.id === botId ? { ...x, content: finalAcc } : x,
            ),
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : '请求失败';

        const errBubble: IChatBubble = {
          id: `e:${String(Date.now())}`,
          role: 'assistant',
          content: `（流失败） ${msg}`,
        };

        setMessages((prev) => [...prev, errBubble]);
      } finally {
        setStreaming(false);
      }
      return;
    }

    const hasReqAtt =
      instructionMode === 'requirements' &&
      (reqPendingTextish.length > 0 || reqPendingImages.length > 0);

    const composed = composeInstructionText(
      instructionMode,
      rawInput,
      quote,
      { hasRequirementAttachments: hasReqAtt }
    );
    if (composed.ok !== true) {
      const errBubble: IChatBubble = {
        id: `e:${String(Date.now())}`,
        role: 'assistant',
        content: composed.error,
      };
      setMessages((prev) => [...prev, errBubble]);
      return;
    }

    setStreaming(true);

    let assistantId = '';

    try {
      let materialized: IMaterializedConsoleAttachments | undefined;
      if (
        instructionMode === 'requirements' &&
        (reqPendingTextish.length > 0 || reqPendingImages.length > 0)
      ) {
        const mat = await materializeConsoleRequirementAttachments(
          reqPendingTextish,
          reqPendingImages
        );
        if (mat.ok !== true) {
          setMessages((prev) => [
            ...prev,
            {
              id: `e:${String(Date.now())}`,
              role: 'assistant',
              content: mat.error,
            },
          ]);
          return;
        }
        materialized = {
          textFiles: [...mat.data.textFiles],
          images: [...mat.data.images],
        };
      }

      const userMsg: IChatBubble = {
        id: `u:${String(Date.now())}`,
        role: 'user',
        content: formatUserBubbleBody(
          quote,
          composed.text,
          hasReqAtt === true
            ? {
                text: reqPendingTextish.length,
                images: reqPendingImages.length,
              }
            : undefined
        ),
      };

      assistantId = `a:${globalThis.crypto.randomUUID()}`;
      const meta: Record<string, unknown> = {};
      if (instructionMode === 'requirements' && quote === null) {
        meta.consolePrdReplyAnchorId = assistantId;
      }
      if (
        materialized !== undefined &&
        (materialized.textFiles.length > 0 || materialized.images.length > 0)
      ) {
        meta.consoleRequirementsAttachments = {
          textFiles: materialized.textFiles,
          images: materialized.images,
        };
      }

      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: assistantId,
          role: 'assistant',
          content: '… 编排器执行中 …',
        },
      ]);
      setInput('');
      setReqPendingTextish([]);
      setReqPendingImages([]);
      const quoteSnap = quote;
      setQuote(null);

      await sendPipeline(
        composed.text,
        assistantId,
        Object.keys(meta).length > 0 ? meta : undefined,
        quoteSnap !== null ? quoteSnap.id : undefined
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : '请求失败';
      if (assistantId !== '') {
        setMessages((prev) =>
          prev.map((x) =>
            x.id === assistantId
              ? { ...x, content: `（流水线请求失败）${msg}` }
              : x,
          ),
        );
      }
    } finally {
      setStreaming(false);
    }
  };

  const canSendPipeline = (): boolean => {
    if (instructionMode === 'llm') {
      return input.trim() !== '';
    }
    const c = composeInstructionText(instructionMode, input, quote, {
      hasRequirementAttachments:
        instructionMode === 'requirements' &&
        (reqPendingTextish.length > 0 || reqPendingImages.length > 0),
    });
    return c.ok === true;
  };

  const [miniTokenUi, setMiniTokenUi] = useState(false);
  const [tokenDraft, setTokenDraft] = useState(readConsoleBearer());

  const saveTokenLocal = (): void => {
    persistConsoleBearer(tokenDraft);
    setMiniTokenUi(false);
  };

  const inputPlaceholder =
    instructionMode === 'llm'
      ? '提出问题或下达意图… Shift+Enter 换行 · Enter 发送'
      : instructionMode === 'requirements' && quote !== null
        ? '填写对 PRD 的补充（将按引用合并修订）…'
        : instructionMode === 'requirements'
          ? '描述产品需求，或上传 .txt / .md / PDF / 截图…'
          : instructionMode === 'code'
            ? '说明要做的改动…'
            : instructionMode === 'review'
              ? '可选：审核范围说明；留空则跑默认范围'
              : instructionMode === 'test'
                ? '可选：附加说明；留空则执行 fullTestCommand'
                : instructionMode === 'publish'
                  ? '可选：发包说明；若配置验证码请在说明中包含口令'
                  : instructionMode === 'probe'
                    ? '可选：巡检说明；留空则默认采集'
                    : '留空将只发送指令关键词';

  const streamComposerFooter = (
    <footer className="flex shrink-0 gap-3 border-t border-white/10 pt-3">
      <ConsoleTextarea
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
        }}
        placeholder={inputPlaceholder}
        disabled={streaming}
        rows={2}
        density="compact"
        onKeyDown={(e) => {
          if (
            e.key === 'Enter' &&
            e.shiftKey !== true &&
            e.nativeEvent.isComposing !== true
          ) {
            e.preventDefault();
            if (instructionMode === 'llm') {
              if (input.trim() === '') {
                return;
              }
            } else if (canSendPipeline() !== true) {
              return;
            }

            void send();
          }
        }}
        className="disabled:opacity-55"
      />
      <button
        type="button"
        disabled={
          streaming ||
          (instructionMode === 'llm'
            ? input.trim() === ''
            : canSendPipeline() !== true)
        }
        onClick={() => {
          void send();
        }}
        className="cursor-pointer self-end rounded-xl bg-linear-to-br from-sky-500 via-fuchsia-500 to-purple-700 px-[1.05rem] py-3 text-[0.8rem] font-bold text-black shadow-lg shadow-purple-950/65 transition-opacity hover:opacity-92 disabled:pointer-events-none disabled:opacity-40"
      >
        发送 →
      </button>
    </footer>
  );

  return (
    <section
      className={`${className ?? ''} flex h-full max-h-full min-h-0 flex-col gap-4 overflow-hidden rounded-[1.65rem] border border-cyan-500/35 bg-console-panel animate-border-glow p-5 backdrop-blur-2xl`}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <h2 className="bg-linear-to-br from-sky-200 via-fuchsia-200 to-purple-300 bg-clip-text text-lg font-bold tracking-wide text-transparent">
            Neural Stream
          </h2>
          <p className="text-[0.73rem] text-white/50">
            LLM 流式对话 · 流水线指令（编排器同飞书语义）
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMiniTokenUi(!miniTokenUi);
            }}
            className="cursor-pointer rounded-full border border-white/15 px-3 py-1 text-[0.7rem] text-white/60 transition-colors hover:bg-white/5"
          >
            API 令牌
          </button>
          <span className="font-mono text-[0.7rem] text-fuchsia-200/85">
            {streaming ? ' streaming… ' : ''}
          </span>
        </div>
      </header>

      {miniTokenUi ? (
        <div className="flex shrink-0 flex-col gap-2 rounded-xl border border-fuchsia-500/30 bg-black/35 p-3">
          <p className="text-[0.7rem] text-white/55">
            若进程设置了{' '}
            <code className="font-mono text-cyan-200/95">AGENT_CONSOLE_API_TOKEN</code>
            ，在此填相同值并保存；仅写入本机 localStorage。
          </p>
          <ConsoleTextInput
            type="password"
            value={tokenDraft}
            onChange={(e) => {
              setTokenDraft(e.target.value);
            }}
            placeholder="Bearer 后的 secret"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveTokenLocal}
              className="cursor-pointer rounded-lg bg-linear-to-r from-cyan-500 to-fuchsia-500 px-3 py-1.5 text-xs font-semibold text-black"
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => {
                setTokenDraft('');
                persistConsoleBearer('');
              }}
              className="cursor-pointer rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70"
            >
              清除
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <ConsoleLabel
            htmlFor="agent-console-instruction-mode"
            className="mb-1 text-[0.72rem] text-white/55"
          >
            指令类型
          </ConsoleLabel>
          <ConsoleSelect
            id="agent-console-instruction-mode"
            value={instructionMode}
            onValueChange={(v) => {
              setInstructionMode(v as IInstructionMode);
            }}
            options={[...INSTRUCTION_MODE_OPTIONS]}
            className="max-w-full"
          />
        </div>
        {quote !== null ? (
          <div className="flex max-w-full flex-col gap-1 rounded-xl border border-cyan-500/25 bg-black/30 px-3 py-2 text-[0.72rem] text-cyan-100/90 sm:mt-5 sm:max-w-[min(100%,20rem)]">
            <span className="text-white/45">引用</span>
            <span className="line-clamp-2 font-mono text-[0.7rem]">
              {quote.preview}
            </span>
            <button
              type="button"
              className="self-start text-[0.65rem] text-rose-300/90 underline decoration-dotted"
              onClick={() => {
                setQuote(null);
              }}
            >
              清除引用
            </button>
          </div>
        ) : null}
      </div>

      <div
        ref={listParentRef}
        className="flex flex-1 min-h-[8rem] max-h-[min(48vh,calc(100vh-22rem))] flex-col gap-1 overflow-y-auto overscroll-contain pr-1"
      >
        <div
          className="relative w-[99%]"
          style={{ height: `${String(msgVirtualizer.getTotalSize())}px` }}
        >
          {msgVirtualizer.getVirtualItems().map((vi) => {
            const m = messages[vi.index];
            if (m === undefined) {
              return null;
            }

            const isAssistant = m.role !== 'user';
            const isTailLive =
              streaming &&
              instructionMode === 'llm' &&
              messages[messages.length - 1]?.id !== undefined &&
              messages[messages.length - 1]?.id === m.id;

            const showQuoteBtn = m.id !== 'sys' && streaming !== true;

            return (
              <article
                key={`${String(vi.key)}:${m.id}`}
                style={{
                  position: 'absolute',
                  transform: `translateY(${String(vi.start)}px)`,
                  left: 0,
                  width: '100%',
                }}
                ref={msgVirtualizer.measureElement}
                data-index={vi.index}
                className={`group/msg max-w-[97%] rounded-2xl border px-3 py-2 text-sm leading-relaxed shadow-lg ${
                  isAssistant
                    ? 'mr-auto border-fuchsia-400/20 bg-fuchsia-950/25 text-fuchsia-50/95'
                    : 'ml-auto border-sky-400/25 bg-sky-500/10 text-sky-50'
                }`}
              >
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[0.65rem] font-semibold uppercase tracking-widest text-white/35">
                  <span>
                    {isAssistant ? '助手' : 'You'}
                    {m.taskId !== undefined ? (
                      <span className="ml-2 font-mono normal-case text-cyan-200/70">
                        {m.taskId.slice(0, 8)}…
                      </span>
                    ) : null}
                  </span>
                  {showQuoteBtn ? (
                    <button
                      type="button"
                      className="cursor-pointer rounded-md border border-white/10 bg-black/20 px-2 py-0.5 text-[0.6rem] normal-case tracking-normal text-white/55 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within/msg:opacity-100 sm:group-hover/msg:opacity-100"
                      onClick={() => {
                        setQuote({
                          id: m.id,
                          preview: previewForQuote(m.content, 220),
                          ...(m.taskId !== undefined
                            ? { taskId: m.taskId }
                            : {}),
                        });
                      }}
                    >
                      引用
                    </button>
                  ) : null}
                </div>

                <div className="max-h-[min(36vh,14rem)] overflow-y-auto whitespace-pre-wrap font-mono text-[0.8rem] text-white/90">
                  {m.content}
                  {isTailLive === true ? (
                    <span className="ml-1 inline-flex h-[0.6rem] w-[0.6rem] animate-pulse rounded-full bg-cyan-300/90" />
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {instructionMode === 'requirements' ? (
        <div
          className={`flex shrink-0 flex-col gap-3 rounded-xl transition-[box-shadow,background-color] ${
            reqDropHighlight
              ? 'ring-2 ring-cyan-400/50 bg-cyan-950/25 shadow-[0_0_24px_rgba(34,211,238,0.12)]'
              : ''
          }`}
          onDragOver={(e: DragEvent<HTMLDivElement>) => {
            if (streaming === true) {
              return;
            }
            if (!e.dataTransfer.types.includes('Files')) {
              return;
            }
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
            setReqDropHighlight(true);
          }}
          onDragLeave={(e: DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.currentTarget.contains(e.relatedTarget as Node)) {
              return;
            }
            setReqDropHighlight(false);
          }}
          onDrop={(e: DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            setReqDropHighlight(false);
            if (streaming === true) {
              return;
            }
            ingestReqFilesFromList(e.dataTransfer.files);
          }}
        >
          <div className="flex flex-col gap-2">
            <input
              ref={reqFileInputRef}
              type="file"
              multiple
              className="hidden"
              accept={REQ_FILE_ACCEPT}
              onChange={(e) => {
                ingestReqFilesFromList(e.target.files);
                e.target.value = '';
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={streaming}
                onClick={() => {
                  reqFileInputRef.current?.click();
                }}
                className="cursor-pointer rounded-lg border border-cyan-500/35 bg-black/25 px-3 py-1.5 text-[0.72rem] text-cyan-100/90 transition hover:bg-black/40 disabled:opacity-45"
              >
                添加文档 / 图片
              </button>
              <span className="text-[0.68rem] text-white/45">
                暂存附件；与下方说明一并点击「发送」后才解析并提交 · 支持文本 / PDF
                / 图
              </span>
            </div>
            {reqPendingTextish.length + reqPendingImages.length > 0 ? (
              <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-2">
                {reqPendingTextish.map((f) => {
                  const nm = f.file.name;
                  return (
                  <span
                    key={f.id}
                    className="inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-950/40 px-2 py-1 font-mono text-[0.65rem] text-sky-100/90"
                  >
                    文 {nm.length > 22 ? `${nm.slice(0, 22)}…` : nm}
                    <button
                      type="button"
                      className="cursor-pointer text-rose-300/90"
                      disabled={streaming}
                      onClick={() => {
                        setReqPendingTextish((p) =>
                          p.filter((x) => x.id !== f.id),
                        );
                      }}
                    >
                      ×
                    </button>
                  </span>
                  );
                })}
                {reqPendingImages.map((im) => {
                  const nm = im.file.name;
                  return (
                  <span
                    key={im.id}
                    className="inline-flex items-center gap-1 rounded-md border border-fuchsia-500/30 bg-fuchsia-950/35 px-2 py-1 font-mono text-[0.65rem] text-fuchsia-100/90"
                  >
                    图 {nm.length > 18 ? `${nm.slice(0, 18)}…` : nm}
                    <button
                      type="button"
                      className="cursor-pointer text-rose-300/90"
                      disabled={streaming}
                      onClick={() => {
                        setReqPendingImages((p) =>
                          p.filter((x) => x.id !== im.id),
                        );
                      }}
                    >
                      ×
                    </button>
                  </span>
                  );
                })}
              </div>
            ) : null}
          </div>
          {streamComposerFooter}
        </div>
      ) : (
        streamComposerFooter
      )}
    </section>
  );
};
