export type IRunnerRow = {
  id: string;
  deviceKey: string;
  displayName: string | null;
  lastSeenAt: string | null;
};

export type IRunnersListResponse = {
  runners: IRunnerRow[];
};

export type IRunnerRegisterRunnerPayload = {
  id: string;
  deviceKey: string;
  displayName: string | null;
  createdAt: string;
};

export type IRunnerRegisterResponse = {
  runner: IRunnerRegisterRunnerPayload;
  deviceSecret: string;
};
