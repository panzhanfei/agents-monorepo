const TOKEN_KEY = "agents_access_token_v1";
const REFRESH_KEY = "agents_refresh_token_v1";

export const readStoredToken = (): string | null => localStorage.getItem(TOKEN_KEY);

export const writeStoredToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const clearStoredToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

export const readStoredRefresh = (): string | null => localStorage.getItem(REFRESH_KEY);

export const writeStoredRefresh = (token: string): void => {
  localStorage.setItem(REFRESH_KEY, token);
};

export const clearStoredRefresh = (): void => {
  localStorage.removeItem(REFRESH_KEY);
};

export const clearAllStoredAuth = (): void => {
  clearStoredToken();
  clearStoredRefresh();
};
