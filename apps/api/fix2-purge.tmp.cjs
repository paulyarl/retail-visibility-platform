const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  for (const pat of ["[AWS SES] Credentials not configured%", "[SendGrid] API key not configured%", "[Mailtrap] Email send failed:%"]) {
    const n = await prisma.$executeRawUnsafe(
      `DELETE FROM public.application_error_log WHERE message LIKE '${pat}'`);
    console.log(`deleted ${n} :: ${pat}`);
  }
  const left = await prisma.$queryRawUnsafe(`select count(*) as n from public.application_error_log`);
  console.log('remaining rows:', left);
})().finally(() => prisma.$disconnect());
