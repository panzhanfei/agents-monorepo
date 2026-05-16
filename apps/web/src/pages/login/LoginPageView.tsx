import { Button, Callout, Flex, TextField } from "@radix-ui/themes";
import { Link } from "react-router-dom";
import {
  AUTH_ALT_LINK_BUTTON_CLASS,
  AUTH_CALLOUT_ERROR_CLASS,
  AUTH_FIELD_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_SUBMIT_BUTTON_CLASS,
} from "@/pages/auth";
import type { ILoginPageViewModel } from "./useLoginPage";

export type ILoginPageViewProps = {
  vm: ILoginPageViewModel;
};

export const LoginPageView = ({ vm }: ILoginPageViewProps) => {
  const { email, setEmail, password, setPassword, onSubmit, error, loginPending } = vm;

  return (
    <>
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
            <Button type="submit" size="3" disabled={loginPending} className={AUTH_SUBMIT_BUTTON_CLASS}>
              {loginPending ? "登录中…" : "进入控制台"}
            </Button>
            <Button variant="ghost" color="gray" size="3" asChild className={AUTH_ALT_LINK_BUTTON_CLASS}>
              <Link to="/register">创建新账号</Link>
            </Button>
          </Flex>
        </Flex>
      </form>
    </>
  );
};
