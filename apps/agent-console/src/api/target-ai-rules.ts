import { authorizedFetchHeaders } from '~/lib/request-headers';

export type ITargetAiRuleFile = {
  readonly name: string;
  readonly sizeBytes: number;
};

export const fetchAiRulesList = async (
  projectId: string,
): Promise<ITargetAiRuleFile[]> => {
  const id = projectId.trim();
  if (id === '') {
    return [];
  }

  const res = await fetch(`/api/target-projects/${encodeURIComponent(id)}/ai-rules`, {
    headers: authorizedFetchHeaders(),
  });
  const json = (await res.json()) as {
    ok?: boolean;
    files?: ITargetAiRuleFile[];
    message?: string;
  };

  if (!res.ok || json.ok !== true || !Array.isArray(json.files)) {
    const hint =
      typeof json.message === 'string' && json.message !== ''
        ? json.message
        : `HTTP ${String(res.status)}`;
    throw new Error(`读取审核规则列表失败：${hint}`);
  }

  return json.files;
};

export const uploadAiRulesFiles = async (
  projectId: string,
  files: readonly File[],
): Promise<readonly string[]> => {
  const id = projectId.trim();
  if (id === '') {
    throw new Error('目标 id 为空');
  }
  if (files.length === 0) {
    throw new Error('未选择文件');
  }

  const fd = new FormData();
  for (const f of files) {
    fd.append('files', f);
  }

  const res = await fetch(`/api/target-projects/${encodeURIComponent(id)}/ai-rules`, {
    method: 'POST',
    body: fd,
    headers: authorizedFetchHeaders(),
  });

  const json = (await res.json()) as {
    ok?: boolean;
    writtenNames?: string[];
    message?: string;
  };

  if (!res.ok || json.ok !== true || !Array.isArray(json.writtenNames)) {
    const hint =
      typeof json.message === 'string' && json.message !== ''
        ? json.message
        : `HTTP ${String(res.status)}`;
    throw new Error(`上传失败：${hint}`);
  }

  return json.writtenNames;
};

export const deleteAiRuleFile = async (
  projectId: string,
  fileName: string,
): Promise<void> => {
  const id = projectId.trim();
  const name = fileName.trim();
  if (id === '' || name === '') {
    throw new Error('参数不完整');
  }

  const res = await fetch(
    `/api/target-projects/${encodeURIComponent(id)}/ai-rules/${encodeURIComponent(name)}`,
    {
      method: 'DELETE',
      headers: authorizedFetchHeaders(),
    },
  );

  const json = (await res.json()) as { ok?: boolean; message?: string };

  if (!res.ok || json.ok !== true) {
    const hint =
      typeof json.message === 'string' && json.message !== ''
        ? json.message
        : `HTTP ${String(res.status)}`;
    throw new Error(`删除失败：${hint}`);
  }
};
