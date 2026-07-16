import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const daysFromNow = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000);

async function main() {
  const adminPhone = process.env.SEED_ADMIN_PHONE ?? '+2348000000001';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin1234';

  const admin = await prisma.user.upsert({
    where: { phone: adminPhone },
    update: { role: 'ADMIN' },
    create: {
      phone: adminPhone,
      name: 'BookAm Admin',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash(adminPassword, 10),
    },
  });
  console.log(`Admin ready: ${admin.phone} (password: ${adminPassword})`);

  const starter = await prisma.subscriptionPlan.upsert({
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
  const alajoPro = await prisma.subscriptionPlan.upsert({
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
      features: ['Unlimited circles', 'Multiple coordinators', 'Priority support'],
    },
  });

  const demoUsers = [
    { phone: '+2348011111111', name: 'Iya Basira', role: 'COORDINATOR' },
    { phone: '+2348022222222', name: 'Chinedu Okafor', role: 'COORDINATOR' },
    { phone: '+2348033333333', name: 'Amina Yusuf', role: 'MEMBER' },
    { phone: '+2348044444444', name: 'Tunde Adebayo', role: 'MEMBER' },
    { phone: '+2348055555555', name: 'Ngozi Eze', role: 'MEMBER' },
    { phone: '+2348066666666', name: 'Musa Ibrahim', role: 'MEMBER' },
  ] as const;

  const users: Record<string, { id: string }> = {};
  for (const u of demoUsers) {
    users[u.phone] = await prisma.user.upsert({
      where: { phone: u.phone },
      update: {},
      create: { phone: u.phone, name: u.name, role: u.role },
    });
  }

  if ((await prisma.collectorApplication.count()) === 0) {
    await prisma.collectorApplication.createMany({
      data: [
        {
          applicantId: users['+2348033333333'].id,
          note: 'I run a weekly ajo for 12 traders in Balogun market and want to move my card online.',
        },
        {
          applicantId: users['+2348044444444'].id,
          note: 'Treasurer of our street cooperative, 20 members, monthly adashe.',
        },
        {
          applicantId: users['+2348055555555'].id,
          status: 'APPROVED',
          reviewNote: 'Verified by phone call.',
          reviewedById: admin.id,
          reviewedAt: daysFromNow(-3),
        },
        {
          applicantId: users['+2348066666666'].id,
          status: 'REJECTED',
          reviewNote: 'Could not reach applicant on the provided number.',
          reviewedById: admin.id,
          reviewedAt: daysFromNow(-7),
        },
      ],
    });
    // Keep the approved applicant's role consistent with their application.
    await prisma.user.update({
      where: { phone: '+2348055555555' },
      data: { role: 'COORDINATOR' },
    });
  }

  if ((await prisma.subscription.count()) === 0) {
    await prisma.subscription.createMany({
      data: [
        {
          userId: users['+2348011111111'].id,
          planId: alajoPro.id,
          status: 'ACTIVE',
          periodStart: daysFromNow(-10),
          periodEnd: daysFromNow(20),
        },
        {
          userId: users['+2348022222222'].id,
          planId: starter.id,
          status: 'ACTIVE',
          periodStart: daysFromNow(-5),
          periodEnd: daysFromNow(25),
        },
        {
          userId: users['+2348055555555'].id,
          planId: alajoPro.id,
          status: 'EXPIRED',
          periodStart: daysFromNow(-70),
          periodEnd: daysFromNow(-40),
        },
      ],
    });
  }

  if ((await prisma.circle.count()) === 0) {
    await prisma.circle.createMany({
      data: [
        {
          name: 'Balogun Traders Weekly',
          contributionAmountNaira: 5000,
          frequency: 'WEEKLY',
          coordinatorId: users['+2348011111111'].id,
        },
        {
          name: 'Okafor Family Monthly',
          contributionAmountNaira: 20000,
          frequency: 'MONTHLY',
          coordinatorId: users['+2348022222222'].id,
        },
      ],
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
