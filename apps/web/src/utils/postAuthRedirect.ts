/** 登录/注册成功后跳转路径；支持 `Navigate state={{ from }}` 含 query（如本机环境初始化）。 */
export const getPostAuthRedirectPath = (state: unknown): string => {
  if (state && typeof state === "object" && "from" in state) {
    const from = (state as { from?: unknown }).from;
    if (typeof from === "string" && from.startsWith("/") && !from.startsWith("//")) {
      return from;
    }
  }
  return "/projects";
};
