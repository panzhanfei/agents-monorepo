export type IClipboardCopyResult =
  | { ok: true; note: string }
  | { ok: false; error: string };

export const copyLabelToClipboard = async (label: string, text: string): Promise<IClipboardCopyResult> => {
  try {
    await navigator.clipboard.writeText(text);
    return { ok: true, note: `已复制：${label}` };
  } catch {
    return { ok: false, error: "复制失败（浏览器权限）" };
  }
};
