import { NavLink, Route, Routes } from "react-router-dom";
import "./App.css";
import { useAuth } from "@/auth";
import {
  LoginPage,
  ProjectTasksPage,
  ProjectsPage,
  RegisterPage,
  RunnerRegisterPage,
  SettingsPage,
} from "@/pages";
import { Protected } from "@/routes";

const navCls = ({ isActive }: { isActive: boolean }): string => (isActive ? "active" : "");

export const App = () => {
  const { accessToken, clearSession } = useAuth();

  return (
    <div className="appShell">
      <header className="topNav">
        <div className="brand">Agents Console</div>

        {accessToken ? (
          <>
            <nav className="navLinks">
              <NavLink to="/projects" className={navCls}>
                项目
              </NavLink>
              <NavLink to="/runners" className={navCls}>
                Runner
              </NavLink>
              <NavLink to="/settings" className={navCls}>
                设置
              </NavLink>
            </nav>
            <button type="button" className="secondary" onClick={() => clearSession()}>
              退出
            </button>
          </>
        ) : (
          <nav className="navLinks">
            <NavLink to="/login" className={navCls}>
              登录
            </NavLink>
            <NavLink to="/register" className={navCls}>
              注册
            </NavLink>
          </nav>
        )}
      </header>

      <main>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route element={<Protected />}>
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:projectId/tasks" element={<ProjectTasksPage />} />
            <Route path="/runners" element={<RunnerRegisterPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          <Route path="/" element={<LoginPage />} />
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </main>
    </div>
  );
};
