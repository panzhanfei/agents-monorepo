import type { JSX } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { TargetProjectOrchestrationRules } from '~/components/TargetProjectOrchestrationRules';
import { ConsoleLabel } from '~/components/ui/console-label';
import { ConsoleTextInput } from '~/components/ui/console-input';
import { useInvalidateConsoleConfig } from '~/hooks/use-invalidate-console-config';
import { generateCustomerTargetProjectId } from '~/lib/generate-customer-target-project-id';
import { authorizedJsonHeaders } from '~/lib/request-headers';
import type { IProjectEntryForm } from '~/schemas/project-entry';
import { projectEntryFormSchema } from '~/schemas/project-entry';
import { appendConsoleLog } from '~/stores/console-store';

type ITargetMeta = {
  projects?: unknown;
};

export type IConfigGet = {
  yamlPath: string;
  yamlRaw: string;
  parsedUnknown?: { target?: unknown };
  parsedHydrated?: { target?: unknown };
};

export type ITargetProjectsPanelProps = {
  readonly config: IConfigGet;
};

const emptyRow = (id: string): IProjectEntryForm => ({
  id,
  workspacePath: '',
  label: '',
  gitRepoUrl: '',
  defaultBranch: '',
  deployRemotePath: '',
  deploySshHost: '',
  deploySshUser: '',
  deploySshPort: '',
  probeListenPorts: '',
  publishCommand: '',
  fullTestCommand: '',
  workspaceLifecycle: 'existing',
});

const ensureRowIds = (rows: IProjectEntryForm[]): IProjectEntryForm[] => {
  const used = new Set<string>();
  for (const r of rows) {
    const t = r.id.trim();
    if (t !== '') {
      used.add(t);
    }
  }
  return rows.map((r) => {
    if (r.id.trim() !== '') {
      return r;
    }
    const id = generateCustomerTargetProjectId(used);
    used.add(id);
    return { ...r, id };
  });
};

