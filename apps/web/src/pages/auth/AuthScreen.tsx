import { Heading, Text } from "@radix-ui/themes";
import type { IAuthScreenProps } from "./interface";

export const AuthScreen = ({ title, subtitle, children }: IAuthScreenProps) => (
  <div className="relative isolate flex min-h-[min(640px,calc(100dvh-5rem))] items-center justify-center overflow-x-hidden overflow-y-auto px-4 py-8">
    <div
      aria-hidden
      className="pointer-events-none absolute inset-[-40%] -z-20 bg-[radial-gradient(ellipse_85%_65%_at_15%_12%,rgb(59_130_246_/_0.35),transparent_52%),radial-gradient(ellipse_75%_55%_at_88%_78%,rgb(139_92_246_/_0.28),transparent_50%),radial-gradient(ellipse_60%_45%_at_52%_48%,rgb(6_182_212_/_0.14),transparent_55%),radial-gradient(circle_at_50%_120%,rgb(15_23_42_/_0.95),rgb(2_6_23))]"
    />
    <div
      aria-hidden
      className="pointer-events-none absolute -left-[12%] -top-[8%] -z-10 size-[min(420px,55vw)] rounded-full bg-[radial-gradient(circle,rgb(96_165_250_/_0.55),transparent_68%)] opacity-[0.55] blur-[56px]"
    />
    <div
      aria-hidden
      className="pointer-events-none absolute -bottom-[14%] -right-[10%] -z-10 size-[min(380px,50vw)] rounded-full bg-[radial-gradient(circle,rgb(167_139_250_/_0.45),transparent_68%)] opacity-[0.55] blur-[56px]"
    />
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(rgb(148_163_184_/_0.06)_1px,transparent_1px),linear-gradient(90deg,rgb(148_163_184_/_0.06)_1px,transparent_1px)] bg-[length:48px_48px] [mask-image:radial-gradient(ellipse_75%_65%_at_50%_45%,black_18%,transparent_72%)] [-webkit-mask-image:radial-gradient(ellipse_75%_65%_at_50%_45%,black_18%,transparent_72%)]"
    />
    <div className="relative z-0 w-full max-w-[420px] rounded-[1.35rem] border border-white/15 bg-transparent px-[2.15rem] pb-[2.15rem] pt-[2.35rem] shadow-[0_0_64px_-24px_rgb(59_130_246_/_0.3)] backdrop-blur-sm">
      <header className="mb-[1.65rem]">
        <Heading
          as="h1"
          size="7"
          weight="bold"
          mb="0"
          className="bg-[linear-gradient(120deg,rgb(248_250_252)_0%,rgb(203_213_225)_42%,rgb(125_211_252)_100%)] bg-[length:140%_auto] bg-clip-text tracking-tight text-transparent [-webkit-background-clip:text]"
        >
          {title}
        </Heading>
        {subtitle ? (
          <Text size="2" highContrast={false} className="mt-[0.45rem] text-slate-400">
            {subtitle}
          </Text>
        ) : null}
      </header>
      <div>{children}</div>
    </div>
  </div>
);
