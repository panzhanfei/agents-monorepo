import { ApiError } from "@/api";
import { useAuth } from "@/auth";
import { useMeQuery } from "@/hooks";

export const useSettingsPage = () => {
  const { user, clearSession } = useAuth();
  const meQ = useMeQuery();
  const displayUser = meQ.data?.user ?? user;

  const profileError = meQ.isError
    ? meQ.error instanceof ApiError
      ? meQ.error.message
      : "Failed to load profile"
    : null;

  return { displayUser, profileError, meQ, clearSession };
};

export type ISettingsPageViewModel = ReturnType<typeof useSettingsPage>;
