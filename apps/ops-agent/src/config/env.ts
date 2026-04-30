export const getListenPort = (): number =>
  Number(process.env.OPS_AGENT_PORT ?? process.env.PORT ?? '4050');
