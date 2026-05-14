import { useEffect, useState, type FormEvent } from "react";
import { Button, Callout, Flex, TextField } from "@radix-ui/themes";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth";
import { getMutationErrorMessage, useLoginMutation } from "@/hooks";
import { getPostAuthRedirectPath } from "@/utils/postAuthRedirect";
import {
  AUTH_ALT_LINK_BUTTON_CLASS,
  AUTH_CALLOUT_ERROR_CLASS,
  AUTH_FIELD_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_SUBMIT_BUTTON_CLASS,
  AuthScreen,
} from "./AuthScreen";

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken } = useAuth();
  const login = useLoginMutation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    login.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on credential edit only; `login` identity is unstable
  }, [email, password]);

  useEffect(() => {
    if (accessToken) {
      navigate(getPostAuthRedirectPath(location.state), { replace: true });
    }
  }, [accessToken, navigate, location.state]);

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    login.mutate({ email, password });
  };

  const error = login.isError ? getMutationErrorMessage(login.error, "Login failed") : null;

  return (
    <AuthScreen title="登录" subtitle="专注、利落，一秒进入工作台">
      {error ? (
        <Callout.Root color="red" role="alert" className={AUTH_CALLOUT_ERROR_CLASS}>
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      ) : null}

      <form onSubmit={onSubmit}>
        <Flex direction="column" gap="4">
          <div className={AUTH_FIELD_CLASS}>
            <label className={AUTH_LABEL_CLASS} htmlFor="login-email">
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
          <div className={AUTH_FIELD_CLASS}>
            <label className={AUTH_LABEL_CLASS} htmlFor="login-password">
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
            <Button type="submit" size="3" disabled={login.isPending} className={AUTH_SUBMIT_BUTTON_CLASS}>
              {login.isPending ? "登录中…" : "进入控制台"}
            </Button>
            <Button variant="ghost" color="gray" size="3" asChild className={AUTH_ALT_LINK_BUTTON_CLASS}>
              <Link to="/register">创建新账号</Link>
            </Button>
          </Flex>
        </Flex>
      </form>
    </AuthScreen>
  );
};
