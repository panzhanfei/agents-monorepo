import type { ReactElement } from 'react';
import { useEffect, useTransition } from 'react';

import { LogStreamPanel } from '~/components/LogStreamPanel';
import { ProjectsConfigurator } from '~/components/ProjectsConfigurator';
import { StreamingChatDock } from '~/components/StreamingChatDock';
import { ThoughtBackdrop } from '~/components/ThoughtBackdrop';
import { useConsoleConfigQuery } from '~/hooks/use-console-config-query';
import { useFeishuRuntimeLogStream } from '~/hooks/use-feishu-runtime-log-stream';
import { appendConsoleLog } from '~/stores/console-store';

export const ConsoleLayout = (): ReactElement => {
  useFeishuRuntimeLogStream();
  const { data, isError, isPending, error, refetch, isFetching } =
    useConsoleConfigQuery();
  const [reloadPending, startReloadTransition] = useTransition();

  useEffect(() => {
    const p = data?.yamlPath;
    if (p !== undefined && p !== '') {
      appendConsoleLog('info', `目标编排配置已就绪: ${p}`);
    }
  }, [data?.yamlPath]);

  const onReload = (): void => {
    startReloadTransition(() => {
      void refetch();
    });
  };

  return (
    <div className="relative min-h-full">
      <ThoughtBackdrop />

      <div className="relative z-10 mx-auto flex min-h-full max-w-[1280px] flex-col gap-6 px-5 py-10">
        <header className="flex flex-col gap-3 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.28em] text-cyan-300/80">
              Agents Monorepo · Control Surface
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-[2.45rem] md:leading-none">
              编排{' '}
              <span className="bg-linear-to-r from-cyan-300 via-fuchsia-300 to-purple-300 bg-clip-text text-transparent">
                控制台
              </span>
            </h1>
          </div>

          <button
            type="button"
            aria-busy={reloadPending === true || isFetching === true}
            onClick={onReload}
            className="cursor-pointer self-start rounded-2xl border border-white/14 bg-white/[0.06] px-5 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/12 disabled:pointer-events-none disabled:opacity-50"
          >
            重新加载配置
          </button>
        </header>

        {isError === true ? (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 p-4 font-mono text-sm text-rose-100/90">
            {error instanceof Error ? error.message : '读取编排配置失败'}
          </div>
        ) : null}

        {data !== undefined ? (
          <p className="font-mono text-[0.74rem] text-white/45">
            目标工作区配置写入路径：`{data.yamlPath}`（仅 target 等段落由此页保存）
          </p>
        ) : null}

        <div className="flex flex-col gap-6">
          <main className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] lg:items-stretch lg:max-h-[min(52rem,calc(100vh-9rem))] lg:min-h-0 lg:overflow-hidden">
            <section className="flex min-h-0 max-h-[min(52rem,calc(100vh-9rem))] flex-col gap-5 overflow-hidden rounded-[2rem] border border-white/[0.08] bg-linear-to-br from-black/45 via-[#0b102a]/70 to-[#1a0b2e]/70 p-7 shadow-[0_0_140px_rgba(147,51,234,0.12)] backdrop-blur-2xl">
              <h2 className="text-sm font-bold tracking-wide text-white/80">
                多项目映射（目标仓库 workspace / Git）
              </h2>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {isPending === true && data === undefined ? (
                  <div className="font-mono text-sm text-white/40">
                    加载目标配置…
                  </div>
                ) : null}

                {data !== undefined ? (
                  <ProjectsConfigurator
                    config={{
                      yamlPath: data.yamlPath ?? '',
                      yamlRaw: data.yamlRaw ?? '',
                      parsedUnknown: data.parsedUnknown,
                    }}
                  />
                ) : !isPending && !isError ? (
                  <div className="font-mono text-sm text-white/40">
                    无配置数据。
                  </div>
                ) : null}
              </div>
            </section>

            <StreamingChatDock className="min-h-[18rem] max-h-[min(52rem,calc(100vh-9rem))]" />
          </main>

          <LogStreamPanel />
        </div>
      </div>
    </div>
  );
};
