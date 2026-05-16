import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth";
import { getMutationErrorMessage, useLoginMutation } from "@/hooks";
import { getPostAuthRedirectPath } from "@/utils/postAuthRedirect";

export const useLoginPage = () => {
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

  return {
    email,
    setEmail,
    password,
    setPassword,
    onSubmit,
    error,
    loginPending: login.isPending,
  };
};

export type ILoginPageViewModel = ReturnType<typeof useLoginPage>;
