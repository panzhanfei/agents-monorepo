import { RunnerRegisterPageView } from "./RunnerRegisterPageView";
import { useRunnerRegisterPage } from "./useRunnerRegisterPage";

export const RunnerRegisterPage = () => {
  const vm = useRunnerRegisterPage();
  return <RunnerRegisterPageView vm={vm} />;
};
