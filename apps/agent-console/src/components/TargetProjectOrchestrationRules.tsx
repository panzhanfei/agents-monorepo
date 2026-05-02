import type { ChangeEvent, JSX } from 'react';
import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  deleteAiRuleFile,
  fetchAiRulesList,
  uploadAiRulesFiles,
} from '~/api/target-ai-rules';
import { queryKeys } from '~/api/query-keys';
import { toast } from 'sonner';

export type ITargetProjectOrchestrationRulesProps = {
  readonly projectId: string;
};

const formatBytes = (n: number): string => {
  if (n < 1024) {
    return `${String(n)} B`;
  }
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KiB`;
  }
  return `${(n / (1024 * 1024)).toFixed(1)} MiB`;
};

export const TargetProjectOrchestrationRules = ({
  projectId,
}: ITargetProjectOrchestrationRulesProps): JSX.Element => {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const trimmedId = projectId.trim();

  const listQ = useQuery({
    queryKey: queryKeys.targetAiRules(trimmedId),
    queryFn: async () => fetchAiRulesList(trimmedId),
    enabled: trimmedId !== '',
  });

  const uploadMu = useMutation({
    mutationFn: (files: readonly File[]) => uploadAiRulesFiles(trimmedId, files),
    onSuccess: async (names) => {
      toast.success(`已保存 ${String(names.length)} 个文件`);
      await qc.invalidateQueries({ queryKey: queryKeys.targetAiRules(trimmedId) });
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const deleteMu = useMutation({
    mutationFn: (fileName: string) => deleteAiRuleFile(trimmedId, fileName),
    onSuccess: async () => {
      toast.success('已删除');
      await qc.invalidateQueries({ queryKey: queryKeys.targetAiRules(trimmedId) });
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const onPickFiles = (): void => {
    fileRef.current?.click();
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const picked = e.target.files;
    if (picked === null || picked.length === 0) {
      return;
    }
    const arr = Array.from(picked);
    uploadMu.mutate(arr);
    e.target.value = '';
  };

  const files = listQ.data ?? [];

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept=".md,.mdc,text/markdown"
        multiple
        className="sr-only"
        onChange={onFileChange}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onPickFiles}
          disabled={
            trimmedId === '' || uploadMu.isPending === true
          }
          className="cursor-pointer rounded-lg border border-violet-400/45 bg-violet-600/20 px-3 py-2 text-[0.72rem] font-semibold text-violet-100/95 transition hover:bg-violet-600/30 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {uploadMu.isPending === true ? '上传中…' : '选择 .mdc / .md 文件'}
        </button>
        <p className="text-[0.62rem] leading-snug text-white/42">
          写入本编排仓{' '}
          <span className="font-mono text-white/52">
            customer-targets/{trimmedId || '<id>'}/ai-rules/
          </span>
          ，单文件 ≤ 2MiB。
        </p>
      </div>

      {listQ.isLoading === true ? (
        <p className="font-mono text-[0.68rem] text-white/35">加载列表…</p>
      ) : listQ.isError === true ? (
        <p className="text-[0.68rem] text-red-300/90">
          {(listQ.error as Error).message}
        </p>
      ) : files.length === 0 ? (
        <p className="rounded-lg border border-white/8 bg-black/30 px-2 py-2 font-mono text-[0.68rem] text-white/40">
          暂无编排侧规则文件。上传后 Runner 在绑定此目标 id 时会并入审核。
        </p>
      ) : (
        <ul className="max-h-52 space-y-1.5 overflow-y-auto rounded-lg border border-white/10 bg-black/35 px-2 py-2">
          {files.map((f) => (
            <li
              key={f.name}
              className="flex items-center justify-between gap-3 rounded-md border border-white/6 bg-white/4 px-2 py-1.5 font-mono text-[0.72rem] text-violet-50/95"
            >
              <span className="min-w-0 shrink truncate" title={f.name}>
                {f.name}
              </span>
              <span className="shrink-0 text-white/40">
                {formatBytes(f.sizeBytes)}
              </span>
              <button
                type="button"
                onClick={() => {
                  deleteMu.mutate(f.name);
                }}
                disabled={deleteMu.isPending === true}
                className="shrink-0 cursor-pointer rounded-md border border-red-500/35 px-2 py-0.5 text-[0.62rem] text-red-200/90 hover:bg-red-500/15 disabled:opacity-45"
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
