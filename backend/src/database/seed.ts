import 'reflect-metadata';
import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { AppDataSource } from './data-source';
import { SubscriptionPlan, User } from '../entities';

/**
 * Idempotent seed: the initial platform admin (owner) and the subscription plan
 * catalog. Safe to run repeatedly — existing rows are matched by email/name.
 * Run with `pnpm seed`.
 */
async function main(): Promise<void> {
  const ds = await AppDataSource.initialize();
  const users = ds.getRepository(User);
  const plans = ds.getRepository(SubscriptionPlan);

  // Initial platform admin (owner). Set SEED_ADMIN_* in the environment;
  // change the password immediately after first login in production.
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@gmail.com';
  const adminPhone = process.env.SEED_ADMIN_PHONE ?? '+2348000000001';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin1234';

  let admin = await users.findOne({ where: { email: adminEmail } });
  if (admin) {
    admin.role = 'ADMIN';
  } else {
    admin = users.create({
      email: adminEmail,
      phone: adminPhone,
      name: 'BookAm Admin',
      role: 'ADMIN',
      emailVerifiedAt: new Date(),
      passwordHash: await bcrypt.hash(adminPassword, 10),
    });
  }
  await users.save(admin);
  console.log(`Admin ready: ${admin.email}`);

  // Subscription plan catalog — real product data the app offers.
  const catalog: Partial<SubscriptionPlan>[] = [
    {
      name: 'Starter',
      priceNaira: 0,
      interval: 'MONTHLY',
      maxCircles: 1,
      features: ['1 circle', 'Up to 15 members', 'WhatsApp reminders'],
    },
    {
      name: 'Alajo Pro',
      priceNaira: 2500,
      interval: 'MONTHLY',
      maxCircles: 5,
      features: ['5 circles', 'Unlimited members', 'Reminders + reports'],
    },
    {
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
  ];
  for (const plan of catalog) {
    const existing = await plans.findOne({ where: { name: plan.name } });
    if (!existing) await plans.save(plans.create(plan));
  }

  console.log('Seed complete.');
  await ds.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
