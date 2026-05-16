import { SettingsPageView } from "./SettingsPageView";
import { useSettingsPage } from "./useSettingsPage";

export const SettingsPage = () => {
  const vm = useSettingsPage();
  return <SettingsPageView vm={vm} />;
};
