import { lazy } from "react";

export const AgentModelsPageLazy = lazy(() =>
  import("@/pages/agent-models").then((m) => ({ default: m.AgentModelsPage })),
);

export const LoginPageLazy = lazy(() => import("@/pages/login").then((m) => ({ default: m.LoginPage })));

export const RegisterPageLazy = lazy(() =>
  import("@/pages/register").then((m) => ({ default: m.RegisterPage })),
);

export const ProjectsPageLazy = lazy(() =>
  import("@/pages/projects").then((m) => ({ default: m.ProjectsPage })),
);

export const ProjectTasksPageLazy = lazy(() =>
  import("@/pages/project-tasks").then((m) => ({ default: m.ProjectTasksPage })),
);

export const ProjectDialoguePageLazy = lazy(() =>
  import("@/pages/project-dialogue").then((m) => ({ default: m.ProjectDialoguePage })),
);

export const ProjectConfigPageLazy = lazy(() =>
  import("@/pages/project-config").then((m) => ({ default: m.ProjectConfigPage })),
);

export const RunnerRegisterPageLazy = lazy(() =>
  import("@/pages/runner-register").then((m) => ({ default: m.RunnerRegisterPage })),
);

export const LocalInitPageLazy = lazy(() =>
  import("@/pages/local-init").then((m) => ({ default: m.LocalInitPage })),
);

export const SettingsPageLazy = lazy(() =>
  import("@/pages/settings").then((m) => ({ default: m.SettingsPage })),
);
