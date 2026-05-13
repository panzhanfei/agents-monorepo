import { useEffect, useState, type FormEvent } from "react";
import { Button, Callout, Flex, TextField } from "@radix-ui/themes";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, postRegister } from "@/api";
import { useAuth } from "@/auth";
import { AuthScreen } from "./AuthScreen";

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
    <AuthScreen title="注册" subtitle="密码至少 8 位，即刻开始协作">
      {error ? (
        <Callout.Root color="red" role="alert" className="auth-screen__error">
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      ) : null}

      <form onSubmit={onSubmit}>
        <Flex direction="column" gap="4">
          <div className="auth-field">
            <label className="auth-field-label" htmlFor="register-email">
              邮箱
            </label>
            <TextField.Root
              id="register-email"
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
            <label className="auth-field-label" htmlFor="register-password">
              密码
            </label>
            <TextField.Root
              id="register-password"
              size="3"
              variant="surface"
              type="password"
              value={password}
              onChange={(evt) => setPassword(evt.target.value)}
              autoComplete="new-password"
              placeholder="至少 8 位"
            />
          </div>
          <Flex direction="column" gap="2" mt="2">
            <Button type="submit" size="3" disabled={loading} className="auth-submit">
              {loading ? "创建中…" : "创建并登录"}
            </Button>
            <Button variant="ghost" color="gray" size="3" asChild className="auth-alt-link">
              <Link to="/login">已有账号？去登录</Link>
            </Button>
          </Flex>
        </Flex>
      </form>
    </AuthScreen>
  );
};
