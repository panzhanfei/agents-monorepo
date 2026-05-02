import type { JSX } from 'react';
import { Toaster } from 'sonner';

import { ConsoleLayout } from '~/routes/console-layout';

const App = (): JSX.Element => (
  <>
    <ConsoleLayout />

    <Toaster closeButton duration={5600} position="top-center" richColors theme="dark" />
  </>
);

export default App;
