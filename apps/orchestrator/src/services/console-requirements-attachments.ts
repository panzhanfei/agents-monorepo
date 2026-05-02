import type { IRequirementsImageAttachment } from '@agents/pipeline-core';

const IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

const normalizeMime = (s: string): string => s.trim().toLowerCase();

export type IConsoleRequirementsTextFile = {
  readonly name: string;
  readonly content: string;
};

export type IParsedConsoleRequirementsAttachments = {
  readonly textFiles: IConsoleRequirementsTextFile[];
  readonly images: IRequirementsImageAttachment[];
};

const empty: IParsedConsoleRequirementsAttachments = {
  textFiles: [],
  images: [],
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * 解析控制台 `metadata.consoleRequirementsAttachments`；非法或超大字段会截断/丢弃。
 */
export const parseConsoleRequirementsAttachments = (
  raw: unknown
): IParsedConsoleRequirementsAttachments => {
  if (!isPlainObject(raw)) {
    return empty;
  }

  const textFilesIn = raw.textFiles;
  const imagesIn = raw.images;

  const textFiles: IConsoleRequirementsTextFile[] = [];
  if (Array.isArray(textFilesIn)) {
    for (const item of textFilesIn.slice(0, 8)) {
      if (!isPlainObject(item)) {
        continue;
      }
      const name =
        typeof item.name === 'string'
          ? item.name.replace(/\r|\n/g, ' ').trim().slice(0, 240)
          : 'unnamed.txt';
      const content =
        typeof item.content === 'string' ? item.content : '';
      const slice = content.slice(0, 80_000);
      if (slice.trim() !== '') {
        textFiles.push({ name: name === '' ? 'unnamed.txt' : name, content: slice });
      }
    }
  }

  const images: IRequirementsImageAttachment[] = [];
  if (Array.isArray(imagesIn)) {
    for (const item of imagesIn.slice(0, 6)) {
      if (!isPlainObject(item)) {
        continue;
      }
      const mimeType =
        typeof item.mimeType === 'string'
          ? normalizeMime(item.mimeType)
          : '';
      const base64 =
        typeof item.base64 === 'string' ? item.base64.trim() : '';
      if (
        mimeType === '' ||
        !IMAGE_MIMES.has(mimeType) ||
        base64.length < 32 ||
        base64.length > 3_500_000
      ) {
        continue;
      }
      images.push({ mimeType, base64 });
    }
  }

  let textBudget = 170_000;
  const limitedText: IConsoleRequirementsTextFile[] = [];
  for (const f of textFiles) {
    const take = Math.min(f.content.length, textBudget);
    if (take <= 0) {
      break;
    }
    limitedText.push({
      name: f.name,
      content: f.content.slice(0, take),
    });
    textBudget -= take;
  }

  return { textFiles: limitedText, images };
};

export const mergeConsoleTextFilesIntoRawRequirement = (
  baseText: string,
  textFiles: readonly IConsoleRequirementsTextFile[]
): string => {
  if (textFiles.length === 0) {
    return baseText;
  }
  const blocks = textFiles
    .map(
      (f) =>
        `### 附件：${f.name}\n\n${f.content.trim()}`
    )
    .join('\n\n---\n\n');
  return [
    '【以下为上传的文本类文档/片段，请在 PRD 中逐条吸收其需求要点】',
    '',
    blocks,
    '',
    '---',
    '',
    '【用户本条消息正文】',
    '',
    baseText.trim(),
  ].join('\n');
};

export const stripConsoleRequirementsAttachmentsFromMetadata = (
  meta: Record<string, unknown>
): Record<string, unknown> => {
  if (!isPlainObject(meta)) {
    return {};
  }
  const next: Record<string, unknown> = { ...meta };
  delete next.consoleRequirementsAttachments;
  return next;
};
