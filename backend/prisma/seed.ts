import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Initial platform admin (owner). Set SEED_ADMIN_* in the environment;
  // change the password immediately after first login in production.
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@gmail.com';
  const adminPhone = process.env.SEED_ADMIN_PHONE ?? '+2348000000001';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin1234';

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN' },
    create: {
      email: adminEmail,
      phone: adminPhone,
      name: 'BookAm Admin',
      role: 'ADMIN',
      emailVerifiedAt: new Date(),
      passwordHash: await bcrypt.hash(adminPassword, 10),
    },
  });
  console.log(`Admin ready: ${admin.email}`);

  // Subscription plan catalog — real product data the app offers.
  await prisma.subscriptionPlan.upsert({
    where: { name: 'Starter' },
    update: {},
    create: {
      name: 'Starter',
      priceNaira: 0,
      interval: 'MONTHLY',
      maxCircles: 1,
      features: ['1 circle', 'Up to 15 members', 'WhatsApp reminders'],
    },
  });
  await prisma.subscriptionPlan.upsert({
    where: { name: 'Alajo Pro' },
    update: {},
    create: {
      name: 'Alajo Pro',
      priceNaira: 2500,
      interval: 'MONTHLY',
      maxCircles: 5,
      features: ['5 circles', 'Unlimited members', 'Reminders + reports'],
    },
  });
  await prisma.subscriptionPlan.upsert({
    where: { name: 'Association' },
    update: {},
    create: {
      name: 'Association',
      priceNaira: 25000,
      interval: 'YEARLY',
      maxCircles: null,
      features: [
        'Unlimited circles',
        'Multiple coordinators',
        'Priority support',
      ],
    },
  });

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
