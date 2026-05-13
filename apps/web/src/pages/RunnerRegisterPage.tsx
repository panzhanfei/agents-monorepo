import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError, getApiBase, registerRunner, postRunnerHeartbeat } from "@/api";
import { copyLabelToClipboard } from "@/utils";

export const RunnerRegisterPage = () => {
  const [displayName, setDisplayName] = useState("Dev Runner");
  const [deviceKey, setDeviceKey] = useState("");
  const [deviceSecret, setDeviceSecret] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canHeartbeat = useMemo(() => Boolean(deviceKey && deviceSecret), [deviceKey, deviceSecret]);

  const onRegister = (e: FormEvent): void => {
    e.preventDefault();
    setError(null);
    setNote(null);
    void registerRunner({ displayName })
      .then((res) => {
        setDeviceKey(res.runner.deviceKey);
        setDeviceSecret(res.deviceSecret);
        setNote("设备密钥只在注册响应中出现一次：请立即复制保存。");
      })
      .catch((err: unknown) => {
        const msg = err instanceof ApiError ? err.message : "Register failed";
        setError(msg);
      });
  };

  const onHeartbeat = (): void => {
    setError(null);
    setNote(null);
    void postRunnerHeartbeat(deviceKey, deviceSecret, {
      contractVersion: "0-placeholder",
      mountedProjectIds: [],
    })
      .then(() => setNote("心跳成功：你可以回到「任务」页面尝试 enqueue。"))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Heartbeat failed"));
  };

  const onCopyDeviceKey = (): void => {
    void copyLabelToClipboard("deviceKey", deviceKey).then((result) => {
      if (result.ok) setNote(result.note);
      else setError(result.error);
    });
  };

  const onCopyDeviceSecret = (): void => {
    void copyLabelToClipboard("deviceSecret", deviceSecret).then((result) => {
      if (result.ok) setNote(result.note);
      else setError(result.error);
    });
  };

  return (
    <div className="page stack">
      <div>
        <h2 style={{ margin: 0 }}>Runner 注册（占位向导）</h2>
        <div className="muted">
          第二期会替换为真实 Runner 引导。此处用于第一期闭环：<span className="mono">register → heartbeat → enqueue → claim</span>
          。
        </div>
      </div>

      <div className="panel stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>注册设备</h3>
          <Link className="muted" to="/projects">
            返回项目
          </Link>
        </div>

        {error ? <div className="errorBox">{error}</div> : null}
        {note ? <div className="callout">{note}</div> : null}

        <form className="stack" onSubmit={onRegister}>
          <label className="field">
            <div className="fieldLabel">显示名（可选）</div>
            <input value={displayName} onChange={(evt) => setDisplayName(evt.target.value)} />
          </label>
          <button type="submit">注册 Runner</button>
        </form>
      </div>

      <div className="panel stack">
        <h3 style={{ margin: 0 }}>凭证（仅本地展示）</h3>
        <div className="muted">请勿把 `deviceSecret` 提交到 Git 或贴到公开渠道。</div>

        <label className="field">
          <div className="fieldLabel">deviceKey</div>
          <input readOnly value={deviceKey} className="mono" />
        </label>
        <label className="field">
          <div className="fieldLabel">deviceSecret</div>
          <input readOnly value={deviceSecret} className="mono" />
        </label>

        <div className="row">
          <button type="button" className="secondary" disabled={!deviceKey} onClick={onCopyDeviceKey}>
            复制 deviceKey
          </button>
          <button type="button" className="secondary" disabled={!deviceSecret} onClick={onCopyDeviceSecret}>
            复制 deviceSecret
          </button>
          <button type="button" disabled={!canHeartbeat} onClick={onHeartbeat}>
            我已保存 · 发送心跳
          </button>
        </div>

        <div className="callout muted">
          curl 验收示例：
          <div className="mono" style={{ marginTop: "0.5rem" }}>
            curl -sS -X POST &quot;{getApiBase()}/runners/heartbeat&quot; \
            <br />
            &nbsp;&nbsp;-H &quot;Content-Type: application/json&quot; \
            <br />
            &nbsp;&nbsp;-H &quot;X-Device-Key: …&quot; \
            <br />
            &nbsp;&nbsp;-H &quot;X-Device-Secret: …&quot; \
            <br />
            &nbsp;&nbsp;-d &apos;{`{"contractVersion":"0-placeholder","mountedProjectIds":[]}`}&apos;
          </div>
        </div>
      </div>
    </div>
  );
};
