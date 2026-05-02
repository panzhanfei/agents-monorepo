import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { authorizedJsonHeaders } from '~/lib/request-headers';

type IConfigPayload = {
  yamlPath: string;
  yamlRaw: string;
};

export type IYamlWorkbenchProps = {
  readonly config: IConfigPayload;
  readonly refetch: () => Promise<void>;
};

export const YamlWorkbench = ({
  config,
  refetch,
}: IYamlWorkbenchProps): JSX.Element => {
  const [draft, setDraft] = useState(config.yamlRaw);
  const [validateHints, setValidateHints] = useState<readonly string[] | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setDraft(config.yamlRaw);
  }, [config.yamlRaw]);

  const runValidate = useCallback(async () => {
    setNote(null);
    setBusy(true);

    try {
      const res = await fetch('/api/config/validate', {
        method: 'POST',
        headers: authorizedJsonHeaders(),
        body: JSON.stringify({ yaml: draft }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        errors?: readonly string[];
      };
      if (!res.ok) {
        setValidateHints([`HTTP ${String(res.status)}`]);
        return;
      }
      if (json.ok === true) {
        setValidateHints([]);
        setNote('结构与 `agents.config` Zod 校验一致。');
        return;
      }
      setValidateHints(json.errors ?? ['未知错误']);
    } finally {
      setBusy(false);
    }
  }, [draft]);

  const runSave = useCallback(async () => {
    setNote(null);
    setBusy(true);

    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: authorizedJsonHeaders(),
        body: JSON.stringify({ yaml: draft }),
      });

      const json = (await res.json()) as {
        ok?: boolean;
        errors?: readonly string[];
        backupPath?: string;
        yamlRaw?: string;
      };

      if (!res.ok || json.ok !== true) {
        setValidateHints(json.errors ?? ['保存失败']);
        return;
      }

      setValidateHints([]);
      setNote(
        `落盘成功${json.backupPath !== undefined ? ` · 备份 ${json.backupPath}` : ''}`
      );
      await refetch();
    } finally {
      setBusy(false);
    }
  }, [draft, refetch]);

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
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap gap-2">
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
          disabled={busy}
          onClick={() => {
            void runValidate();
          }}
          className="cursor-pointer rounded-xl border border-cyan-400/40 px-4 py-2 text-xs font-bold text-cyan-50 transition hover:bg-cyan-500/10 disabled:opacity-35"
        >
          仅校验
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void runSave();
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
        <div className="rounded-xl border border-rose-400/40 bg-rose-950/40 p-3 font-mono text-[0.72rem] text-rose-100/85">
          {validateHints.map((l) => (
            <div key={l}>· {l}</div>
          ))}
        </div>
      ) : null}

      {validateHints !== null && validateHints.length === 0 ? (
        <div className="rounded-xl border border-emerald-400/35 bg-emerald-950/35 px-3 py-2 font-mono text-[0.72rem] text-emerald-100/90">
          校验：无 Zod 报错
        </div>
      ) : null}

      {note !== null ? (
        <div className="font-mono text-[0.74rem] text-fuchsia-100/90">{note}</div>
      ) : null}

      <textarea
        value={draft}
        spellCheck={false}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        className="min-h-[22rem] flex-1 resize-y rounded-2xl border border-white/12 bg-black/60 p-4 font-mono text-[0.78rem] leading-relaxed text-cyan-50/95 focus:border-fuchsia-400/60 focus:outline-none"
      />
    </div>
  );
};
