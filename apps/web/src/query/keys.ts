export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  projects: {
    all: ["projects"] as const,
    list: (): readonly ["projects", "list"] => [...queryKeys.projects.all, "list"] as const,
  },
  runners: {
    all: ["runners"] as const,
    list: (): readonly ["runners", "list"] => [...queryKeys.runners.all, "list"] as const,
  },
  tasks: {
    byProject: (projectId: string): readonly ["tasks", "project", string] =>
      ["tasks", "project", projectId] as const,
    detail: (taskId: string): readonly ["tasks", "detail", string] => ["tasks", "detail", taskId] as const,
  },
} as const;
