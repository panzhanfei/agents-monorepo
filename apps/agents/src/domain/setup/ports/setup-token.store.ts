export interface ISetupTokenStore {
  getPending(): string | null;
  setPending(token: string): void;
  clearPending(): void;
  newToken(): string;
}
