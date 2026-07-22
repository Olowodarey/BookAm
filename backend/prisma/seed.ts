import { PrismaClient, type Membership } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const prisma = new PrismaClient();

const daysFromNow = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000);

async function main() {
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
  console.log(`Admin ready: ${admin.email} (password: ${adminPassword})`);

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
      features: [
        'Unlimited circles',
        'Multiple coordinators',
        'Priority support',
      ],
    },
  });

  // Coordinators and members get passwords so both dashboards can be tried
  // locally (stopgap until phone-OTP login lands).
  const coordinatorPassword =
    process.env.SEED_COORDINATOR_PASSWORD ?? 'alajo1234';
  const coordinatorHash = await bcrypt.hash(coordinatorPassword, 10);
  const memberPassword = process.env.SEED_MEMBER_PASSWORD ?? 'member1234';
  const memberHash = await bcrypt.hash(memberPassword, 10);

  const demoUsers = [
    {
      phone: '+2348011111111',
      email: 'iya.basira@gmail.com',
      name: 'Iya Basira',
      role: 'COORDINATOR',
    },
    {
      phone: '+2348022222222',
      email: 'chinedu.okafor@gmail.com',
      name: 'Chinedu Okafor',
      role: 'COORDINATOR',
    },
    {
      phone: '+2348033333333',
      email: 'amina.yusuf@gmail.com',
      name: 'Amina Yusuf',
      role: 'MEMBER',
    },
    {
      phone: '+2348044444444',
      email: 'tunde.adebayo@gmail.com',
      name: 'Tunde Adebayo',
      role: 'MEMBER',
    },
    {
      phone: '+2348055555555',
      email: 'ngozi.eze@gmail.com',
      name: 'Ngozi Eze',
      role: 'MEMBER',
    },
    {
      phone: '+2348066666666',
      email: 'musa.ibrahim@gmail.com',
      name: 'Musa Ibrahim',
      role: 'MEMBER',
    },
  ] as const;

  const users: Record<string, { id: string }> = {};
  for (const u of demoUsers) {
    const passwordHash =
      u.role === 'COORDINATOR' ? coordinatorHash : memberHash;
    users[u.phone] = await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash },
      create: {
        email: u.email,
        phone: u.phone,
        name: u.name,
        role: u.role,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    });
  }
  console.log(
    `Coordinator ready: iya.basira@gmail.com (password: ${coordinatorPassword})`,
  );
  console.log(
    `Member ready: amina.yusuf@gmail.com (password: ${memberPassword})`,
  );

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

  // Demo tracking data for the coordinator dashboard: members, an open
  // cycle, and contributions in every status. Records only — no funds move.
  const balogun = await prisma.circle.findFirst({
    where: { name: 'Balogun Traders Weekly' },
  });
  if (
    balogun &&
    (await prisma.membership.count({ where: { circleId: balogun.id } })) === 0
  ) {
    await prisma.circle.update({
      where: { id: balogun.id },
      data: { memberTarget: 6 },
    });

    const memberSeed: ReadonlyArray<readonly [string, string]> = [
      ['Amina Yusuf', '+2348033333333'],
      ['Tunde Adebayo', '+2348044444444'],
      ['Ngozi Eze', '+2348055555555'],
      ['Musa Ibrahim', '+2348066666666'],
      ['Bola Martins', '+2348077777777'],
      ['Kemi Alade', '+2348088888888'],
    ];
    const memberships: Membership[] = [];
    for (const [i, [name, phone]] of memberSeed.entries()) {
      memberships.push(
        await prisma.membership.create({
          data: {
            circleId: balogun.id,
            name,
            phone,
            position: i + 1,
            status: 'ACTIVE',
            userId: users[phone]?.id ?? null,
          },
        }),
      );
    }

    const cycle = await prisma.cycle.create({
      data: {
        circleId: balogun.id,
        index: 1,
        collectorId: memberships[0].id,
      },
    });

    // A tiny green PNG stands in for uploaded receipts in local dev.
    const uploadsDir = join(process.cwd(), 'uploads');
    await mkdir(uploadsDir, { recursive: true });
    const receiptUrl = '/uploads/seed-receipt.png';
    await writeFile(
      join(uploadsDir, 'seed-receipt.png'),
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      ),
    );

    const coordinatorId = users['+2348011111111'].id;
    const statusRows = [
      { m: memberships[0], status: 'PAID', receipt: true, reviewed: true },
      { m: memberships[1], status: 'PAID', receipt: false, reviewed: true },
      { m: memberships[2], status: 'PENDING_REVIEW', receipt: true },
      {
        m: memberships[3],
        status: 'REJECTED',
        receipt: true,
        reviewed: true,
        reason: 'Transfer receipt shows ₦3,000, not the full ₦5,000.',
      },
      { m: memberships[4], status: 'AWAITING' },
      { m: memberships[5], status: 'AWAITING' },
    ] as const;
    for (const row of statusRows) {
      await prisma.contribution.create({
        data: {
          membershipId: row.m.id,
          cycleId: cycle.id,
          amountNaira: balogun.contributionAmountNaira,
          status: row.status,
          receiptFileUrl: 'receipt' in row && row.receipt ? receiptUrl : null,
          rejectionReason: 'reason' in row ? row.reason : null,
          reviewedById:
            'reviewed' in row && row.reviewed ? coordinatorId : null,
          reviewedAt: 'reviewed' in row && row.reviewed ? new Date() : null,
        },
      });
    }
  }

  // Dedicated test accounts with their own phone numbers and passwords
  // (separate from the shared demo users above) so each dashboard can be
  // tried with a distinct login: a collector who owns a fresh circle, and a
  // contributor who belongs to it.
  const testCollectorEmail =
    process.env.SEED_TEST_COLLECTOR_EMAIL ?? 'baba.kazeem@gmail.com';
  const testCollectorPhone =
    process.env.SEED_TEST_COLLECTOR_PHONE ?? '+2348090000001';
  const testCollectorPassword =
    process.env.SEED_TEST_COLLECTOR_PASSWORD ?? 'collector5678';
  const testMemberEmail =
    process.env.SEED_TEST_MEMBER_EMAIL ?? 'chika.obi@gmail.com';
  const testMemberPhone =
    process.env.SEED_TEST_MEMBER_PHONE ?? '+2348090000002';
  const testMemberPassword =
    process.env.SEED_TEST_MEMBER_PASSWORD ?? 'contributor5678';

  const testCollector = await prisma.user.upsert({
    where: { email: testCollectorEmail },
    update: {
      role: 'COORDINATOR',
      passwordHash: await bcrypt.hash(testCollectorPassword, 10),
    },
    create: {
      email: testCollectorEmail,
      phone: testCollectorPhone,
      name: 'Baba Kazeem',
      role: 'COORDINATOR',
      emailVerifiedAt: new Date(),
      passwordHash: await bcrypt.hash(testCollectorPassword, 10),
    },
  });
  const testMember = await prisma.user.upsert({
    where: { email: testMemberEmail },
    update: { passwordHash: await bcrypt.hash(testMemberPassword, 10) },
    create: {
      email: testMemberEmail,
      phone: testMemberPhone,
      name: 'Chika Obi',
      role: 'MEMBER',
      emailVerifiedAt: new Date(),
      passwordHash: await bcrypt.hash(testMemberPassword, 10),
    },
  });
  // Sample payout accounts so the "pay to" panels have data to show.
  await prisma.user.updateMany({
    where: { phone: { in: ['+2348011111111', testCollectorPhone] } },
    data: {
      bankName: 'GTBank',
      bankAccountNumber: '0123456789',
    },
  });
  console.log(
    `Test collector ready: ${testCollector.email} (password: ${testCollectorPassword})`,
  );
  console.log(
    `Test contributor ready: ${testMember.email} (password: ${testMemberPassword})`,
  );

  // Give the test collector a fresh circle with the test contributor in it,
  // so both accounts land on a populated dashboard straight away.
  let ketu = await prisma.circle.findFirst({
    where: { name: 'Ketu Market Daily', coordinatorId: testCollector.id },
  });
  if (!ketu) {
    ketu = await prisma.circle.create({
      data: {
        name: 'Ketu Market Daily',
        contributionAmountNaira: 1000,
        frequency: 'DAILY',
        memberTarget: 4,
        coordinatorId: testCollector.id,
      },
    });
    const ketuMemberSeed: ReadonlyArray<
      readonly [string, string, string | null]
    > = [
      ['Chika Obi', testMemberPhone, testMember.id],
      ['Sade Balogun', '+2348090000003', null],
      ['Emeka Nwosu', '+2348090000004', null],
      ['Fatima Bello', '+2348090000005', null],
    ];
    const ketuMemberships: Membership[] = [];
    for (const [i, [name, phone, userId]] of ketuMemberSeed.entries()) {
      ketuMemberships.push(
        await prisma.membership.create({
          data: {
            circleId: ketu.id,
            name,
            phone,
            position: i + 1,
            status: 'ACTIVE',
            userId,
          },
        }),
      );
    }
    const ketuCycle = await prisma.cycle.create({
      data: {
        circleId: ketu.id,
        index: 1,
        collectorId: ketuMemberships[0].id,
      },
    });
    // One member already paid so the collection card shows both states;
    // the rest (including the test contributor) still owe — leaving the
    // contributor's receipt-upload flow free to test.
    for (const [i, m] of ketuMemberships.entries()) {
      await prisma.contribution.create({
        data: {
          membershipId: m.id,
          cycleId: ketuCycle.id,
          amountNaira: ketu.contributionAmountNaira,
          status: i === 1 ? 'PAID' : 'AWAITING',
          reviewedById: i === 1 ? testCollector.id : null,
          reviewedAt: i === 1 ? new Date() : null,
        },
      });
    }
  }

  // Demo appeal + advisory votes so the member dashboard shows the full
  // "consider me next" flow (independent of the membership-seeding block so
  // it also fills in on already-seeded databases).
  if (balogun && (await prisma.appeal.count()) === 0) {
    const byPhone = async (phone: string) =>
      prisma.membership.findFirst({
        where: { circleId: balogun.id, phone, status: 'ACTIVE' },
      });
    const [ngozi, tunde, musa, bola] = await Promise.all([
      byPhone('+2348055555555'),
      byPhone('+2348044444444'),
      byPhone('+2348066666666'),
      byPhone('+2348077777777'),
    ]);
    if (ngozi && tunde && musa && bola) {
      const appeal = await prisma.appeal.create({
        data: {
          circleId: balogun.id,
          appellantId: ngozi.id,
          reason:
            "School fees for my daughter are due before month end — I'm appealing to collect early this once.",
        },
      });
      await prisma.appealVote.createMany({
        data: [
          { appealId: appeal.id, voterId: tunde.id, value: 'SUPPORT' },
          { appealId: appeal.id, voterId: musa.id, value: 'SUPPORT' },
          { appealId: appeal.id, voterId: bola.id, value: 'OPPOSE' },
        ],
      });
    }
  }

  // Seeded accounts skip verification — mark every user's email (and phone,
  // where set) as verified so the demo/test logins work without a code.
  await prisma.user.updateMany({
    where: { emailVerifiedAt: null },
    data: { emailVerifiedAt: new Date() },
  });
  await prisma.user.updateMany({
    where: { phone: { not: null }, phoneVerifiedAt: null },
    data: { phoneVerifiedAt: new Date() },
  });

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
