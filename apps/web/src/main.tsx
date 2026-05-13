import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Theme } from "@radix-ui/themes";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/auth";
import { App } from "@/App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Theme appearance="dark" accentColor="blue" grayColor="slate" radius="medium" scaling="100%">
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </Theme>
  </StrictMode>,
);
