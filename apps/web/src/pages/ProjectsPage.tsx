import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { IProjectRow } from "@/api";
import { readStoredProjectId, writeStoredProjectId } from "@/auth";
import { runCreateProject, runProjectsReload } from "@/utils";

export const ProjectsPage = () => {
  const [projects, setProjects] = useState<IProjectRow[]>([]);
  const [name, setName] = useState("Demo Project");
  const [workspaceRoot, setWorkspaceRoot] = useState("/tmp/demo-workspace");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => readStoredProjectId());

  const hint =
    currentProjectId === null ? "未选择当前项目：在表格里点「设为当前」。" : `当前项目：${currentProjectId}`;

  useEffect(() => {
    runProjectsReload(setProjects, setError, setLoading);
  }, []);

  const onCreate = (e: FormEvent): void => {
    e.preventDefault();
    runCreateProject({ name, workspaceRoot }, () => runProjectsReload(setProjects, setError, setLoading), setError);
  };

  const setCurrent = (projectId: string): void => {
    writeStoredProjectId(projectId);
    setCurrentProjectId(projectId);
  };

  return (
    <div className="page stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0 }}>项目</h2>
          <div className="muted">{hint}</div>
        </div>
        <button type="button" className="secondary" onClick={() => runProjectsReload(setProjects, setError, setLoading)} disabled={loading}>
          刷新
        </button>
      </div>

      {error ? <div className="errorBox">{error}</div> : null}

      <div className="panel stack">
        <h3 style={{ margin: 0 }}>新建项目</h3>
        <form className="stack" onSubmit={onCreate}>
          <label className="field">
            <div className="fieldLabel">名称</div>
            <input value={name} onChange={(evt) => setName(evt.target.value)} />
          </label>
          <label className="field">
            <div className="fieldLabel">workspaceRoot（登记路径）</div>
            <input value={workspaceRoot} onChange={(evt) => setWorkspaceRoot(evt.target.value)} />
          </label>
          <div className="row">
            <button type="submit">创建</button>
          </div>
        </form>
      </div>

      <div className="panel stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>列表</h3>
          <Link className="muted" to="/runners">
            Runner 注册向导 →
          </Link>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>workspaceRoot</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="mono">{p.workspaceRoot}</td>
                  <td>
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <button type="button" className="secondary" onClick={() => setCurrent(p.id)}>
                        设为当前
                      </button>
                      <Link to={`/projects/${p.id}/tasks`}>
                        <button type="button">任务</button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">
                    {loading ? "加载中…" : "暂无项目"}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
