/** Shared Tailwind shells for Radix inputs/buttons on login/register（见 login / register） */

export const AUTH_FIELD_CLASS =
  "[&_.rt-TextFieldInput]:transition-[border-color,box-shadow,transform] [&_.rt-TextFieldInput]:duration-200 [&_.rt-TextFieldInput]:ease-out [&_.rt-TextFieldInput]:focus:-translate-y-px [&_.rt-TextFieldInput]:focus:shadow-[0_0_0_1px_rgb(96_165_250_/_0.45),0_12px_28px_-12px_rgb(59_130_246_/_0.35)] motion-reduce:[&_.rt-TextFieldInput]:focus:translate-y-0";

export const AUTH_LABEL_CLASS =
  "mb-1.5 block text-[0.8125rem] font-semibold tracking-wide text-slate-200/90";

export const AUTH_SUBMIT_BUTTON_CLASS =
  "mt-1 w-full border-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 bg-[length:140%_auto] font-semibold tracking-wide text-white shadow-[0_14px_32px_-10px_rgb(59_130_246_/_0.65),inset_0_0_0_1px_rgb(255_255_255_/_0.08)] transition-[transform,box-shadow,filter,background-position] duration-200 hover:not-disabled:-translate-y-0.5 hover:not-disabled:bg-[position:90%_center] hover:not-disabled:brightness-[1.06] hover:not-disabled:shadow-[0_18px_40px_-12px_rgb(99_102_241_/_0.55),inset_0_0_0_1px_rgb(255_255_255_/_0.12)] active:not-disabled:translate-y-0 disabled:opacity-[0.72] disabled:saturate-[0.85] motion-reduce:hover:not-disabled:translate-y-0 motion-reduce:hover:not-disabled:bg-[position:inherit]";

export const AUTH_ALT_LINK_BUTTON_CLASS =
  "mt-1 w-full text-slate-400 transition-colors hover:text-slate-200";

export const AUTH_CALLOUT_ERROR_CLASS = "mb-4";
