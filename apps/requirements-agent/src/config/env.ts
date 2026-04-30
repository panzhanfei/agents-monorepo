export const getListenPort = (): number =>
  Number(process.env.REQUIREMENTS_AGENT_PORT ?? process.env.PORT ?? '4060');
