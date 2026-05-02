import {
  Content,
  Icon,
  Item,
  ItemText,
  Portal,
  Root,
  Trigger,
  Value,
  Viewport,
} from '@radix-ui/react-select';
import clsx from 'clsx';
import type { JSX } from 'react';

import { r19Radix } from '~/lib/r19-radix';

const SelectRoot = r19Radix(Root);
const SelectTrigger = r19Radix(Trigger);
const SelectValue = r19Radix(Value);
const SelectIcon = r19Radix(Icon);
const SelectPortal = r19Radix(Portal);
const SelectContent = r19Radix(Content);
const SelectViewport = r19Radix(Viewport);
const SelectItem = r19Radix(Item);
const SelectItemText = r19Radix(ItemText);

export type IConsoleSelectOption = {
  readonly value: string;
  readonly label: string;
};

type IProps = {
  readonly id?: string;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly options: readonly IConsoleSelectOption[];
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly className?: string;
};

const ChevronDown = (): JSX.Element => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
    className="shrink-0 opacity-70"
  >
    <path
      d="M2.5 4.25L6 7.75L9.5 4.25"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Radix Select：与控制台输入框一致的暗色边框与圆角 */
export const ConsoleSelect = ({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  className,
}: IProps): JSX.Element => (
  <SelectRoot value={value} onValueChange={onValueChange} disabled={disabled}>
    <SelectTrigger
      id={id}
      className={clsx(
        'flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-white/12 bg-black/45 px-2 py-2 font-mono text-xs text-white outline-none transition-colors',
        'hover:border-white/18',
        'focus-visible:border-cyan-400/45 focus-visible:ring-2 focus-visible:ring-cyan-400/25',
        'data-[placeholder]:text-white/45',
        'disabled:pointer-events-none disabled:opacity-45',
        className,
      )}
    >
      <SelectValue placeholder={placeholder} />
      <SelectIcon asChild>
        <span className="text-white/75">
          <ChevronDown />
        </span>
      </SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        sideOffset={6}
        collisionPadding={8}
        className={clsx(
          'z-[200] max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-cyan-400/28 bg-zinc-950/97 shadow-xl shadow-black/60 backdrop-blur-md',
        )}
      >
        <SelectViewport className="p-1">
          {options.map((opt) => (
            <SelectItem
              key={opt.value}
              value={opt.value}
              className={clsx(
                'relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 font-mono text-xs text-white/92 outline-none',
                'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
                'data-[highlighted]:bg-cyan-500/18 data-[highlighted]:text-cyan-50',
              )}
            >
              <SelectItemText>{opt.label}</SelectItemText>
            </SelectItem>
          ))}
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
);
