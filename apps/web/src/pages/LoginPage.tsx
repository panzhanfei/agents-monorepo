import { useEffect, useState, type FormEvent } from "react";
import { Button, Callout, Flex, TextField } from "@radix-ui/themes";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, postLogin } from "@/api";
import { useAuth } from "@/auth";
import { AuthScreen } from "./AuthScreen";

export const LoginPage = () => {
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
    <AuthScreen title="登录" subtitle="专注、利落，一秒进入工作台">
      {error ? (
        <Callout.Root color="red" role="alert" className="auth-screen__error">
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      ) : null}

      <form onSubmit={onSubmit}>
        <Flex direction="column" gap="4">
          <div className="auth-field">
            <label className="auth-field-label" htmlFor="login-email">
              邮箱
            </label>
            <TextField.Root
              id="login-email"
              size="3"
              variant="surface"
              type="email"
              value={email}
              onChange={(evt) => setEmail(evt.target.value)}
              autoComplete="email"
              placeholder="you@company.com"
            />
          </div>
          <div className="auth-field">
            <label className="auth-field-label" htmlFor="login-password">
              密码
            </label>
            <TextField.Root
              id="login-password"
              size="3"
              variant="surface"
              type="password"
              value={password}
              onChange={(evt) => setPassword(evt.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>
          <Flex direction="column" gap="2" mt="2">
            <Button type="submit" size="3" disabled={loading} className="auth-submit">
              {loading ? "登录中…" : "进入控制台"}
            </Button>
            <Button variant="ghost" color="gray" size="3" asChild className="auth-alt-link">
              <Link to="/register">创建新账号</Link>
            </Button>
          </Flex>
        </Flex>
      </form>
    </AuthScreen>
  );
};
