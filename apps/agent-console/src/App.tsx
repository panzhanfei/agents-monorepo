import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { ProjectsConfigurator } from '~/components/ProjectsConfigurator';
import { StreamingChatDock } from '~/components/StreamingChatDock';
import { ThoughtBackdrop } from '~/components/ThoughtBackdrop';
import { YamlWorkbench } from '~/components/YamlWorkbench';

type IConfigEnvelope = {
  ok: boolean;
  yamlPath?: string;
  yamlRaw?: string;
  parsedUnknown?: { target?: unknown };
};

const tabs = [
  { id: 'projects', label: '多项目映射' },
  { id: 'yaml', label: 'YAML 专家' },
] as const;

type ITabId = (typeof tabs)[number]['id'];

const App = (): JSX.Element => {
  const [cfg, setCfg] = useState<IConfigEnvelope | null>(null);
  const [tab, setTab] = useState<ITabId>('projects');
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch('/api/config');
      const json = (await res.json()) as IConfigEnvelope;

      if (!res.ok || json.ok !== true) {
        setErr(`读取配置失败 ${String(res.status)}`);
        return;
      }

      if (json.yamlRaw === undefined || json.yamlPath === undefined) {
        setErr('接口未返回 yaml 内容');
        return;
      }

      setCfg(json);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
            <p className="mt-3 max-w-xl text-sm text-white/60">
              React 单页：霓虹玻璃拟态 + 思考场 3D 背景。支持多项目段落编辑、整份
              YAML 上传/校验、以及经本地 API 中转的 LLM 流式对话（密钥只在服务端
              `.env`）。
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              void load();
            }}
            className="cursor-pointer self-start rounded-2xl border border-white/14 bg-white/[0.06] px-5 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/12"
          >
            重新加载配置
          </button>
        </header>

        {err !== null ? (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 p-4 font-mono text-sm text-rose-100/90">
            {err}
          </div>
        ) : null}

        {cfg !== null ? (
          <p className="font-mono text-[0.74rem] text-white/45">
            当前：`{cfg.yamlPath}`
          </p>
        ) : null}

        <main className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] lg:items-stretch">
          <section className="flex min-h-[32rem] flex-col gap-5 rounded-[2rem] border border-white/[0.08] bg-linear-to-br from-black/45 via-[#0b102a]/70 to-[#1a0b2e]/70 p-7 shadow-[0_0_140px_rgba(147,51,234,0.12)] backdrop-blur-2xl">
            <nav className="flex flex-wrap gap-2">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTab(t.id);
                  }}
                  className={`cursor-pointer rounded-full px-4 py-2 text-xs font-bold tracking-wide transition ${
                    tab === t.id
                      ? 'bg-linear-to-r from-sky-400/90 to-fuchsia-500 text-black shadow-lg'
                      : 'border border-white/10 bg-black/40 text-white/60 hover:border-cyan-400/25'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {cfg !== null && tab === 'projects' ? (
                <ProjectsConfigurator
                  config={{
                    yamlPath: cfg.yamlPath ?? '',
                    yamlRaw: cfg.yamlRaw ?? '',
                    parsedUnknown: cfg.parsedUnknown,
                  }}
                  refetch={load}
                />
              ) : null}

              {cfg !== null && tab === 'yaml' ? (
                <YamlWorkbench
                  config={{
                    yamlPath: cfg.yamlPath ?? '',
                    yamlRaw: cfg.yamlRaw ?? '',
                  }}
                  refetch={load}
                />
              ) : null}

              {cfg === null && err === null ? (
                <div className="font-mono text-sm text-white/40">加载编排配置…</div>
              ) : null}
            </div>
          </section>

          <StreamingChatDock className="min-h-[32rem]" />
        </main>
      </div>
    </div>
  );
};

export default App;
