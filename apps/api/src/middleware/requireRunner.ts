import type { NextFunction, Request, Response } from "express";
import { HttpError, prisma, verifyDeviceSecret } from "@/lib";

export const requireRunner = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const deviceKey = req.headers["x-device-key"];
    const deviceSecret = req.headers["x-device-secret"];
    if (typeof deviceKey !== "string" || !deviceKey.trim()) {
      throw new HttpError(401, "unauthorized", "Missing X-Device-Key");
    }
    if (typeof deviceSecret !== "string" || !deviceSecret) {
      throw new HttpError(401, "unauthorized", "Missing X-Device-Secret");
    }

    const runner = await prisma.runnerDevice.findUnique({
      where: { deviceKey: deviceKey.trim() },
    });
    if (!runner) throw new HttpError(401, "invalid_runner", "Unknown device");

    const ok = await verifyDeviceSecret(deviceSecret, runner.secretHash);
    if (!ok) throw new HttpError(401, "invalid_runner", "Invalid device credentials");

    req.authRunner = runner;
    next();
  } catch (e) {
    next(e);
  }
};
