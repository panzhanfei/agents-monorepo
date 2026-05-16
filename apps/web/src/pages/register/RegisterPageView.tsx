import { Button, Callout, Flex, TextField } from "@radix-ui/themes";
import { Link } from "react-router-dom";
import {
  AUTH_ALT_LINK_BUTTON_CLASS,
  AUTH_CALLOUT_ERROR_CLASS,
  AUTH_FIELD_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_SUBMIT_BUTTON_CLASS,
} from "@/pages/auth";
import type { IRegisterPageViewModel } from "./useRegisterPage";

export type IRegisterPageViewProps = {
  vm: IRegisterPageViewModel;
};

export const RegisterPageView = ({ vm }: IRegisterPageViewProps) => {
  const { email, setEmail, password, setPassword, onSubmit, error, registerPending } = vm;

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
            <Button type="submit" size="3" disabled={registerPending} className={AUTH_SUBMIT_BUTTON_CLASS}>
              {registerPending ? "创建中…" : "创建并登录"}
            </Button>
            <Button variant="ghost" color="gray" size="3" asChild className={AUTH_ALT_LINK_BUTTON_CLASS}>
              <Link to="/login">已有账号？去登录</Link>
            </Button>
          </Flex>
        </Flex>
      </form>
    </>
  );
};
