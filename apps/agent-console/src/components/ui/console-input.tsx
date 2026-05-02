import clsx from 'clsx';
import type { InputHTMLAttributes, JSX, TextareaHTMLAttributes } from 'react';

const inputShell =
  'border border-white/12 bg-black/45 font-mono outline-none transition-colors hover:border-white/18 focus-visible:border-cyan-400/45 focus-visible:ring-2 focus-visible:ring-cyan-400/25 disabled:pointer-events-none disabled:opacity-45';

export type IConsoleTextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  readonly className?: string;
};

/** 与 ConsoleSelect 触发器一致的暗色圆角单行框（Radix 控制台表单族） */
export const ConsoleTextInput = ({
  className,
  ...rest
}: IConsoleTextInputProps): JSX.Element => (
  <input
    {...rest}
    className={clsx(
      'block h-9 w-full min-w-0 cursor-text rounded-lg px-2 py-2 text-xs leading-none text-white placeholder:text-white/25',
      inputShell,
      className,
    )}
  />
);

export type IConsoleNumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> & {
  readonly className?: string;
};

/** 数字专用：右对齐，隐藏 spin（与整站暗色输入一致） */
export const ConsoleNumberInput = ({
  className,
  ...rest
}: IConsoleNumberInputProps): JSX.Element => (
  <input
    type="number"
    {...rest}
    className={clsx(
      'flex h-9 cursor-text items-center justify-end rounded-lg px-2 py-2 text-right text-xs text-cyan-50/95 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
      inputShell,
      className,
    )}
  />
);

export type IConsoleTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  readonly className?: string;
  readonly density?: 'default' | 'compact';
};

const textareaDensity: Record<
  NonNullable<IConsoleTextareaProps['density']>,
  string
> = {
  default:
    'min-h-[10rem] max-h-[min(32vh,22rem)] flex-1 resize-y px-4 py-4 font-mono text-[0.78rem] leading-relaxed',
  compact:
    'min-h-0 flex-1 resize-none px-3 py-2 text-sm leading-snug text-white placeholder:text-white/30',
};

/** 多行：YAML 草稿用 default；聊天输入用 compact */
export const ConsoleTextarea = ({
  className,
  density = 'default',
  ...rest
}: IConsoleTextareaProps): JSX.Element => (
  <textarea
    {...rest}
    className={clsx(
      'w-full cursor-text overflow-y-auto rounded-2xl border border-white/12 bg-black/60 text-cyan-50/95 outline-none transition-colors hover:border-white/18 focus-visible:border-fuchsia-400/60 focus-visible:ring-2 focus-visible:ring-fuchsia-400/25',
      density === 'compact'
        ? 'rounded-xl border-white/10 bg-black/55 focus-visible:border-fuchsia-400/60'
        : null,
      textareaDensity[density],
      className,
    )}
  />
);
