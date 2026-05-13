import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, postLogin } from "@/api";
import { useAuth } from "@/auth";

export const LoginPage = () => {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [email, setEmail] = useState("demo@local.dev");
  const [password, setPassword] = useState("demo-demo");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError(null);
  }, [email, password]);

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    void postLogin({ email, password })
      .then((res) => {
        setSession(res.accessToken, res.user);
        navigate("/projects", { replace: true });
      })
      .catch((err: unknown) => {
        const msg = err instanceof ApiError ? err.message : "Login failed";
        setError(msg);
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="page">
      <div className="panel stack" style={{ maxWidth: 520 }}>
        <div>
          <h2 style={{ margin: "0 0 0.25rem" }}>登录</h2>
          <div className="muted">使用本地种子账号或自行注册。</div>
        </div>

        {error ? <div className="errorBox">{error}</div> : null}

        <form className="stack" onSubmit={onSubmit}>
          <label className="field">
            <div className="fieldLabel">邮箱</div>
            <input value={email} onChange={(evt) => setEmail(evt.target.value)} autoComplete="email" />
          </label>
          <label className="field">
            <div className="fieldLabel">密码</div>
            <input
              type="password"
              value={password}
              onChange={(evt) => setPassword(evt.target.value)}
              autoComplete="current-password"
            />
          </label>
          <div className="row">
            <button type="submit" disabled={loading}>
              {loading ? "提交中…" : "登录"}
            </button>
            <Link className="muted" to="/register">
              没有账号？注册
            </Link>
          </div>
        </form>

        <div className="callout muted">
          默认种子：`demo@local.dev` / `demo-demo`（运行 `pnpm db:seed` 后可用）。
        </div>
      </div>
    </div>
  );
};
