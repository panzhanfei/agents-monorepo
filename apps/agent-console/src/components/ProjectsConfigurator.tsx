import type { JSX } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toast } from 'sonner';

import { ConsoleTextInput } from '~/components/ui/console-input';
import { ConsoleLabel } from '~/components/ui/console-label';
import { ConsoleSelect } from '~/components/ui/console-select';
import { useInvalidateConsoleConfig } from '~/hooks/use-invalidate-console-config';
import { authorizedJsonHeaders } from '~/lib/request-headers';
import type { IProjectEntryForm } from '~/schemas/project-entry';
import { projectEntryFormSchema } from '~/schemas/project-entry';
import { appendConsoleLog } from '~/stores/console-store';

type ITargetMeta = {
  projects?: unknown;
  source?: 'git' | 'local';
  workspacePath?: string;
  gitRepoUrl?: string;
  defaultBranch?: string;
  defaultProjectId?: string;
};

export type IConfigGet = {
  yamlPath: string;
  yamlRaw: string;
  parsedUnknown?: { target?: unknown };
};

export type IProjectsConfiguratorProps = {
  readonly config: IConfigGet;
};

const emptyRow = (): IProjectEntryForm => ({
  id: '',
  workspacePath: '',
  label: '',
});

const TARGET_SOURCE_OPTIONS = [
  { value: '__inherit__', label: '（保持 YAML 原有）' },
  { value: 'git', label: 'git' },
  { value: 'local', label: 'local' },
] as const;

