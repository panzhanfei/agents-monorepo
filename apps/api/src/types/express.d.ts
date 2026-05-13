import type { RunnerDevice, User } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      traceId?: string;
      authUser?: Pick<User, "id" | "email">;
      authRunner?: RunnerDevice;
    }
  }
}

export {};
