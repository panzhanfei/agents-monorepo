export const getListenPort = (): number =>
  Number(process.env.CODING_AGENT_PORT ?? process.env.PORT ?? '4020');
