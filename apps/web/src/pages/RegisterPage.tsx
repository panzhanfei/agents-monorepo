import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, postRegister } from "@/api";
import { useAuth } from "@/auth";

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError(null);
  }, [email, password]);

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    void postRegister({ email, password })
      .then((res) => {
        setSession(res.accessToken, res.user);
        navigate("/projects", { replace: true });
      })
      .catch((err: unknown) => {
        const msg = err instanceof ApiError ? err.message : "Register failed";
        setError(msg);
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="page">
      <div className="panel stack" style={{ maxWidth: 520 }}>
        <div>
          <h2 style={{ margin: "0 0 0.25rem" }}>注册</h2>
          <div className="muted">密码至少 8 位。</div>
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
              autoComplete="new-password"
            />
          </label>
          <div className="row">
            <button type="submit" disabled={loading}>
              {loading ? "提交中…" : "创建账号"}
            </button>
            <Link className="muted" to="/login">
              已有账号？登录
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};
