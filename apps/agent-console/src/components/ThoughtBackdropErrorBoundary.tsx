import type { JSX, ReactNode } from 'react';
import type { ErrorInfo } from 'react';
import { Component } from 'react';

type IProps = {
  readonly children: ReactNode;
  readonly fallback: ReactNode;
};

type IState = {
  hasError: boolean;
};

/** Catches synchronous failures inside @react-three/fiber Canvas (e.g. WebGL unavailable). */
export class ThoughtBackdropErrorBoundary extends Component<IProps, IState> {
  public constructor(props: IProps) {
    super(props);
    this.state = { hasError: false };
  }

  public static getDerivedStateFromError(): Partial<IState> {
    return { hasError: true };
  }

  public override componentDidCatch(error: unknown, info: ErrorInfo): void {
    if (process.env.NODE_ENV !== 'production') {
      const msg =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : String(error);
      console.debug(
        '[agent-console] ThoughtBackdrop WebGL unreachable',
        msg,
        info.componentStack,
      );
    }
  }

  public render(): JSX.Element {
    const { children, fallback } = this.props;

    return this.state.hasError ? <>{fallback}</> : <>{children}</>;
  }
}
