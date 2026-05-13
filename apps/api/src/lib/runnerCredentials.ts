import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

const SECRET_BYTES = 32;

export const generateDeviceKey = (): string => `dev_${uuidv4().replace(/-/g, "")}`;

export const generateDeviceSecretPlain = (): string => randomBytes(SECRET_BYTES).toString("base64url");

export const hashDeviceSecret = async (plain: string): Promise<string> =>
  bcrypt.hash(plain, 12);

export const verifyDeviceSecret = async (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);
