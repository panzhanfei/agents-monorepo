import { Root as RadixLabel } from '@radix-ui/react-label';
import clsx from 'clsx';
import type { JSX, ReactNode } from 'react';

import { r19Radix } from '~/lib/r19-radix';

const LabelRoot = r19Radix(RadixLabel);

type IProps = {
  readonly htmlFor?: string;
  readonly className?: string;
  readonly children: ReactNode;
};

/** Radix Label：与控件 `id`/`htmlFor` 对齐时可读性更佳 */
export const ConsoleLabel = ({
  htmlFor,
  className,
  children,
}: IProps): JSX.Element => (
  <LabelRoot
    htmlFor={htmlFor}
    className={clsx(
      'mb-1 block cursor-default select-none text-[0.8rem] leading-tight text-white/72',
      className,
    )}
  >
    {children}
  </LabelRoot>
);
