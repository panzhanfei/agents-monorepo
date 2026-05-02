/** 控制台本地存的 Bearer（与 AGENT_CONSOLE_API_TOKEN 一致时生效） */

const STORAGE = 'agents-console:bearer-token';

export const readConsoleBearer = (): string => {
  if (typeof localStorage === 'undefined') {
    return '';
  }
  return localStorage.getItem(STORAGE)?.trim() ?? '';
};

export const persistConsoleBearer = (token: string): void => {
  if (typeof localStorage === 'undefined') {
    return;
  }
  if (token.trim() === '') {
    localStorage.removeItem(STORAGE);
    return;
  }
  localStorage.setItem(STORAGE, token.trim());
};
