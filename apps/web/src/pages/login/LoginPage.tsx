import { AuthScreen } from "@/pages/auth";
import { LoginPageView } from "./LoginPageView";
import { useLoginPage } from "./useLoginPage";

export const LoginPage = () => {
  const vm = useLoginPage();
  return (
    <AuthScreen title="登录" subtitle="专注、利落，一秒进入工作台">
      <LoginPageView vm={vm} />
    </AuthScreen>
  );
};
