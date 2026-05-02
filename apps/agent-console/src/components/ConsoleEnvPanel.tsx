import type { JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { toast } from 'sonner';

import { queryKeys } from '~/api/query-keys';
import { ConsoleTextInput } from '~/components/ui/console-input';
import { ConsoleLabel } from '~/components/ui/console-label';
import {
  CONSOLE_MODULE_LABELS,
  ENV_CATALOG_KEY_SET,
  ENV_SECTION_LABELS,
  fieldsGroupedBySectionForModule,
  isEnvFieldRequiredInModule,
  moduleOrderForModulesInCatalog,
  type IConsoleModuleId,
  type IEnvFieldMeta,
} from '~/config/console-env-catalog';
import { authorizedFetchHeaders, authorizedJsonHeaders } from '~/lib/request-headers';
import { appendConsoleLog } from '~/stores/console-store';

type IEnvGetResponse = {
  readonly ok?: boolean;
  readonly message?: string;
  readonly envPath?: string;
  readonly exists?: boolean;
  readonly values?: Record<string, string>;
};

type IEnvPutResponse = {
  readonly ok?: boolean;
  readonly message?: string;
  readonly envPath?: string;
  readonly backupPath?: string;
  readonly values?: Record<string, string>;
};

const moduleTabClass = (active: boolean): string =>
  clsx(
    'shrink-0 rounded-full px-3 py-1.5 text-xs font-bold tracking-wide outline-none transition-colors',
    active === true
      ? 'bg-linear-to-r from-sky-400/90 to-fuchsia-500 text-black shadow-md'
      : 'border border-white/12 bg-black/35 text-white/65 hover:border-cyan-400/28',
  );

const sensitiveFieldToggleSvg = (
  visible: boolean,
): JSX.Element =>
  visible ? (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );

export const ConsoleEnvPanel = (): JSX.Element => {
  const queryClient = useQueryClient();
  const [moduleId, setModuleId] = useState<IConsoleModuleId>('general');
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [sensitiveReveal, setSensitiveReveal] = useState<Record<string, boolean>>(
    {},
  );

  const envQuery = useQuery({
    queryKey: queryKeys.env(),
    queryFn: async () => {
      const res = await fetch('/api/console-env', {
        headers: authorizedFetchHeaders(),
      });
      const json = (await res.json()) as IEnvGetResponse;
      if (!res.ok || json.ok !== true || json.values === undefined) {
        throw new Error(
          json.message !== undefined && json.message !== ''
            ? json.message
            : `读取 .env 失败 HTTP ${String(res.status)}`,
        );
      }
      return json;
    },
  });

  const baseValues = envQuery.data?.values ?? {};

  const getVal = (key: string): string =>
    Object.prototype.hasOwnProperty.call(edit, key)
      ? (edit[key] ?? '')
      : (baseValues[key] ?? '');

  const setVal = (key: string, v: string): void => {
    setEdit((e) => ({ ...e, [key]: v }));
  };

  const savePayload = (): Record<string, string> => {
    const allKeys = new Set([
      ...Object.keys(baseValues),
      ...Object.keys(edit),
    ]);
    const out: Record<string, string> = {};
    for (const k of allKeys) {
      out[k] = Object.prototype.hasOwnProperty.call(edit, k)
        ? (edit[k] ?? '')
        : (baseValues[k] ?? '');
    }
    return out;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/console-env', {
        method: 'PUT',
        headers: authorizedJsonHeaders(),
        body: JSON.stringify({ values: savePayload() }),
      });
      const json = (await res.json()) as IEnvPutResponse;
      if (!res.ok || json.ok !== true) {
        throw new Error(
          json.message !== undefined && json.message !== ''
            ? json.message
            : `保存失败 HTTP ${String(res.status)}`,
        );
      }
      return json;
    },
    onSuccess: async (data) => {
      toast.success('已写入仓库根目录 .env（已尽量保留注释行）');
      appendConsoleLog(
        'info',
        `写入 .env${data.backupPath !== undefined && data.backupPath !== '' ? ` · 备份 ${data.backupPath}` : ''}`,
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.env() });
      setEdit({});
    },
    onError: (e: Error) => {
      toast.error(e.message);
      appendConsoleLog('error', e.message);
    },
  });

  const moduleIdsAvailable = useMemo(() => moduleOrderForModulesInCatalog(), []);

  useEffect(() => {
    if (!moduleIdsAvailable.includes(moduleId)) {
      const first = moduleIdsAvailable[0];
      if (first !== undefined) {
        setModuleId(first);
      }
    }
  }, [moduleIdsAvailable, moduleId]);

  const extraKeys = useMemo(
    () =>
      Object.keys({ ...baseValues, ...edit })
        .filter((k) => !ENV_CATALOG_KEY_SET.has(k))
        .sort((a, b) => a.localeCompare(b)),
    [baseValues, edit],
  );

  const envSections = useMemo(
    () => fieldsGroupedBySectionForModule(moduleId),
    [moduleId],
  );

  const resetLocal = (): void => {
    setEdit({});
    toast.info('已放弃未保存修改');
  };

  const renderFieldRow = (meta: IEnvFieldMeta): JSX.Element => {
    const reqHere = isEnvFieldRequiredInModule(meta, moduleId);
    const secretShown = sensitiveReveal[meta.key] === true;

    const inputInner = (
      <ConsoleTextInput
        name={meta.key}
        value={getVal(meta.key)}
        onChange={(e) => {
          setVal(meta.key, e.target.value);
        }}
        type={meta.sensitive === true && secretShown !== true ? 'password' : 'text'}
        autoComplete={meta.sensitive === true ? 'new-password' : 'on'}
        className={clsx(
          'font-mono text-xs',
          meta.sensitive === true && 'pr-10',
        )}
        aria-required={reqHere}
      />
    );

    return (
      <div
        key={meta.key}
        className="flex flex-col gap-1 rounded-lg border border-white/[0.06] bg-black/25 p-3"
      >
        <ConsoleLabel className="text-[0.75rem] text-white/80">
          {meta.label}
          {reqHere ? (
            <span className="text-rose-400" aria-hidden>
              {' '}
              *
            </span>
          ) : null}
          <span className="ml-1 font-mono text-[0.65rem] text-white/35">
            {meta.key}
          </span>
        </ConsoleLabel>
        {meta.sensitive === true ? (
          <div className="relative min-w-0">
            {inputInner}
            <button
              type="button"
              aria-label={secretShown === true ? '隐藏内容' : '显示内容'}
              aria-pressed={secretShown === true}
              onClick={() => {
                setSensitiveReveal((prev) => ({
                  ...prev,
                  [meta.key]: !prev[meta.key],
                }));
              }}
              className={clsx(
                'absolute top-1/2 right-1 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border border-transparent text-white/45 outline-none transition hover:border-white/14 hover:bg-white/8 hover:text-cyan-200/90 focus-visible:border-cyan-400/55 focus-visible:ring-2 focus-visible:ring-cyan-400/25',
              )}
            >
              {sensitiveFieldToggleSvg(secretShown)}
            </button>
          </div>
        ) : (
          inputInner
        )}
        {meta.hint !== undefined && meta.hint !== '' ? (
          <p className="text-[0.68rem] leading-snug text-white/42">{meta.hint}</p>
        ) : null}
      </div>
    );
  };

  const dirtyCount = Object.keys(edit).length;

  if (envQuery.isPending) {
    return (
      <div className="font-mono text-sm text-white/45">加载 .env …</div>
    );
  }

  if (envQuery.isError) {
    return (
      <div className="rounded-xl border border-rose-500/35 bg-rose-950/30 p-4 font-mono text-sm text-rose-100/90">
        {envQuery.error instanceof Error
          ? envQuery.error.message
          : '读取失败'}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-[0.7rem] text-white/50">
        {envQuery.data?.envPath !== undefined ? (
          <span className="break-all">路径：`{envQuery.data.envPath}`</span>
        ) : null}
        {envQuery.data?.exists === false ? (
          <span className="ml-2 text-amber-200/85">（文件尚不存在，保存时将创建）</span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
        {moduleIdsAvailable.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setModuleId(id);
            }}
            className={moduleTabClass(moduleId === id)}
          >
            {CONSOLE_MODULE_LABELS[id]}
          </button>
        ))}
      </div>

      <p className="text-[0.72rem] leading-relaxed text-white/48">
        仓库根 <span className="font-mono text-white/58">.env</span>；<span className="text-rose-400">*</span>{' '}
        为当前页签下建议必填。业务路径与 Git 以{' '}
        <span className="font-mono text-white/58">customer-targets/&lt;id&gt;/target.yaml</span> 为准。
      </p>

      {envSections.map(({ sectionId, fields }) => (
        <div key={sectionId} className="space-y-3">
          <h4 className="text-[0.72rem] font-bold tracking-wide text-cyan-200/88">
            {ENV_SECTION_LABELS[sectionId]}
          </h4>
          <div className="grid gap-3 md:grid-cols-2">
            {fields.map((f) => renderFieldRow(f))}
          </div>
        </div>
      ))}

      {moduleId === 'general' && extraKeys.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-amber-500/25 bg-amber-950/15 p-3">
          <h4 className="text-xs font-semibold text-amber-100/90">
            其他变量（未经目录归类，来自当前 .env）
          </h4>
          <div className="grid gap-3 md:grid-cols-2">
            {extraKeys.map((key) => (
              <div
                key={key}
                className="flex flex-col gap-1 rounded-lg border border-white/[0.06] bg-black/25 p-3"
              >
                <ConsoleLabel className="font-mono text-[0.72rem] text-white/70">
                  {key}
                </ConsoleLabel>
                <ConsoleTextInput
                  name={key}
                  value={getVal(key)}
                  onChange={(e) => {
                    setVal(key, e.target.value);
                  }}
                  className="font-mono text-xs"
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
        <button
          type="button"
          aria-busy={saveMutation.isPending}
          disabled={saveMutation.isPending || dirtyCount === 0}
          onClick={() => {
            saveMutation.mutate();
          }}
          className="cursor-pointer rounded-xl bg-linear-to-br from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-bold text-black shadow-md disabled:pointer-events-none disabled:opacity-45"
        >
          校验并写回 .env
        </button>
        <button
          type="button"
          disabled={dirtyCount === 0}
          onClick={resetLocal}
          className="cursor-pointer rounded-xl border border-white/16 px-3 py-2 text-xs font-semibold text-white/75 hover:bg-white/8 disabled:pointer-events-none disabled:opacity-40"
        >
          放弃未保存修改
        </button>
        {dirtyCount > 0 ? (
          <span className="text-[0.72rem] text-amber-200/85">
            已本地修改 {String(dirtyCount)} 项
          </span>
        ) : null}
      </div>
    </div>
  );
};