export const TargetProjectsPanel = ({
  config,
}: ITargetProjectsPanelProps): JSX.Element => {
  const { invalidate } = useInvalidateConsoleConfig();

  const extracted = useMemo(() => {
    const tgt = (
      config.parsedHydrated?.target ?? config.parsedUnknown?.target
    ) as ITargetMeta | undefined;

    const mapped: IProjectEntryForm[] = Array.isArray(tgt?.projects)
      ? (tgt.projects as unknown[]).map((p) => {
          const o = p as Record<string, unknown>;
          return {
            id: typeof o.id === 'string' ? o.id : '',
            workspacePath:
              typeof o.workspacePath === 'string' ? o.workspacePath : '',
            label: typeof o.label === 'string' ? o.label : '',
            gitRepoUrl:
              typeof o.gitRepoUrl === 'string' ? o.gitRepoUrl : '',
            defaultBranch:
              typeof o.defaultBranch === 'string' ? o.defaultBranch : '',
            deployRemotePath:
              typeof o.deployRemotePath === 'string' ? o.deployRemotePath : '',
            deploySshHost:
              typeof o.deploySshHost === 'string' ? o.deploySshHost : '',
            deploySshUser:
              typeof o.deploySshUser === 'string' ? o.deploySshUser : '',
            deploySshPort:
              typeof o.deploySshPort === 'string' ? o.deploySshPort : '',
            probeListenPorts:
              typeof o.probeListenPorts === 'string' ? o.probeListenPorts : '',
            publishCommand:
              typeof o.publishCommand === 'string' ? o.publishCommand : '',
            fullTestCommand:
              typeof o.fullTestCommand === 'string' ? o.fullTestCommand : '',
            workspaceLifecycle:
              o.workspaceLifecycle === 'greenfield'
                ? 'greenfield'
                : 'existing',
          };
        })
      : [];

    const rows =
      mapped.length > 0
        ? ensureRowIds(mapped)
        : [emptyRow(generateCustomerTargetProjectId(new Set()))];

    return { rows };
  }, [config.parsedHydrated, config.parsedUnknown]);

  const [meta, setMeta] = useState(extracted);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const rowCardRefs = useRef<Array<HTMLDivElement | null>>([]);
  rowCardRefs.current.length = meta.rows.length;
  const scrollNewProjectCardRef = useRef(false);

  useEffect(() => {
    setMeta(extracted);
    setRowErrors({});
  }, [extracted]);

  useEffect(() => {
    if (scrollNewProjectCardRef.current !== true) {
      return;
    }
    scrollNewProjectCardRef.current = false;
    const last = meta.rows.length - 1;
    if (last < 0) {
      return;
    }
    rowCardRefs.current[last]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, [meta.rows]);

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/config/target-projects', {
        method: 'PUT',
        headers: authorizedJsonHeaders(),
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        errors?: readonly string[];
        backupPath?: string;
      };
      if (!res.ok || json.ok !== true) {
        throw new Error(
          `保存失败 ${String(res.status)}：${(json.errors ?? []).join('； ') || JSON.stringify(json)}`,
        );
      }
      return { json };
    },
    onMutate: () => {
      setStatus(null);
    },
    onSuccess: async () => {
      setStatus(`已写入 ${config.yamlPath}（自动备份可选）`);
      appendConsoleLog(
        'info',
        `保存客户目标段落成功 · ${config.yamlPath} · 目录 customer-targets/`,
      );
      toast.success('目标项目段落已写入 customer-targets/');
      await invalidate();
    },
    onError: (e: Error) => {
      setStatus(null);
      appendConsoleLog('error', e.message);
      toast.error(e.message);
    },
  });

  const updateRow = (
    index: number,
    patch: Partial<IProjectEntryForm>,
  ): void => {
    setMeta((m) => ({
      ...m,
      rows: m.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    }));
  };

  const addRow = (): void => {
    scrollNewProjectCardRef.current = true;
    setMeta((m) => {
      const used = new Set(
        m.rows.map((r) => r.id.trim()).filter((id) => id !== ''),
      );
      return {
        ...m,
        rows: [...m.rows, emptyRow(generateCustomerTargetProjectId(used))],
      };
    });
  };

  const removeRow = (index: number): void => {
    setMeta((m) => ({
      ...m,
      rows: m.rows.filter((_, i) => i !== index),
    }));
  };

  const validateAll = (): boolean => {
    const nextE: Record<number, string> = {};
    let ok = true;
    const seenId = new Map<string, number>();
    meta.rows.forEach((r, i) => {
      const id = r.id.trim();
      if (id !== '') {
        const firstIdx = seenId.get(id);
        if (firstIdx !== undefined) {
          ok = false;
          nextE[i] = `id 与第 ${String(firstIdx + 1)} 条重复`;
          return;
        }
        seenId.set(id, i);
      }
      const v = projectEntryFormSchema.safeParse(r);
      if (!v.success) {
        ok = false;
        nextE[i] =
          v.error.issues[0]?.message !== undefined
            ? v.error.issues[0].message
            : '校验失败';
      }
    });
    setRowErrors(nextE);
    return ok;
  };

  const saveProjects = (): void => {
    if (validateAll() !== true) {
      setStatus('请修正标红行的输入（工作区路径等必须符合规则）。');
      toast.warning('请先修正表单校验错误');
      return;
    }

    const body: Record<string, unknown> = {
      projects: meta.rows.map((r) => {
        const o: Record<string, unknown> = {
          id: r.id.trim(),
          workspacePath: r.workspacePath.trim(),
        };
        const add = (key: string, v: string | undefined): void => {
          const t = (v ?? '').trim();
          if (t !== '') {
            o[key] = t;
          }
        };
        add('label', r.label);
        add('gitRepoUrl', r.gitRepoUrl);
        add('defaultBranch', r.defaultBranch);
        add('deployRemotePath', r.deployRemotePath);
        add('deploySshHost', r.deploySshHost);
        add('deploySshUser', r.deploySshUser);
        add('deploySshPort', r.deploySshPort);
        add('probeListenPorts', r.probeListenPorts);
        add('publishCommand', r.publishCommand);
        add('fullTestCommand', r.fullTestCommand);
        if (r.workspaceLifecycle === 'greenfield') {
          o.workspaceLifecycle = 'greenfield';
        }
        return o;
      }),
    };

    saveMutation.mutate(body);
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-5">
      <p className="text-[0.72rem] leading-relaxed text-white/50">
        <span className="font-mono text-white/70">customer-targets/&lt;id&gt;/</span> 含{' '}
        <span className="font-mono text-emerald-200/95">target.yaml</span> 与可选{' '}
        <span className="font-mono text-fuchsia-200/85">ai-rules/</span>。
        绑定飞书目标 id 时审核规则优先读该目录；门禁命令仍以{' '}
        <span className="font-mono text-white/65">agents.config.yaml</span> 为准。
      </p>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-cyan-100/90">
            目标项目列表
          </h3>
          <button
            type="button"
            onClick={addRow}
            className="cursor-pointer rounded-lg border border-cyan-400/35 px-3 py-1 text-xs text-cyan-100/90 transition hover:bg-cyan-500/10"
          >
            + 新增项目
          </button>
        </div>

        <div className="space-y-5 rounded-xl border border-white/10 bg-linear-to-br from-black/52 via-teal-950/10 to-purple-950/15 px-4 py-5">
          {meta.rows.map((row, i) => (
            <div
              key={`row-${String(i)}-${row.id}-${row.workspacePath}`}
              ref={(el) => {
                rowCardRefs.current[i] = el;
              }}
              className="space-y-3 rounded-xl border border-white/10 bg-black/40 p-3 shadow-sm shadow-black/40"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-emerald-500/25 px-3 font-mono text-xs font-bold text-emerald-100">
                    #{String(i + 1)}
                  </span>
                  <div>
                    <p className="text-base font-black tracking-wide text-emerald-100/95">
                      客户目标模块
                    </p>
                    <p className="mt-0.5 font-mono text-[0.68rem] text-white/45">
                      customer-targets/{row.id.trim()}/
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={meta.rows.length <= 1}
                  onClick={() => {
                    removeRow(i);
                  }}
                  title={
                    meta.rows.length <= 1
                      ? '至少保留一行（保存时须 ≥1 条客户仓）'
                      : '删除此客户仓'
                  }
                  className="shrink-0 cursor-pointer rounded-lg border border-fuchsia-500/40 px-2.5 py-1 text-[0.72rem] text-fuchsia-200/90 hover:bg-fuchsia-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  删除本项
                </button>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/3 px-2 py-2">
                <p className="mb-2 text-[0.68rem] font-semibold text-white/75">
                  基本信息 · 编码工作目录
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <ConsoleLabel
                      htmlFor={`agent-console-project-id-${String(i)}`}
                      className="text-[0.7rem] text-white/52"
                    >
                      子项目 id（<span className="font-mono">id</span>）
                    </ConsoleLabel>
                    <ConsoleTextInput
                      id={`agent-console-project-id-${String(i)}`}
                      readOnly
                      tabIndex={-1}
                      value={row.id}
                      title="创建模块时自动生成，不可修改"
                      className="cursor-default border-white/10 bg-white/5 py-1.5 font-mono text-[0.8rem] text-white/75 focus-visible:ring-0"
                    />
                    <p className="text-[0.62rem] leading-snug text-white/38">
                      与磁盘目录{' '}
                      <span className="font-mono text-white/48">
                        customer-targets/{'<id>'}/
                      </span>{' '}
                      一致；新增模块时由系统生成。
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <ConsoleLabel
                      htmlFor={`agent-console-project-label-${String(i)}`}
                      className="text-[0.7rem] text-white/52"
                    >
                      显示名称（<span className="font-mono">label</span>）
                    </ConsoleLabel>
                    <ConsoleTextInput
                      id={`agent-console-project-label-${String(i)}`}
                      value={row.label ?? ''}
                      onChange={(e) => {
                        updateRow(i, { label: e.target.value });
                      }}
                      className="border-white/10 bg-black/55 py-1.5"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1 md:col-span-2">
                    <ConsoleLabel
                      htmlFor={`agent-console-project-ws-${String(i)}`}
                      className="text-[0.7rem] text-white/52"
                    >
                      编码目录 / 客户仓根（<span className="font-mono">workspacePath</span>）
                    </ConsoleLabel>
                    <ConsoleTextInput
                      id={`agent-console-project-ws-${String(i)}`}
                      value={row.workspacePath}
                      onChange={(e) => {
                        updateRow(i, { workspacePath: e.target.value });
                      }}
                      placeholder="./workspace/customer-a 或绝对路径"
                      className="border-white/10 bg-black/55 py-1.5 font-mono text-[0.78rem]"
                    />
                  </div>
                  <div className="flex flex-col gap-1 md:col-span-2">
                    <ConsoleLabel
                      htmlFor={`agent-console-project-lifecycle-${String(i)}`}
                      className="text-[0.7rem] text-white/52"
                    >
                      工作区模式（
                      <span className="font-mono">workspaceLifecycle</span>）
                    </ConsoleLabel>
                    <select
                      id={`agent-console-project-lifecycle-${String(i)}`}
                      value={
                        row.workspaceLifecycle === 'greenfield'
                          ? 'greenfield'
                          : 'existing'
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        updateRow(i, {
                          workspaceLifecycle:
                            v === 'greenfield' ? 'greenfield' : 'existing',
                        });
                      }}
                      className="rounded-md border border-white/10 bg-black/55 px-2 py-1.5 font-mono text-[0.78rem] text-white/85"
                    >
                      <option value="existing">
                        既有仓库（路径须已存在）
                      </option>
                      <option value="greenfield">
                        新项目（路径可不存在，编码自检时创建目录）
                      </option>
                    </select>
                    <p className="text-[0.62rem] leading-snug text-white/38">
                      选「新项目」时可将{' '}
                      <span className="font-mono text-white/48">workspacePath</span>{' '}
                      指向尚不存在的工程根（如 Next.js 新仓目录），首次编码前会自动{' '}
                      <span className="font-mono text-white/48">mkdir -p</span>。
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/10 px-2 py-2">
                <p className="mb-2 text-[0.68rem] font-semibold text-cyan-200/85">
                  Git 仓库
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <ConsoleLabel
                      htmlFor={`agent-console-p-git-${String(i)}`}
                      className="text-[0.7rem] text-white/50"
                    >
                      仓库 URL（<span className="font-mono">gitRepoUrl</span>）
                    </ConsoleLabel>
                    <ConsoleTextInput
                      id={`agent-console-p-git-${String(i)}`}
                      value={row.gitRepoUrl ?? ''}
                      onChange={(e) => {
                        updateRow(i, { gitRepoUrl: e.target.value });
                      }}
                      className="border-white/10 bg-black/55 py-1.5"
                      placeholder="https://…"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <ConsoleLabel
                      htmlFor={`agent-console-p-branch-${String(i)}`}
                      className="text-[0.7rem] text-white/50"
                    >
                      默认分支（<span className="font-mono">defaultBranch</span>）
                    </ConsoleLabel>
                    <ConsoleTextInput
                      id={`agent-console-p-branch-${String(i)}`}
                      value={row.defaultBranch ?? ''}
                      onChange={(e) => {
                        updateRow(i, { defaultBranch: e.target.value });
                      }}
                      className="border-white/10 bg-black/55 py-1.5"
                      placeholder="main"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-violet-500/25 bg-violet-950/15 px-2 py-2">
                <p className="mb-2 text-[0.68rem] font-semibold text-violet-200/85">
                  审核 · 编排侧规则（与本目标同 id）
                </p>
                <TargetProjectOrchestrationRules projectId={row.id} />
              </div>

              <div className="rounded-lg border border-sky-500/22 bg-sky-950/12 px-2 py-2">
                <p className="mb-2 text-[0.68rem] font-semibold text-sky-200/85">
                  测试 · 发包命令（可选）
                </p>
                <div className="grid gap-2 md:grid-cols-1">
                  <div className="flex flex-col gap-1">
                    <ConsoleLabel
                      htmlFor={`agent-console-p-fulltest-${String(i)}`}
                      className="text-[0.7rem] text-white/50"
                    >
                      全量测试命令（<span className="font-mono">fullTestCommand</span>）
                    </ConsoleLabel>
                    <ConsoleTextInput
                      id={`agent-console-p-fulltest-${String(i)}`}
                      value={row.fullTestCommand ?? ''}
                      onChange={(e) => {
                        updateRow(i, { fullTestCommand: e.target.value });
                      }}
                      className="border-white/10 bg-black/55 py-1.5 font-mono text-[0.76rem]"
                      placeholder="pnpm run test && pnpm run e2e"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <ConsoleLabel
                      htmlFor={`agent-console-p-publish-${String(i)}`}
                      className="text-[0.7rem] text-white/50"
                    >
                      构建 / 发包命令（<span className="font-mono">publishCommand</span>）
                    </ConsoleLabel>
                    <ConsoleTextInput
                      id={`agent-console-p-publish-${String(i)}`}
                      value={row.publishCommand ?? ''}
                      onChange={(e) => {
                        updateRow(i, { publishCommand: e.target.value });
                      }}
                      className="border-white/10 bg-black/55 py-1.5 font-mono text-[0.76rem]"
                      placeholder="pnpm run build"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-950/10 px-2 py-2">
                <p className="mb-2 text-[0.68rem] font-semibold text-fuchsia-200/85">
                  运维 · 远程部署 / SSH
                </p>
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="flex min-w-0 flex-col gap-1 md:col-span-3">
                    <ConsoleLabel
                      htmlFor={`agent-console-p-deploy-path-${String(i)}`}
                      className="text-[0.7rem] text-white/50"
                    >
                      服务器部署路径（<span className="font-mono">deployRemotePath</span>）
                    </ConsoleLabel>
                    <ConsoleTextInput
                      id={`agent-console-p-deploy-path-${String(i)}`}
                      value={row.deployRemotePath ?? ''}
                      onChange={(e) => {
                        updateRow(i, { deployRemotePath: e.target.value });
                      }}
                      className="border-white/10 bg-black/55 py-1.5"
                      placeholder="/srv/your-app"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <ConsoleLabel
                      htmlFor={`agent-console-p-ssh-host-${String(i)}`}
                      className="text-[0.7rem] text-white/50"
                    >
                      SSH 主机（<span className="font-mono">deploySshHost</span>）
                    </ConsoleLabel>
                    <ConsoleTextInput
                      id={`agent-console-p-ssh-host-${String(i)}`}
                      value={row.deploySshHost ?? ''}
                      onChange={(e) => {
                        updateRow(i, { deploySshHost: e.target.value });
                      }}
                      className="border-white/10 bg-black/55 py-1.5"
                      placeholder="1.2.3.4 或 dns"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <ConsoleLabel
                      htmlFor={`agent-console-p-ssh-user-${String(i)}`}
                      className="text-[0.7rem] text-white/50"
                    >
                      SSH 用户（<span className="font-mono">deploySshUser</span>）
                    </ConsoleLabel>
                    <ConsoleTextInput
                      id={`agent-console-p-ssh-user-${String(i)}`}
                      value={row.deploySshUser ?? ''}
                      onChange={(e) => {
                        updateRow(i, { deploySshUser: e.target.value });
                      }}
                      className="border-white/10 bg-black/55 py-1.5"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <ConsoleLabel
                      htmlFor={`agent-console-p-ssh-port-${String(i)}`}
                      className="text-[0.7rem] text-white/50"
                    >
                      SSH 端口（<span className="font-mono">deploySshPort</span>）
                    </ConsoleLabel>
                    <ConsoleTextInput
                      id={`agent-console-p-ssh-port-${String(i)}`}
                      value={row.deploySshPort ?? ''}
                      onChange={(e) => {
                        updateRow(i, { deploySshPort: e.target.value });
                      }}
                      className="border-white/10 bg-black/55 py-1.5 font-mono text-[0.8rem]"
                      placeholder="22"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1 md:col-span-3">
                    <ConsoleLabel
                      htmlFor={`agent-console-p-probe-ports-${String(i)}`}
                      className="text-[0.7rem] text-white/50"
                    >
                      巡检关注端口（<span className="font-mono">probeListenPorts</span>）
                    </ConsoleLabel>
                    <ConsoleTextInput
                      id={`agent-console-p-probe-ports-${String(i)}`}
                      value={row.probeListenPorts ?? ''}
                      onChange={(e) => {
                        updateRow(i, { probeListenPorts: e.target.value });
                      }}
                      className="border-white/10 bg-black/55 py-1.5 font-mono text-[0.78rem]"
                      placeholder="80,443,3000"
                    />
                  </div>
                </div>
              </div>

              {rowErrors[i] !== undefined ? (
                <div className="text-[0.72rem] text-rose-300">
                  {rowErrors[i]}
                </div>
              ) : null}
            </div>
          ))}
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={addRow}
              className="cursor-pointer rounded-lg border border-cyan-400/35 px-4 py-2 text-xs font-semibold text-cyan-100/90 transition hover:bg-cyan-500/10"
            >
              + 新增项目
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-busy={saveMutation.isPending}
          disabled={saveMutation.isPending}
          onClick={saveProjects}
          className="cursor-pointer rounded-xl bg-linear-to-br from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-bold text-black shadow-md shadow-black/55 disabled:pointer-events-none disabled:opacity-50"
        >
          校验并写入 customer-targets
        </button>
        {status !== null ? (
          <span className="font-mono text-[0.75rem] text-white/72">{status}</span>
        ) : null}
      </div>
      </section>
    </div>
  );
};
