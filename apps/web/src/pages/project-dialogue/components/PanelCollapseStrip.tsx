import type { IPanelCollapseStripProps } from "../interface";

/** 侧栏收起后的窄条，点击展开 */
export const PanelCollapseStrip = ({ label, side, onExpand }: IPanelCollapseStripProps) => (
  <button
    type="button"
    onClick={onExpand}
    title={`展开${label}`}
    className="flex min-h-[8rem] w-10 shrink-0 flex-col items-center justify-center gap-1 self-stretch rounded-2xl border border-[var(--gray-a6)] bg-[var(--gray-a2)] px-1 py-3 text-[var(--gray-11)] shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04)] transition-colors hover:bg-[var(--gray-a3)]"
  >
    <span
      className="text-[11px] font-medium leading-tight"
      style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
    >
      {label}
    </span>
    <span className="text-xs opacity-80">{side === "left" ? "›" : "‹"}</span>
  </button>
);
