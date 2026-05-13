import type { IAuthUser } from "@agents/shared-types";
import type { RunnerDevice } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      traceId?: string;
      authUser?: IAuthUser;
      authRunner?: RunnerDevice;
    }
  }
}

export {};
