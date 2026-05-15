import { prisma } from "@/lib";

export const countUsers = async (): Promise<number> => prisma.user.count();
