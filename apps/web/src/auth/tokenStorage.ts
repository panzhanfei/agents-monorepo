const TOKEN_KEY = "agents_access_token_v1";
const PROJECT_KEY = "agents_current_project_id_v1";

export const readStoredToken = (): string | null => localStorage.getItem(TOKEN_KEY);

export const writeStoredToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const clearStoredToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

export const readStoredProjectId = (): string | null => localStorage.getItem(PROJECT_KEY);

export const writeStoredProjectId = (projectId: string): void => {
  localStorage.setItem(PROJECT_KEY, projectId);
};