export const ProjectsConfigurator = ({
  config,
}: IProjectsConfiguratorProps): JSX.Element => {
  const { invalidate } = useInvalidateConsoleConfig();

  const extracted = useMemo(() => {
    const tgt = config.parsedUnknown?.target as ITargetMeta | undefined;

    const rows: IProjectEntryForm[] = Array.isArray(tgt?.projects)
      ? (tgt.projects as unknown[]).map((p) => {
          const o = p as Record<string, unknown>;
          return {
            id: typeof o.id === 'string' ? o.id : '',
            workspacePath:
              typeof o.workspacePath === 'string' ? o.workspacePath : '',
            label: typeof o.label === 'string' ? o.label : '',
          };
        })
      : [emptyRow(), emptyRow()];

    return {
      source: tgt?.source,
      workspacePath: tgt?.workspacePath ?? '',
      gitRepoUrl: tgt?.gitRepoUrl ?? '',
      defaultBranch: tgt?.defaultBranch ?? '',
      defaultProjectId: tgt?.defaultProjectId ?? '',
      rows: rows.length > 0 ? rows : [emptyRow()],
    };
  }, [config]);

  const [meta, setMeta] = useState(extracted);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setMeta(extracted);
    setRowErrors({});
  }, [extracted]);

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
        `保存多项目 target-projects 成功 · ${config.yamlPath}`,
      );
      toast.success('多项目段落已保存');
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
    setMeta((m) => ({ ...m, rows: [...m.rows, emptyRow()] }));
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
    meta.rows.forEach((r, i) => {
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

  const scrollParentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: meta.rows.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 152,
    overscan: 8,
    getItemKey: (index) =>
      `${String(index)}-${meta.rows[index]?.id ?? ''}-${meta.rows[index]?.workspacePath ?? ''}`,
  });

  const saveProjects = (): void => {
    if (validateAll() !== true) {
      setStatus('请修正标红行的输入（id / workspacePath 必须符合规则）。');
      toast.warning('请先修正表单校验错误');
      return;
    }

    const body: Record<string, unknown> = {
      projects: meta.rows.map((r) => ({
        id: r.id.trim(),
        workspacePath: r.workspacePath.trim(),
        ...(r.label !== undefined && String(r.label).trim() !== ''
          ? { label: String(r.label).trim() }
          : {}),
      })),
    };

    if (meta.source !== undefined) {
      body.source = meta.source;
    }

    if (meta.workspacePath.trim() !== '') {
      body.workspacePath = meta.workspacePath.trim();
    }

    if (meta.gitRepoUrl.trim() !== '') {
      body.gitRepoUrl = meta.gitRepoUrl.trim();
    }

    if (meta.defaultBranch.trim() !== '') {
      body.defaultBranch = meta.defaultBranch.trim();
    }

    if (meta.defaultProjectId.trim() !== '') {
      body.defaultProjectId = meta.defaultProjectId.trim();
    }

    saveMutation.mutate(body);
  };

  return (
    <div className="flex min-h-0 max-h-full flex-col gap-5 overflow-hidden">
      <div className="grid shrink-0 gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <ConsoleLabel htmlFor="agent-console-target-source">
            目标类型 `target.source`
          </ConsoleLabel>
          <ConsoleSelect
            id="agent-console-target-source"
            value={meta.source ?? '__inherit__'}
            onValueChange={(v) => {
              setMeta((m) => ({
                ...m,
                source: v === '__inherit__' ? undefined : (v as 'git' | 'local'),
              }));
            }}
            options={TARGET_SOURCE_OPTIONS}
          />
        </div>
        <div className="flex flex-col gap-1">
          <ConsoleLabel htmlFor="agent-console-default-project-id">
            默认子项目 ID
          </ConsoleLabel>
          <ConsoleTextInput
            id="agent-console-default-project-id"
            value={meta.defaultProjectId}
            onChange={(e) => {
              setMeta((m) => ({ ...m, defaultProjectId: e.target.value }));
            }}
            placeholder="如 svc-api"
          />
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <ConsoleLabel htmlFor="agent-console-workspace-path">
            单目标 workspacePath（与多项目可同时存在便于迁移）
          </ConsoleLabel>
          <ConsoleTextInput
            id="agent-console-workspace-path"
            value={meta.workspacePath}
            onChange={(e) => {
              setMeta((m) => ({ ...m, workspacePath: e.target.value }));
            }}
            placeholder="./workspace/foo 或绝对路径"
          />
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <ConsoleLabel htmlFor="agent-console-git-url">
            Git 远端 URL · defaultBranch（可选）
          </ConsoleLabel>
          <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
            <ConsoleTextInput
              id="agent-console-git-url"
              value={meta.gitRepoUrl}
              onChange={(e) => {
                setMeta((m) => ({ ...m, gitRepoUrl: e.target.value }));
              }}
              placeholder="https://example.com/org/repo.git"
            />
            <ConsoleTextInput
              id="agent-console-default-branch"
              aria-label="defaultBranch"
              value={meta.defaultBranch}
              onChange={(e) => {
                setMeta((m) => ({ ...m, defaultBranch: e.target.value }));
              }}
              placeholder="main"
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-cyan-100/90">
            多项目 `target.projects`
          </h3>
          <button
            type="button"
            onClick={addRow}
            className="cursor-pointer rounded-lg border border-cyan-400/35 px-3 py-1 text-xs text-cyan-100/90 transition hover:bg-cyan-500/10"
          >
            + 行
          </button>
        </div>

        <div
          ref={scrollParentRef}
          className="max-h-[min(21rem,min(42vh,calc(100vh-30rem)))] overflow-y-auto overscroll-contain rounded-xl border border-white/8 bg-black/35 pr-0.5"
        >
          <div
            className="relative w-full pr-2"
            style={{ height: `${String(rowVirtualizer.getTotalSize())}px` }}
          >
            {rowVirtualizer.getVirtualItems().map((vi) => {
              const i = vi.index;
              const row = meta.rows[i];

              return (
                <div
                  key={`${String(vi.key)}:${row?.id ?? ''}`}
                  className="grid gap-2 px-3 py-3 md:grid-cols-[1.1fr_1.6fr_1fr_auto]"
                  data-index={i}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${String(vi.start)}px)`,
                  }}
                >
                  <div className="flex flex-col gap-1">
                    <ConsoleLabel
                      htmlFor={`agent-console-project-id-${String(i)}`}
                      className="text-[0.72rem] text-white/55"
                    >
                      id
                    </ConsoleLabel>
                    <ConsoleTextInput
                      id={`agent-console-project-id-${String(i)}`}
                      value={row?.id ?? ''}
                      onChange={(e) => {
                        updateRow(i, { id: e.target.value });
                      }}
                      className="border-white/10 bg-black/55 py-1.5"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <ConsoleLabel
                      htmlFor={`agent-console-project-ws-${String(i)}`}
                      className="text-[0.72rem] text-white/55"
                    >
                      workspacePath
                    </ConsoleLabel>
                    <ConsoleTextInput
                      id={`agent-console-project-ws-${String(i)}`}
                      value={row?.workspacePath ?? ''}
                      onChange={(e) => {
                        updateRow(i, { workspacePath: e.target.value });
                      }}
                      className="border-white/10 bg-black/55 py-1.5"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <ConsoleLabel
                      htmlFor={`agent-console-project-label-${String(i)}`}
                      className="text-[0.72rem] text-white/55"
                    >
                      label
                    </ConsoleLabel>
                    <ConsoleTextInput
                      id={`agent-console-project-label-${String(i)}`}
                      value={row?.label ?? ''}
                      onChange={(e) => {
                        updateRow(i, { label: e.target.value });
                      }}
                      className="border-white/10 bg-black/55 py-1.5"
                    />
                  </div>
                  <div className="flex items-end justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        removeRow(i);
                      }}
                      className="cursor-pointer rounded-lg border border-fuchsia-500/40 px-2 py-1 text-[0.7rem] text-fuchsia-200/90 hover:bg-fuchsia-500/10"
                    >
                      删
                    </button>
                  </div>
                  {rowErrors[i] !== undefined ? (
                    <div className="col-span-full text-[0.72rem] text-rose-300">
                      {rowErrors[i]}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <button
          type="button"
          aria-busy={saveMutation.isPending}
          disabled={saveMutation.isPending}
          onClick={saveProjects}
          className="cursor-pointer rounded-xl bg-linear-to-br from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-bold text-black shadow-md shadow-black/55 disabled:pointer-events-none disabled:opacity-50"
        >
          校验并保存多项目段落
        </button>
        {status !== null ? (
          <span className="font-mono text-[0.75rem] text-white/72">{status}</span>
        ) : null}
      </div>
    </div>
  );
};
