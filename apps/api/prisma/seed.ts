import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const main = async (): Promise<void> => {
  const email = "dev@local.test";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.info("Seed skipped: user already exists.", { userId: existing.id });
    return;
  }

  const user = await prisma.user.create({
    data: {
      email,
      projects: {
        create: {
          name: "Dev Project",
          workspaceRoot: "/tmp/agents-workspace",
        },
      },
      runners: {
        create: {
          deviceKey: "dev-runner-1",
        },
      },
    },
    include: { projects: true, runners: true },
  });

  const project = user.projects[0];
  const runner = user.runners[0];

  console.info("Seed OK — 占位账号（本地开发）");
  console.info({
    userId: user.id,
    email: user.email,
    projectId: project?.id,
    runnerDbId: runner?.id,
    runnerDeviceKey: runner?.deviceKey,
  });
};

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
