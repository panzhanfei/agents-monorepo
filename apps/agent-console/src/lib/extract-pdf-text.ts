import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

let workerReady = false;

const ensurePdfWorker = (): void => {
  if (workerReady === true) {
    return;
  }
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  workerReady = true;
};

const MAX_PDF_PAGES = 80;
const MAX_CHARS = 80_000;

/**
 * 浏览器内从 PDF 抽取 UTF-8 文本（依赖文本层；纯扫描件可能几乎无字）。
 */
export const extractPdfTextInBrowser = async (file: File): Promise<string> => {
  ensurePdfWorker();
  const buf = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buf) });
  const pdf = await loadingTask.promise;
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const parts: string[] = [];

  for (let i = 1; i <= pageCount; i += 1) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const line = textContent.items
      .map((item) => {
        if (item !== null && typeof item === 'object' && 'str' in item) {
          const s = (item as { str?: unknown }).str;
          return typeof s === 'string' ? s : '';
        }
        return '';
      })
      .filter((s) => s !== '')
      .join(' ');
    parts.push(line);
  }

  if (pdf.numPages > MAX_PDF_PAGES) {
    parts.push(
      `\n\n[… 已省略第 ${String(MAX_PDF_PAGES + 1)} 页及以后，共 ${String(pdf.numPages)} 页 …]`
    );
  }

  return parts.join('\n\n').trim().slice(0, MAX_CHARS);
};
