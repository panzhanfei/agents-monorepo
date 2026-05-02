import { extractPdfTextInBrowser } from './extract-pdf-text';

const MAX_REQ_PDF_BYTES = 40 * 1024 * 1024;

const REQ_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

const isReqPdfFile = (f: File): boolean =>
  f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

const isReqTextFile = (f: File): boolean =>
  isReqPdfFile(f) !== true &&
  (f.type.startsWith('text/') === true ||
    /\.(txt|md|markdown|json|yaml|yml|csv)$/i.test(f.name));

const readFileAsUtf8 = (f: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = (): void => {
      resolve(typeof r.result === 'string' ? r.result : '');
    };
    r.onerror = (): void => {
      reject(new Error(r.error?.message ?? '读取失败'));
    };
    r.readAsText(f, 'UTF-8');
  });

const readFileAsDataUrl = (f: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = (): void => {
      resolve(typeof r.result === 'string' ? r.result : '');
    };
    r.onerror = (): void => {
      reject(new Error(r.error?.message ?? '读取失败'));
    };
    r.readAsDataURL(f);
  });

export type IMaterializedConsoleAttachments = {
  readonly textFiles: readonly { readonly name: string; readonly content: string }[];
  readonly images: readonly { readonly mimeType: string; readonly base64: string }[];
};

/**
 * 在用户点击「发送」时将暂存的 File 转成可 POST 的附件正文（含 PDF 抽取）。
 */
export const materializeConsoleRequirementAttachments = async (
  pendingTextish: readonly { readonly file: File }[],
  pendingImages: readonly { readonly file: File }[]
): Promise<
  | { readonly ok: true; readonly data: IMaterializedConsoleAttachments }
  | { readonly ok: false; readonly error: string }
> => {
  const textFiles: { name: string; content: string }[] = [];
  const images: { mimeType: string; base64: string }[] = [];
  const errors: string[] = [];

  for (const { file: f } of pendingTextish) {
    const label = f.name;

    if (isReqPdfFile(f)) {
      if (f.size > MAX_REQ_PDF_BYTES) {
        errors.push(`${label}：PDF 超过 40MB`);
        continue;
      }
      try {
        const txt = await extractPdfTextInBrowser(f);
        const slice = txt.slice(0, 80_000);
        if (slice.trim() === '') {
          errors.push(
            `${label}：PDF 无可用文本（多为扫描件，请上传图片并启用视觉模型）`
          );
          continue;
        }
        textFiles.push({ name: label, content: slice });
      } catch (e) {
        errors.push(
          `${label}：PDF 解析失败（${
            e instanceof Error ? e.message : '未知错误'
          }）`
        );
      }
      continue;
    }

    if (isReqTextFile(f)) {
      try {
        const txt = await readFileAsUtf8(f);
        const slice = txt.slice(0, 80_000);
        if (slice.trim() === '') {
          errors.push(`${label}：空文件`);
          continue;
        }
        textFiles.push({ name: label, content: slice });
      } catch {
        errors.push(`${label}：读取失败`);
      }
      continue;
    }

    errors.push(`${label}：非预期类型`);
  }

  for (const { file: f } of pendingImages) {
    const label = f.name;
    if (
      f.type.startsWith('image/') !== true ||
      !REQ_IMAGE_MIMES.has(f.type)
    ) {
      errors.push(`${label}：不支持的图片`);
      continue;
    }
    try {
      const dataUrl = await readFileAsDataUrl(f);
      const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
      if (m === null) {
        errors.push(`${label}：无法解析图片数据`);
        continue;
      }
      const mime = (m[1] ?? '').toLowerCase();
      const b64 = m[2] ?? '';
      if (!REQ_IMAGE_MIMES.has(mime) || b64.length < 32) {
        errors.push(`${label}：不支持的图片格式`);
        continue;
      }
      if (b64.length > 3_000_000) {
        errors.push(`${label}：图片过大`);
        continue;
      }
      images.push({ mimeType: mime, base64: b64 });
    } catch {
      errors.push(`${label}：读取失败`);
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: `（附件）${errors.slice(0, 8).join('；')}`,
    };
  }

  return {
    ok: true,
    data: { textFiles, images },
  };
};
