import { useEffect, useState, type FormEvent } from "react";
import { Button, Callout, Flex, TextField } from "@radix-ui/themes";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth";
import { getMutationErrorMessage, useRegisterMutation } from "@/hooks";
import { getPostAuthRedirectPath } from "@/utils/postAuthRedirect";
import {
  AUTH_ALT_LINK_BUTTON_CLASS,
  AUTH_CALLOUT_ERROR_CLASS,
  AUTH_FIELD_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_SUBMIT_BUTTON_CLASS,
  AuthScreen,
} from "./AuthScreen";

export const RegisterPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken } = useAuth();
  const register = useRegisterMutation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    register.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on credential edit only; `register` identity is unstable
  }, [email, password]);

  useEffect(() => {
    if (accessToken) {
      navigate(getPostAuthRedirectPath(location.state), { replace: true });
    }
  }, [accessToken, navigate, location.state]);

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    register.mutate({ email, password });
  };

  const error = register.isError ? getMutationErrorMessage(register.error, "Register failed") : null;

  return (
    <AuthScreen title="注册" subtitle="密码至少 8 位，即刻开始协作">
      {error ? (
        <Callout.Root color="red" role="alert" className={AUTH_CALLOUT_ERROR_CLASS}>
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      ) : null}

      <form onSubmit={onSubmit}>
        <Flex direction="column" gap="4">
          <div className={AUTH_FIELD_CLASS}>
            <label className={AUTH_LABEL_CLASS} htmlFor="register-email">
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
          <div className={AUTH_FIELD_CLASS}>
            <label className={AUTH_LABEL_CLASS} htmlFor="register-password">
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
            <Button type="submit" size="3" disabled={register.isPending} className={AUTH_SUBMIT_BUTTON_CLASS}>
              {register.isPending ? "创建中…" : "创建并登录"}
            </Button>
            <Button variant="ghost" color="gray" size="3" asChild className={AUTH_ALT_LINK_BUTTON_CLASS}>
              <Link to="/login">已有账号？去登录</Link>
            </Button>
          </Flex>
        </Flex>
      </form>
    </AuthScreen>
  );
};
