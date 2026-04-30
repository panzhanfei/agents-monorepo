export const getListenPort = (): number =>
  Number(process.env.ORCHESTRATOR_PORT ?? process.env.PORT ?? '4010');
