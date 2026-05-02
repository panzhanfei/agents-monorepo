import type { JSX } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/shallow';

import {
  ConsoleNumberInput,
} from '~/components/ui/console-input';
import { ConsoleLabel } from '~/components/ui/console-label';
import {
  type IConsoleLogLevel,
  type IConsoleLogLine,
  useConsoleStore,
} from '~/stores/console-store';

/** 单行逐字显现 */
const TypewriterLine = ({
  text,
  delayMs,
}: {
  readonly text: string;
  readonly delayMs: number;
}): JSX.Element => {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    setRevealed(0);
    if (text.length === 0) {
      return;
    }

    let cursor = 0;
    const tid = window.setInterval(() => {
      cursor += 1;
      setRevealed(Math.min(cursor, text.length));
      if (cursor >= text.length) {
        window.clearInterval(tid);
      }
    }, delayMs);

    return () => {
      window.clearInterval(tid);
    };
  }, [text, delayMs]);

  return <>{text.slice(0, revealed)}</>;
};

const levelStyle = (level: IConsoleLogLevel): string => {
  switch (level) {
    case 'debug': {
      return 'text-emerald-400/70';
    }

    case 'info': {
      return 'text-sky-300/90';
    }

    case 'warn': {
      return 'text-amber-300/90';
    }

    case 'error': {
      return 'text-rose-300/95';
    }

    default: {
      return 'text-white/80';
    }
  }
};

const lineKey = (line: IConsoleLogLine): string => line.id;

export const LogStreamPanel = (): JSX.Element => {
  const { logLines, preferences, clearLogs, setTypewriterDelayMs, localeText } =
    useConsoleStore(
      useShallow((s) => ({
        logLines: s.logLines,
        preferences: s.preferences,
        clearLogs: s.clearLogs,
        setTypewriterDelayMs: s.setTypewriterDelayMs,
        localeText: s.localeText,
      })),
    );

  const scrollRef = useRef<HTMLDivElement>(null);

  /** 最新日志在数组末尾；展示倒序，新条目置顶 */
  const displayLines = useMemo(
    () => [...logLines].reverse(),
    [logLines],
  );

  const newestId =
    logLines.length > 0 ? logLines[logLines.length - 1]?.id ?? '' : '';

  /** 新日志出现时锚定在顶部，便于立即看到最新一条 */
  useLayoutEffect(() => {
    if (newestId === '') {
      return;
    }
    const el = scrollRef.current;
    if (el !== null) {
      el.scrollTop = 0;
    }
  }, [newestId]);

  const title = localeText('logPanel.title');

  return (
    <section className="flex max-h-[min(40vh,26rem)] min-h-0 flex-col gap-3 overflow-hidden rounded-[1.35rem] border border-white/[0.06] bg-black/40 p-5 shadow-[0_0_60px_rgba(34,211,238,0.06)] backdrop-blur-xl">
      <header className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold tracking-wide text-cyan-50/95">
            {title}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-end gap-2">
            <ConsoleLabel
              htmlFor="agent-console-log-typewriter-ms"
              className="mb-0 font-mono text-[0.7rem] text-white/55"
            >
              {localeText('logPanel.delayLabel')}
            </ConsoleLabel>
            <ConsoleNumberInput
              id="agent-console-log-typewriter-ms"
              min={4}
              max={120}
              step={2}
              title={localeText('logPanel.delayHint')}
              value={preferences.typewriterDelayMs}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);

                setTypewriterDelayMs(Number.isFinite(n) === true ? n : 22);
              }}
              className="w-[4.5rem]"
            />
          </div>
          <button
            type="button"
            onClick={clearLogs}
            className="cursor-pointer rounded-xl border border-white/12 bg-white/[0.04] px-3 py-1.5 font-mono text-[0.72rem] text-white/75 transition hover:bg-white/10"
          >
            {localeText('logPanel.clear')}
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border border-white/[0.06] bg-[#050814]/80 p-3 font-mono text-[0.74rem] leading-relaxed"
      >
        {displayLines.length === 0 ? (
          <p className="text-white/35">{localeText('logPanel.empty', '（暂无事件，可切换分区或表单操作触发）')}</p>
        ) : null}

        {displayLines.map((line) => (
          <div
            key={lineKey(line)}
            className={`break-all border-l border-transparent py-1 pl-2 hover:border-white/10 ${levelStyle(line.level)}`}
          >
            <span className="mr-2 text-white/30">
              {new Date(line.ts).toLocaleTimeString()}
            </span>
            <TypewriterLine
              delayMs={preferences.typewriterDelayMs}
              text={line.fullText}
            />
          </div>
        ))}
      </div>
    </section>
  );
};
