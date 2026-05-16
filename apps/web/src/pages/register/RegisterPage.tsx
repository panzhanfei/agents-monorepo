import { AuthScreen } from "@/pages/auth";
import { RegisterPageView } from "./RegisterPageView";
import { useRegisterPage } from "./useRegisterPage";

export const RegisterPage = () => {
  const vm = useRegisterPage();
  return (
    <AuthScreen title="注册" subtitle="密码至少 8 位，即刻开始协作">
      <RegisterPageView vm={vm} />
    </AuthScreen>
  );
};
