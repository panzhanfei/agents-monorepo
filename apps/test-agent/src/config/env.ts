export const getListenPort = (): number =>
  Number(process.env.TEST_AGENT_PORT ?? process.env.PORT ?? '4041');

/** 若设置则 POST /v1/test/run 需 Bearer */
export const getTestAgentInternalToken = (): string | undefined => {
  const t = process.env.TEST_AGENT_INTERNAL_TOKEN?.trim();
  return t === '' ? undefined : t;
};
