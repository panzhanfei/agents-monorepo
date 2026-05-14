import { Suspense } from "react";
import { Box, Button, Flex, Heading } from "@radix-ui/themes";
import { NavLink, Route, Routes } from "react-router-dom";
import { useAuth } from "@/auth";
import {
  AgentModelsPageLazy,
  LocalInitPageLazy,
  LoginPageLazy,
  ProjectTasksPageLazy,
  ProjectDialoguePageLazy,
  ProjectConfigPageLazy,
  ProjectsPageLazy,
  ProjectWorkspaceLayout,
  Protected,
  RegisterPageLazy,
  RouteFallback,
  RunnerRegisterPageLazy,
  SettingsPageLazy,
} from "@/routes";

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  [
    "rounded-md px-3 py-1.5 text-sm font-medium no-underline transition-colors outline-offset-2",
    isActive ? "bg-[var(--accent-a4)] text-[var(--gray-12)]" : "text-[var(--gray-11)] hover:bg-[var(--gray-a3)]",
  ].join(" ");

export const App = () => {
  const { accessToken, clearSession } = useAuth();

  return (
    <Box className="grid h-[100dvh] min-h-0 grid-rows-[auto_minmax(0,1fr)]">
      <Box
        px="4"
        py="3"
        className="sticky top-0 z-10 border-b border-[var(--gray-a6)] bg-[var(--color-panel-translucent)] backdrop-blur-md"
      >
        <Flex align="center" gap="4" mx="auto" className="max-w-[1080px]">
          <Heading as="h1" size="5" weight="bold" mb="0">
            Agents Console
          </Heading>
          {accessToken ? (
            <>
              <Flex flexGrow="1" justify="center" gap="2" wrap="wrap">
                <NavLink to="/projects" className={navLinkClass}>
                  项目
                </NavLink>
                <NavLink to="/runners" className={navLinkClass}>
                  Runner
                </NavLink>
                <NavLink to="/settings" className={navLinkClass}>
                  设置
                </NavLink>
              </Flex>
              <Button type="button" variant="soft" color="gray" onClick={() => clearSession()}>
                退出
              </Button>
            </>
          ) : (
            <Flex flexGrow="1" justify="end" gap="2" wrap="wrap">
              <NavLink to="/login" className={navLinkClass}>
                登录
              </NavLink>
              <NavLink to="/register" className={navLinkClass}>
                注册
              </NavLink>
            </Flex>
          )}
        </Flex>
      </Box>

      <main className="mx-auto box-border flex min-h-0 min-w-0 w-full max-w-270 flex-1 flex-col overflow-x-hidden overflow-y-auto px-4 py-6">
        <Box className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Suspense fallback={<RouteFallback />}>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <Routes>
                <Route path="/login" element={<LoginPageLazy />} />
                <Route path="/register" element={<RegisterPageLazy />} />

                <Route element={<Protected />}>
                  <Route path="/projects" element={<ProjectsPageLazy />} />
                  <Route path="/projects/:projectId" element={<ProjectWorkspaceLayout />}>
                    <Route path="chat" element={<ProjectDialoguePageLazy />} />
                    <Route path="config" element={<ProjectConfigPageLazy />} />
                    <Route path="tasks" element={<ProjectTasksPageLazy />} />
                  </Route>
                  <Route path="/runners" element={<RunnerRegisterPageLazy />} />
                  <Route path="/settings/local-init" element={<LocalInitPageLazy />} />
                  <Route path="/settings/agent-models" element={<AgentModelsPageLazy />} />
                  <Route path="/settings" element={<SettingsPageLazy />} />
                </Route>

                <Route path="/" element={<LoginPageLazy />} />
                <Route path="*" element={<LoginPageLazy />} />
              </Routes>
            </div>
          </Suspense>
        </Box>
      </main>
    </Box>
  );
};
