import type { JSX } from 'react';
import { useCallback, useRef, useState } from 'react';
import {
  persistConsoleBearer,
  readConsoleBearer,
} from '~/lib/console-storage';
import { authorizedJsonHeaders } from '~/lib/request-headers';

export type IChatBubble = {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly content: string;
};

/** 粗略解析 OpenAI-style SSE：`data:` JSON chunks；忽略 tool calls */
const accumulateFromSseLine = (
  accumulated: string,
  lineTrimmed: string
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
        '连接到本机控制台 API：`/api/chat/stream`。**API Key 只放在服务端 `.env`**。若上游未就绪，会先收到 503 提示。',
    },
  ]);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bufferRef = useRef('');

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (trimmed === '' || streaming) {
      return;
    }

    const userMsg: IChatBubble = {
      id: `u:${String(Date.now())}`,
      role: 'user',
      content: trimmed,
    };

    /** 不向模型重复占位欢迎语；与当前快照同步拼装 outbound，避免闭包陈旧 */
    const outbound = [...messagesRef.current.filter((m) => m.id !== 'sys'), userMsg];

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
            x.id === botId ? { ...x, content: nextAcc } : x
          )
        );

        if (done === true) {
          break;
        }
      }

      if (bufferRef.current.trim() !== '') {
        const finalAcc = accumulateFromSseLine(
          acc,
          bufferRef.current.trim()
        );

        setMessages((prev) =>
          prev.map((x) =>
            x.id === botId ? { ...x, content: finalAcc } : x
          )
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
  }, [input, streaming]);

  const [miniTokenUi, setMiniTokenUi] = useState(false);
  const [tokenDraft, setTokenDraft] = useState(readConsoleBearer());

  const saveTokenLocal = (): void => {
    persistConsoleBearer(tokenDraft);
    setMiniTokenUi(false);
  };

  return (
    <section
      className={
        `${className ?? ''} flex h-full flex-col gap-4 rounded-[1.65rem] border border-cyan-500/35 bg-console-panel animate-border-glow p-5 backdrop-blur-2xl`
      }
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <h2 className="bg-linear-to-br from-sky-200 via-fuchsia-200 to-purple-300 bg-clip-text text-lg font-bold tracking-wide text-transparent">
            Neural Stream
          </h2>
          <p className="text-[0.73rem] text-white/50">
            会话经控制台 API 中转；内容逐块渲染
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
        <div className="flex flex-col gap-2 rounded-xl border border-fuchsia-500/30 bg-black/35 p-3">
          <p className="text-[0.7rem] text-white/55">
            若进程设置了{' '}
            <code className="font-mono text-cyan-200/95">AGENT_CONSOLE_API_TOKEN</code>
            ，在此填相同值并保存；仅写入本机 localStorage。
          </p>
          <input
            type="password"
            value={tokenDraft}
            onChange={(e) => {
              setTokenDraft(e.target.value);
            }}
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-white placeholder:text-white/25"
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

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {messages.map((m) => (
          <article
            key={m.id}
            className={`max-w-[97%] rounded-2xl border px-3 py-2 text-sm leading-relaxed shadow-lg ${
              m.role === 'user'
                ? 'ml-auto border-sky-400/25 bg-sky-500/10 text-sky-50'
                : 'mr-auto border-fuchsia-400/20 bg-fuchsia-950/25 text-fuchsia-50/95'
            }`}
          >
            <div className="mb-1 text-[0.65rem] font-semibold uppercase tracking-widest text-white/35">
              {m.role === 'user' ? 'You' : 'LLM'}
            </div>

            <div className="whitespace-pre-wrap font-mono text-[0.8rem] text-white/90">
              {m.content}
              {streaming && messages[messages.length - 1]?.id === m.id ? (
                <span className="ml-1 inline-flex h-[0.6rem] w-[0.6rem] animate-pulse rounded-full bg-cyan-300/90" />
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <footer className="flex shrink-0 gap-3 border-t border-white/10 pt-3">
        <textarea
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
          }}
          placeholder="提出问题或下达编码意图… Shift+Enter 换行 · Enter 发送"
          disabled={streaming}
          rows={2}
          onKeyDown={(e) => {
            if (
              e.key === 'Enter' &&
              e.shiftKey !== true &&
              e.nativeEvent.isComposing !== true
            ) {
              e.preventDefault();

              void send();
            }
          }}
          className="flex-1 resize-none rounded-xl border border-white/10 bg-black/55 px-3 py-2 font-mono text-sm text-white placeholder:text-white/30 focus:border-fuchsia-400/60 focus:outline-none disabled:opacity-55"
        />
        <button
          type="button"
          disabled={streaming}
          onClick={() => {
            void send();
          }}
          className="cursor-pointer self-end rounded-xl bg-linear-to-br from-sky-500 via-fuchsia-500 to-purple-700 px-[1.05rem] py-3 text-[0.8rem] font-bold text-black shadow-lg shadow-purple-950/65 transition-opacity hover:opacity-92 disabled:pointer-events-none disabled:opacity-40"
        >
          发送 →
        </button>
      </footer>
    </section>
  );
};
