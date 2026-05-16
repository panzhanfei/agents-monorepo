import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth";
import { getMutationErrorMessage, useRegisterMutation } from "@/hooks";
import { getPostAuthRedirectPath } from "@/utils/postAuthRedirect";

export const useRegisterPage = () => {
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

  return {
    email,
    setEmail,
    password,
    setPassword,
    onSubmit,
    error,
    registerPending: register.isPending,
  };
};

export type IRegisterPageViewModel = ReturnType<typeof useRegisterPage>;
