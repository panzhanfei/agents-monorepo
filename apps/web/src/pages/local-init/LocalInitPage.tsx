import { LocalInitPageView } from "./LocalInitPageView";
import { useLocalInitPage } from "./useLocalInitPage";

export const LocalInitPage = () => {
  const vm = useLocalInitPage();
  return <LocalInitPageView vm={vm} />;
};
