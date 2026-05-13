import { useEffect, useState } from "react";
import { ApiError, getApiBase, fetchMe } from "@/api";
import type { IAuthUser } from "@/auth";
import { useAuth } from "@/auth";

export const SettingsPage = () => {
  const { user, clearSession } = useAuth();
  const [me, setMe] = useState<IAuthUser | null>(user);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMe(user);
  }, [user]);

  const onRefreshProfile = (): void => {
    setError(null);
    void fetchMe()
      .then((res) => setMe(res.user))
      .catch((err: unknown) => {
        const msg = err instanceof ApiError ? err.message : "Failed to load profile";
        setError(msg);
      });
  };

  return (
    <div className="page stack">
      <div>
        <h2 style={{ margin: 0 }}>设置 / 关于</h2>
        <div className="muted">第一期占位页：展示环境与当前用户信息。</div>
      </div>

      {error ? <div className="errorBox">{error}</div> : null}

      <div className="panel stack">
        <h3 style={{ margin: 0 }}>前端环境</h3>
        <div className="field">
          <div className="fieldLabel">VITE_API_BASE</div>
          <input readOnly value={getApiBase()} className="mono" />
        </div>
        <button type="button" className="secondary" onClick={onRefreshProfile}>
          刷新用户信息
        </button>
      </div>

      <div className="panel stack">
        <h3 style={{ margin: 0 }}>账号</h3>
        <div className="muted">邮箱</div>
        <div className="mono">{me?.email ?? "—"}</div>
        <div className="muted">内部 userId</div>
        <div className="mono">{me?.id ?? "—"}</div>

        <div className="row">
          <button type="button" className="danger" onClick={() => clearSession()}>
            退出登录
          </button>
        </div>
      </div>
    </div>
  );
};
