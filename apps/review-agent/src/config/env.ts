export const getListenPort = (): number =>
  Number(process.env.REVIEW_AGENT_PORT ?? process.env.PORT ?? '4030');
