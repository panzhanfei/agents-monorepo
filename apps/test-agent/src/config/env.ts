export const getListenPort = (): number =>
  Number(process.env.TEST_AGENT_PORT ?? process.env.PORT ?? '4040');
