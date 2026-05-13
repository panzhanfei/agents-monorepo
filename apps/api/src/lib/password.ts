import bcrypt from "bcryptjs";

const ROUNDS = 12;

export const hashPassword = async (plain: string): Promise<string> =>
  bcrypt.hash(plain, ROUNDS);

export const verifyPassword = async (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);
