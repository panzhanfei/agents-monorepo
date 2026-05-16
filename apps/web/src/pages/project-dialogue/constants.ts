/** 原生容器替代 Radix Card，避免 Card 内部样式把 flex/grid 子项高度算成 0、输入框被裁切 */
export const DIALOGUE_SHELL =
  "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--gray-a6)] bg-[var(--gray-a2)] shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04)]";
