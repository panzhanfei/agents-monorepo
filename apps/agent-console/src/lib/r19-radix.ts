import type { ComponentProps, ComponentType, ElementType } from 'react';

/**
 * Radix 多为 `ForwardRefExoticComponent`，与 React 19 的 `JSX.ElementType` 在
 * 仓库里曾并存多份 `@types/react`（如 18 与 19）时，TS 会误报「不能用作 JSX 组件」。
 * 用 `ElementType` + `ComponentProps` 收窄为可 JSX 化的函数组件类型。
 */
export const r19Radix = <T extends ElementType>(
  C: T,
): ComponentType<ComponentProps<T>> => C as ComponentType<ComponentProps<T>>;
