import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const demoEmail = "demo@local.dev";
const demoPassword = "demo-demo";

const main = async (): Promise<void> => {
  const passwordHash = await bcrypt.hash(demoPassword, 12);
  await prisma.user.upsert({
    where: { email: demoEmail },
    update: {},
    create: {
      email: demoEmail,
      passwordHash,
    },
  });
};

main()
  .then(() => prisma.$disconnect())
  .catch(async (e: unknown) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
