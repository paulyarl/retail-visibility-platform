const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION public.skip_email_provider_spam() RETURNS trigger AS $f$
    BEGIN
      IF NEW.message LIKE '[AWS SES] Credentials not configured%'
         OR NEW.message LIKE '[SendGrid] API key not configured%'
         OR NEW.message LIKE '[Mailtrap] Email send failed:%' THEN
        RETURN NULL;
      END IF;
      RETURN NEW;
    END;
    $f$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe(`
    DROP TRIGGER IF EXISTS trg_skip_email_spam ON public.application_error_log`);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER trg_skip_email_spam BEFORE INSERT ON public.application_error_log
    FOR EACH ROW EXECUTE FUNCTION public.skip_email_provider_spam()`);
  console.log('trigger installed');
})().finally(() => prisma.$disconnect());
