import type { JSX } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { authorizedJsonHeaders } from '~/lib/request-headers';
import type { IProjectEntryForm } from '~/schemas/project-entry';
import { projectEntryFormSchema } from '~/schemas/project-entry';

type ITargetMeta = {
  projects?: unknown;
  source?: 'git' | 'local';
  workspacePath?: string;
  gitRepoUrl?: string;
  defaultBranch?: string;
  defaultProjectId?: string;
};

type IConfigGet = {
  yamlPath: string;
  yamlRaw: string;
  parsedUnknown?: { target?: unknown };
};

const emptyRow = (): IProjectEntryForm => ({
  id: '',
  workspacePath: '',
  label: '',
});

export type IProjectsConfiguratorProps = {
  readonly config: IConfigGet;
  readonly refetch: () => Promise<void>;
};

export const ProjectsConfigurator = ({
  config,
  refetch,
}: IProjectsConfiguratorProps): JSX.Element => {
  const extracted = useMemo(() => {
    const tgt = config.parsedUnknown?.target as ITargetMeta | undefined;

    const rows: IProjectEntryForm[] = Array.isArray(tgt?.projects)
      ? (tgt!.projects as unknown[]).map((p) => {
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

  const updateRow = (
    index: number,
    patch: Partial<IProjectEntryForm>
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

  const saveProjects = useCallback(async () => {
    setStatus(null);
    if (validateAll() !== true) {
      setStatus('请修正标红行的输入（id / workspacePath 必须符合规则）。');
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

    const res = await fetch('/api/config/target-projects', {
      method: 'PUT',
      headers: authorizedJsonHeaders(),
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as {
      ok?: boolean;
      errors?: readonly string[];
      backupPath?: string;
    };

    if (!res.ok || json.ok !== true) {
      setStatus(
        `保存失败 ${String(res.status)}：${(json.errors ?? []).join('； ') || JSON.stringify(json)}`
      );
      return;
    }

    setStatus(`已写入 ${config.yamlPath}（自动备份可选）`);

    await refetch();
  }, [
    meta,
    refetch,
    config.yamlPath,
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-[0.8rem] text-white/72">
          目标类型 `target.source`
          <select
            value={meta.source ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setMeta((m) => ({
                ...m,
                source:
                  v === 'git' || v === 'local' ? v : undefined,
              }));
            }}
            className="rounded-lg border border-white/12 bg-black/45 px-2 py-2 font-mono text-xs text-white"
          >
            <option value="">（保持 YAML 原有）</option>
            <option value="git">git</option>
            <option value="local">local</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-white/72">
          默认子项目 ID
          <input
            value={meta.defaultProjectId}
            onChange={(e) => {
              setMeta((m) => ({ ...m, defaultProjectId: e.target.value }));
            }}
            className="rounded-lg border border-white/12 bg-black/45 px-2 py-2 font-mono text-xs text-white"
            placeholder="如 svc-api"
          />
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-white/72">
          单目标 workspacePath（与多项目可同时存在便于迁移）
          <input
            value={meta.workspacePath}
            onChange={(e) => {
              setMeta((m) => ({ ...m, workspacePath: e.target.value }));
            }}
            className="rounded-lg border border-white/12 bg-black/45 px-2 py-2 font-mono text-xs text-white"
            placeholder="./workspace/foo 或绝对路径"
          />
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-white/72">
          Git 远端 URL · defaultBranch（可选）
          <div className="flex gap-2">
            <input
              value={meta.gitRepoUrl}
              onChange={(e) => {
                setMeta((m) => ({ ...m, gitRepoUrl: e.target.value }));
              }}
              className="flex-1 rounded-lg border border-white/12 bg-black/45 px-2 py-2 font-mono text-xs text-white"
              placeholder="https://…"
            />
            <input
              value={meta.defaultBranch}
              onChange={(e) => {
                setMeta((m) => ({ ...m, defaultBranch: e.target.value }));
              }}
              className="w-32 rounded-lg border border-white/12 bg-black/45 px-2 py-2 font-mono text-xs text-white"
              placeholder="main"
            />
          </div>
        </label>
      </div>

      <div className="space-y-3">
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

        {meta.rows.map((row, i) => (
          <div
            key={`${String(i)}-${row.id}`}
            className="grid gap-2 rounded-2xl border border-white/10 bg-black/40 p-3 md:grid-cols-[1.1fr_1.6fr_1fr_auto]"
          >
            <label className="flex flex-col gap-1 text-[0.72rem] text-white/55">
              id
              <input
                value={row.id}
                onChange={(e) => {
                  updateRow(i, { id: e.target.value });
                }}
                className="rounded-lg border border-white/10 bg-black/55 px-2 py-1.5 font-mono text-xs text-white"
              />
            </label>
            <label className="flex flex-col gap-1 text-[0.72rem] text-white/55">
              workspacePath
              <input
                value={row.workspacePath}
                onChange={(e) => {
                  updateRow(i, { workspacePath: e.target.value });
                }}
                className="rounded-lg border border-white/10 bg-black/55 px-2 py-1.5 font-mono text-xs text-white"
              />
            </label>
            <label className="flex flex-col gap-1 text-[0.72rem] text-white/55">
              label
              <input
                value={row.label ?? ''}
                onChange={(e) => {
                  updateRow(i, { label: e.target.value });
                }}
                className="rounded-lg border border-white/10 bg-black/55 px-2 py-1.5 font-mono text-xs text-white"
              />
            </label>
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
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            void saveProjects();
          }}
          className="cursor-pointer rounded-xl bg-linear-to-br from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-bold text-black shadow-md shadow-black/55"
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
