import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import type { IRunnerRow, ITaskRow } from "@/api";
import { runEnqueueTask, runReloadProjectTasksLists, subscribeTaskDetailPolling } from "@/utils";

export const ProjectTasksPage = () => {
  const params = useParams();
  const projectId = params.projectId ?? "";

  const [runners, setRunners] = useState<IRunnerRow[]>([]);
  const [tasks, setTasks] = useState<ITaskRow[]>([]);
  const [runnerDeviceId, setRunnerDeviceId] = useState("");
  const [payloadText, setPayloadText] = useState("{}");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ITaskRow | null>(null);
  const [pollMs, setPollMs] = useState(2500);
  const [error, setError] = useState<string | null>(null);

  const selectedRunnerOnline = useMemo(() => {
    const r = runners.find((x) => x.id === runnerDeviceId);
    if (!r?.lastSeenAt) return false;
    const last = new Date(r.lastSeenAt).getTime();
    return Date.now() - last <= 120_000;
  }, [runnerDeviceId, runners]);

  useEffect(() => {
    runReloadProjectTasksLists({
      projectId,
      runnerDeviceId: "",
      setRunners,
      setTasks,
      setRunnerDeviceId,
      setError,
    });
  }, [projectId]);

  useEffect(() => {
    if (!selectedTaskId) {
      setDetail(null);
      return () => undefined;
    }
    return subscribeTaskDetailPolling(selectedTaskId, pollMs, (task) => setDetail(task));
  }, [pollMs, selectedTaskId]);

  const onEnqueue = (e: FormEvent): void => {
    e.preventDefault();
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(payloadText) as Record<string, unknown>;
    } catch {
      setError("payload 必须是合法 JSON");
      return;
    }

    void runEnqueueTask(projectId, runnerDeviceId, payload, () => {
      runReloadProjectTasksLists({
        projectId,
        runnerDeviceId,
        setRunners,
        setTasks,
        setRunnerDeviceId,
        setError,
      });
    }, setError);
  };

  return (
    <div className="page stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0 }}>任务</h2>
          <div className="muted">
            项目：<span className="mono">{projectId}</span> ·{" "}
            <Link className="muted" to="/projects">
              返回项目
            </Link>
          </div>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() =>
            runReloadProjectTasksLists({
              projectId,
              runnerDeviceId,
              setRunners,
              setTasks,
              setRunnerDeviceId,
              setError,
            })
          }
        >
          刷新列表
        </button>
      </div>

      {error ? <div className="errorBox">{error}</div> : null}

      <div className="panel stack">
        <h3 style={{ margin: 0 }}>入队</h3>
        <div className="muted">
          enqueue 会校验 Runner <strong>心跳在线</strong>。本地验收：先到 Runner 页面点心跳，再回到此处。
        </div>

        <form className="stack" onSubmit={onEnqueue}>
          <label className="field">
            <div className="fieldLabel">Runner</div>
            <select value={runnerDeviceId} onChange={(evt) => setRunnerDeviceId(evt.target.value)}>
              {runners.map((r) => (
                <option key={r.id} value={r.id}>
                  {(r.displayName ?? r.deviceKey).slice(0, 48)}
                </option>
              ))}
            </select>
          </label>

          <div className="row">
            <div className={`callout ${selectedRunnerOnline ? "" : "muted"}`} style={{ flex: 1 }}>
              Runner 心跳提示：{selectedRunnerOnline ? "近期有心跳（粗略判断）" : "可能离线（请先心跳）"}
            </div>
          </div>

          <label className="field">
            <div className="fieldLabel">payload（JSON）</div>
            <textarea rows={8} value={payloadText} onChange={(evt) => setPayloadText(evt.target.value)} />
          </label>

          <div className="row">
            <button type="submit">enqueue</button>
          </div>
        </form>
      </div>

      <div className="panel stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>列表（轮询占位）</h3>
          <label className="row" style={{ gap: "0.5rem" }}>
            <span className="muted">间隔 ms</span>
            <input
              style={{ width: 120 }}
              type="number"
              min={500}
              step={100}
              value={pollMs}
              onChange={(evt) => setPollMs(Number(evt.target.value))}
            />
          </label>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>状态</th>
                <th>任务 ID</th>
                <th>Runner</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td>{t.status}</td>
                  <td className="mono">{t.id}</td>
                  <td className="mono">{t.runnerDeviceId}</td>
                  <td>
                    <button type="button" className="secondary" onClick={() => setSelectedTaskId(t.id)}>
                      详情
                    </button>
                  </td>
                </tr>
              ))}
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    暂无任务
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTaskId ? (
        <div className="panel stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>详情</h3>
            <button type="button" className="secondary" onClick={() => setSelectedTaskId(null)}>
              关闭
            </button>
          </div>
          {detail ? (
            <pre className="mono" style={{ margin: 0, whiteSpace: "pre-wrap" }}>
              {JSON.stringify(detail, null, 2)}
            </pre>
          ) : (
            <div className="muted">加载中…</div>
          )}
        </div>
      ) : null}
    </div>
  );
};
