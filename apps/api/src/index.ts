import { getEnv } from "./config/env.js";
import { startServer } from "./server.js";

getEnv();
startServer();
