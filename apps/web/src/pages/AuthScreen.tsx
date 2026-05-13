import type { ReactNode } from "react";
import { Heading, Text } from "@radix-ui/themes";

export interface IAuthScreenProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export const AuthScreen = ({ title, subtitle, children }: IAuthScreenProps) => (
  <div className="auth-screen">
    <div className="auth-screen__mesh" aria-hidden />
    <div className="auth-screen__orb auth-screen__orb--a" aria-hidden />
    <div className="auth-screen__orb auth-screen__orb--b" aria-hidden />
    <div className="auth-screen__grid" aria-hidden />
    <div className="auth-screen__panel">
      <header className="auth-screen__header">
        <Heading as="h1" size="7" weight="bold" mb="0" className="auth-screen__title">
          {title}
        </Heading>
        {subtitle ? (
          <Text size="2" highContrast={false} className="auth-screen__subtitle">
            {subtitle}
          </Text>
        ) : null}
      </header>
      <div className="auth-screen__body">{children}</div>
    </div>
  </div>
);
