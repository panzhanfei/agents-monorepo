import { lazy } from "react";

export const LoginPageLazy = lazy(() =>
  import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })),
);

export const RegisterPageLazy = lazy(() =>
  import("@/pages/RegisterPage").then((m) => ({ default: m.RegisterPage })),
);

export const ProjectsPageLazy = lazy(() =>
  import("@/pages/ProjectsPage").then((m) => ({ default: m.ProjectsPage })),
);

export const ProjectTasksPageLazy = lazy(() =>
  import("@/pages/ProjectTasksPage").then((m) => ({ default: m.ProjectTasksPage })),
);

export const RunnerRegisterPageLazy = lazy(() =>
  import("@/pages/RunnerRegisterPage").then((m) => ({ default: m.RunnerRegisterPage })),
);

export const SettingsPageLazy = lazy(() =>
  import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
