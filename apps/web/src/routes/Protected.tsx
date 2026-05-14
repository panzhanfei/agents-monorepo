import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth";

export const Protected = () => {
  const { accessToken } = useAuth();
  const location = useLocation();

  if (!accessToken) {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  }

  return <Outlet />;
};
