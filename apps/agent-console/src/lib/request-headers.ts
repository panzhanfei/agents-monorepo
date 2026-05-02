import { readConsoleBearer } from '~/lib/console-storage';

export const authorizedJsonHeaders = (): Record<string, string> => {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = readConsoleBearer().trim();
  if (t !== '') {
    h.Authorization = `Bearer ${t}`;
  }
  return h;
};
