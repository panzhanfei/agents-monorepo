export const getListenPort = (): number =>
  Number(process.env.CODING_AGENT_PORT ?? process.env.PORT ?? '4020');

/** 若设置则 POST /v1/coding/run 需 Authorization: Bearer <token> */
export const getCodingAgentInternalToken = (): string | undefined => {
  const t = process.env.CODING_AGENT_INTERNAL_TOKEN?.trim();
  return t === '' ? undefined : t;
};
