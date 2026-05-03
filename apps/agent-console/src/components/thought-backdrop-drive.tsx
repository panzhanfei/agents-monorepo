import type { JSX, ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';

export type IThoughtBackdropPhase = 'idle' | 'input' | 'thinking';

type IThoughtBackdropRefs = {
  readonly phaseRef: React.MutableRefObject<IThoughtBackdropPhase>;
  /** 0..1 瞬时输入强度，由 R3F 每帧衰减/平滑 */
  readonly inputSpikeRef: React.MutableRefObject<number>;
};

type IThoughtBackdropDrive = IThoughtBackdropRefs & {
  readonly setBackdropPhase: (p: IThoughtBackdropPhase) => void;
  readonly pulseInputTyping: (charsPerSecond: number) => void;
};

const ThoughtBackdropDriveContext = createContext<IThoughtBackdropDrive | null>(
  null,
);

export const ThoughtBackdropDriveProvider = ({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element => {
  const phaseRef = useRef<IThoughtBackdropPhase>('idle');
  const inputSpikeRef = useRef(0);

  const setBackdropPhase = useCallback((p: IThoughtBackdropPhase) => {
    phaseRef.current = p;
  }, []);

  const pulseInputTyping = useCallback((charsPerSecond: number) => {
    const cps = Number.isFinite(charsPerSecond) ? charsPerSecond : 0;
    const next = Math.min(1, Math.max(0, cps / 14));
    inputSpikeRef.current = Math.max(inputSpikeRef.current, next);
  }, []);

  const value = useMemo<IThoughtBackdropDrive>(
    () => ({
      phaseRef,
      inputSpikeRef,
      setBackdropPhase,
      pulseInputTyping,
    }),
    [setBackdropPhase, pulseInputTyping],
  );

  return (
    <ThoughtBackdropDriveContext.Provider value={value}>
      {children}
    </ThoughtBackdropDriveContext.Provider>
  );
};

export const useThoughtBackdropDrive = (): IThoughtBackdropDrive => {
  const ctx = useContext(ThoughtBackdropDriveContext);
  if (ctx === null) {
    throw new Error(
      'useThoughtBackdropDrive must be used within ThoughtBackdropDriveProvider',
    );
  }
  return ctx;
};

/** Fiber 子树读取相位与输入强度（无订阅 React state，避免高频重渲染） */
export const useThoughtBackdropPhysics = (): IThoughtBackdropRefs => {
  const ctx = useContext(ThoughtBackdropDriveContext);
  if (ctx === null) {
    return {
      phaseRef: { current: 'idle' },
      inputSpikeRef: { current: 0 },
    };
  }
  return { phaseRef: ctx.phaseRef, inputSpikeRef: ctx.inputSpikeRef };
};
