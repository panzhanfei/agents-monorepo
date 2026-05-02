import type { JSX, ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

type IThoughtBackdropDrive = {
  readonly linked: boolean;
  readonly setLinked: (v: boolean) => void;
};

const ThoughtBackdropDriveContext = createContext<IThoughtBackdropDrive | null>(
  null,
);

export const ThoughtBackdropDriveProvider = ({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element => {
  const [linked, setLinkedState] = useState(false);
  const setLinked = useCallback((v: boolean) => {
    setLinkedState(v);
  }, []);

  const value = useMemo<IThoughtBackdropDrive>(
    () => ({ linked, setLinked }),
    [linked, setLinked],
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

/** Backdrop reads linked target when Provider exists (tests / Storybook may omit). */
export const useThoughtBackdropLinkedOptional = (): boolean => {
  return useContext(ThoughtBackdropDriveContext)?.linked ?? false;
};
