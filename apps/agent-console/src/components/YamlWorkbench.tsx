import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toast } from 'sonner';

import { ConsoleTextarea } from '~/components/ui/console-input';
import { ConsoleLabel } from '~/components/ui/console-label';
import { useInvalidateConsoleConfig } from '~/hooks/use-invalidate-console-config';
import { authorizedJsonHeaders } from '~/lib/request-headers';
import { appendConsoleLog } from '~/stores/console-store';

export type IConfigPayload = {
  yamlPath: string;
  yamlRaw: string;
};

export type IYamlWorkbenchProps = {
  readonly config: IConfigPayload;
};

const INLINE_HINT_VIRTUAL_THRESHOLD = 32;

type IValidateMutationResult =
  | { readonly kind: 'ok' }
  | { readonly kind: 'http'; readonly status: number }
  | { readonly kind: 'zod_fail'; readonly errors: readonly string[] };

/** 长报错列表时使用虚拟滚动，避免成百上千条 DOM */
const ValidateHintList = ({
  lines,
}: {
  readonly lines: readonly string[];
}): JSX.Element => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 12,
  });

  const shouldVirtual = lines.length >= INLINE_HINT_VIRTUAL_THRESHOLD;

  if (!shouldVirtual) {
    return (
      <div className="rounded-xl border border-rose-400/40 bg-rose-950/40 p-3 font-mono text-[0.72rem] text-rose-100/85">
        {lines.map((l, i) => (
          <div key={`h:${String(i)}:${l.slice(0, 96)}`}>· {l}</div>
        ))}
      </div>
    );
  }

  const totalPx = `${String(virtualizer.getTotalSize())}px`;

  return (
    <div
      ref={parentRef}
      className="max-h-[14rem] overflow-y-auto rounded-xl border border-rose-400/40 bg-rose-950/40 p-2 font-mono text-[0.72rem] text-rose-100/85"
    >
      <div className="relative w-full pr-2" style={{ height: totalPx }}>
        {virtualizer.getVirtualItems().map((vi) => {
          const line = lines[vi.index] ?? '';

          return (
            <div
              key={`v-${String(vi.key)}`}
              style={{
                position: 'absolute',
                transform: `translateY(${String(vi.start)}px)`,
                left: 0,
                width: '100%',
                paddingLeft: '0.5rem',
              }}
              data-index={vi.index}
              ref={virtualizer.measureElement}
            >
              · {line}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const YamlWorkbench = ({ config }: IYamlWorkbenchProps): JSX.Element => {
  const [draft, setDraft] = useState(config.yamlRaw);
  const [validateHints, setValidateHints] = useState<readonly string[] | null>(
    null,
  );
  const [note, setNote] = useState<string | null>(null);

  const { invalidate } = useInvalidateConsoleConfig();

  useEffect(() => {
    setDraft(config.yamlRaw);
  }, [config.yamlRaw]);

  const validateMutation = useMutation({
    mutationFn: async ({ yaml }: { yaml: string }): Promise<IValidateMutationResult> => {
      const res = await fetch('/api/config/validate', {
        method: 'POST',
        headers: authorizedJsonHeaders(),
        body: JSON.stringify({ yaml }),
      });

      const json = (await res.json()) as {
        ok?: boolean;
        errors?: readonly string[];
      };

      if (!res.ok) {
        return { kind: 'http', status: res.status };
      }

      if (json.ok !== true) {
        return { kind: 'zod_fail', errors: json.errors ?? ['未知错误'] };
      }

      return { kind: 'ok' };
    },
    onMutate: (): void => {
      setNote(null);
    },
    onSuccess: (result: IValidateMutationResult): void => {
      if (result.kind === 'http') {
        setValidateHints([`HTTP ${String(result.status)}`]);
        appendConsoleLog('warn', `YAML 校验 HTTP ${String(result.status)}`);
        return;
      }
      if (result.kind === 'zod_fail') {
        setValidateHints(result.errors);
        appendConsoleLog('warn', 'YAML Zod 校验未通过', {
          count: result.errors.length,
        });
        return;
      }
      setValidateHints([]);
      setNote('结构与 `agents.config` Zod 校验一致。');
      toast.success('YAML Zod 校验通过');
      appendConsoleLog('info', `YAML 仅校验通过 · ${config.yamlPath}`);
    },
    onError: (e: Error): void => {
      toast.error(e.message);
      appendConsoleLog('error', `YAML 校验请求失败 · ${e.message}`);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ yaml }: { yaml: string }) => {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: authorizedJsonHeaders(),
        body: JSON.stringify({ yaml }),
      });

      const json = (await res.json()) as {
        ok?: boolean;
        errors?: readonly string[];
        backupPath?: string;
        yamlRaw?: string;
      };

      if (!res.ok || json.ok !== true) {
        throw new Error((json.errors ?? ['保存失败']).join(' · '));
      }

      return { json };
    },
    onMutate: (): void => {
      setNote(null);
    },
    onSuccess: async (data): Promise<void> => {
      setValidateHints([]);
      const bp = data.json.backupPath;
      setNote(
        bp !== undefined && bp !== ''
          ? `落盘成功 · 备份 ${bp}`
          : '落盘成功',
      );
      toast.success('agents.config.yaml 已写回');
      appendConsoleLog(
        'info',
        `YAML 写回磁盘成功 · ${config.yamlPath}${bp !== undefined && bp !== '' ? ` · 备份 ${bp}` : ''}`,
      );
      await invalidate();
    },
    onError: (e: Error): void => {
      toast.error(e.message);
      appendConsoleLog('error', `YAML 写盘失败 · ${e.message}`);
    },
  });

  const busy =
    validateMutation.isPending === true || saveMutation.isPending === true;

  const triggerFile = (f: FileList | null): void => {
    const file = f?.[0];
    if (file === undefined) {
      return;
    }
    void file.text().then((txt) => {
      setDraft(txt);
      setValidateHints(null);
      setNote(`已载入本地文件：${file.name}`);
    });
  };

  return (
    <div className="flex min-h-0 max-h-full flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 flex-wrap gap-2">
        <label className="cursor-pointer rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/10">
          上传 YAML 覆盖草稿
          <input
            type="file"
            accept=".yaml,.yml,text/yaml"
            className="hidden"
            onChange={(e) => {
              triggerFile(e.target.files);
            }}
          />
        </label>
        <button
          type="button"
          disabled={busy === true}
          onClick={() => {
            void validateMutation.mutateAsync({ yaml: draft });
          }}
          className="cursor-pointer rounded-xl border border-cyan-400/40 px-4 py-2 text-xs font-bold text-cyan-50 transition hover:bg-cyan-500/10 disabled:opacity-35"
        >
          仅校验
        </button>
        <button
          type="button"
          disabled={busy === true}
          onClick={() => {
            void saveMutation.mutateAsync({ yaml: draft });
          }}
          className="cursor-pointer rounded-xl bg-linear-to-r from-amber-400 via-fuchsia-500 to-purple-600 px-4 py-2 text-xs font-black text-black shadow-md disabled:opacity-35"
        >
          校验通过后写回磁盘
        </button>
        <span className="self-center font-mono text-[0.72rem] text-white/45">
          `agents.config.yaml`
        </span>
      </div>

      {validateHints !== null && validateHints.length > 0 ? (
        <ValidateHintList lines={validateHints} />
      ) : null}

      {validateHints !== null && validateHints.length === 0 ? (
        <div className="rounded-xl border border-emerald-400/35 bg-emerald-950/35 px-3 py-2 font-mono text-[0.72rem] text-emerald-100/90">
          校验：无 Zod 报错
        </div>
      ) : null}

      {note !== null ? (
        <div className="font-mono text-[0.74rem] text-fuchsia-100/90">{note}</div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <ConsoleLabel htmlFor="agent-console-yaml-draft" className="text-white/60 shrink-0">
          YAML 草稿（{config.yamlPath}）
        </ConsoleLabel>
        <ConsoleTextarea
          id="agent-console-yaml-draft"
          spellCheck={false}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
          }}
        />
      </div>

      {busy ? (
        <p className="font-mono text-[0.7rem] text-white/42">处理中…</p>
      ) : null}
    </div>
  );
};
