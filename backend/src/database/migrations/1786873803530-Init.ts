import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1786873803530 implements MigrationInterface {
  name = 'Init1786873803530';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."User_role_enum" AS ENUM('MEMBER', 'COORDINATOR', 'ADMIN')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."User_status_enum" AS ENUM('ACTIVE', 'SUSPENDED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "User" ("id" uuid NOT NULL, "email" character varying NOT NULL, "name" character varying NOT NULL, "passwordHash" character varying, "emailVerifiedAt" TIMESTAMP, "googleId" character varying, "phone" character varying, "phoneVerifiedAt" TIMESTAMP, "altPhone" character varying, "bankName" character varying, "bankAccountNumber" character varying, "bankAccountName" character varying, "role" "public"."User_role_enum" NOT NULL DEFAULT 'MEMBER', "status" "public"."User_status_enum" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9862f679340fb2388436a5ab3e4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_4a257d2c9837248d70640b3e36" ON "User"  ("email") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_619d68708f1a4e36dbc1ae9405" ON "User"  ("googleId") WHERE "googleId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_95850461f664daccd64a68b8a7" ON "User"  ("phone") WHERE "phone" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."CollectorApplication_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "CollectorApplication" ("id" uuid NOT NULL, "status" "public"."CollectorApplication_status_enum" NOT NULL DEFAULT 'PENDING', "note" character varying, "applicantId" uuid NOT NULL, "reviewNote" character varying, "reviewedById" uuid, "reviewedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4f9104ab5c93ea395cb2865e881" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5cc5a283a358d3eeb33df2b495" ON "CollectorApplication"  ("applicantId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b6783620c1f2415788e662df37" ON "CollectorApplication"  ("status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."SubscriptionPlan_interval_enum" AS ENUM('MONTHLY', 'QUARTERLY', 'YEARLY')`,
    );
    await queryRunner.query(
      `CREATE TABLE "SubscriptionPlan" ("id" uuid NOT NULL, "name" character varying NOT NULL, "priceNaira" integer NOT NULL, "interval" "public"."SubscriptionPlan_interval_enum" NOT NULL DEFAULT 'MONTHLY', "maxCircles" integer, "features" text array NOT NULL DEFAULT '{}', "active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2a96f422dd8968c2461b60c0fae" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_7c74a548a0f7111f938e8d0e64" ON "SubscriptionPlan"  ("name") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."Subscription_status_enum" AS ENUM('ACTIVE', 'EXPIRED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "Subscription" ("id" uuid NOT NULL, "userId" uuid NOT NULL, "planId" uuid NOT NULL, "status" "public"."Subscription_status_enum" NOT NULL DEFAULT 'ACTIVE', "periodStart" TIMESTAMP NOT NULL, "periodEnd" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_eb0d69496fa84cd24da9fc78edd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1c52c9acef286c097819a1e134" ON "Subscription"  ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3ec3c4ae3f6a98ecfcdbf615cf" ON "Subscription"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "PayoutReceipt" ("id" uuid NOT NULL, "payoutId" uuid NOT NULL, "amountNaira" integer NOT NULL, "receiptFileUrl" character varying NOT NULL, "uploadedById" uuid, "note" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a6179d587e5c6727efd5c66062d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7ae16d52f187b20766ddd031ae" ON "PayoutReceipt"  ("payoutId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."Payout_status_enum" AS ENUM('PENDING', 'COMPLETED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "Payout" ("id" uuid NOT NULL, "cycleId" uuid NOT NULL, "collectorId" uuid NOT NULL, "amountNaira" integer NOT NULL, "status" "public"."Payout_status_enum" NOT NULL DEFAULT 'PENDING', "receiptFileUrl" character varying, "completedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_2d02c680bd09686ce04f8991484" UNIQUE ("cycleId"), CONSTRAINT "REL_2d02c680bd09686ce04f899148" UNIQUE ("cycleId"), CONSTRAINT "PK_0a3e055c9aaf8b888ecf7d44188" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_15617e7f3189d938b74b5a24b4" ON "Payout"  ("collectorId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."Cycle_status_enum" AS ENUM('OPEN', 'COMPLETED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "Cycle" ("id" uuid NOT NULL, "circleId" uuid NOT NULL, "index" integer NOT NULL, "status" "public"."Cycle_status_enum" NOT NULL DEFAULT 'OPEN', "collectorId" uuid, "startedAt" TIMESTAMP NOT NULL DEFAULT now(), "dueAt" TIMESTAMP, "completedAt" TIMESTAMP, CONSTRAINT "UQ_080dc238fb7e45b42d4108aa1fd" UNIQUE ("circleId", "index"), CONSTRAINT "PK_285adacae72a002a6388000f275" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cf77a8050525196246a5a5c343" ON "Cycle"  ("circleId", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "ContributionReceipt" ("id" uuid NOT NULL, "contributionId" uuid NOT NULL, "amountNaira" integer NOT NULL, "receiptFileUrl" character varying NOT NULL, "uploadedById" uuid, "note" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_508ee39f43cd01af58203b3a2d3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4377052759496593030ca9ad17" ON "ContributionReceipt"  ("contributionId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."Contribution_status_enum" AS ENUM('AWAITING', 'PENDING_REVIEW', 'PAID', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "Contribution" ("id" uuid NOT NULL, "membershipId" uuid NOT NULL, "cycleId" uuid NOT NULL, "amountNaira" integer NOT NULL, "status" "public"."Contribution_status_enum" NOT NULL DEFAULT 'AWAITING', "receiptFileUrl" character varying, "rejectionReason" character varying, "reviewedById" uuid, "reviewedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_092ef3a424e12deb6492a9ac970" UNIQUE ("membershipId", "cycleId"), CONSTRAINT "PK_5e5fc4b625e4618c4ef1fb3b293" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_801afded1dffdafe00ed7be680" ON "Contribution"  ("cycleId", "status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."AppealVote_value_enum" AS ENUM('SUPPORT', 'OPPOSE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "AppealVote" ("id" uuid NOT NULL, "appealId" uuid NOT NULL, "voterId" uuid NOT NULL, "value" "public"."AppealVote_value_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_45930c4fc740950c6d4e1b4f14a" UNIQUE ("appealId", "voterId"), CONSTRAINT "PK_6ee099f94333393a208d593c3b7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."Appeal_status_enum" AS ENUM('OPEN', 'APPROVED', 'REJECTED', 'WITHDRAWN')`,
    );
    await queryRunner.query(
      `CREATE TABLE "Appeal" ("id" uuid NOT NULL, "circleId" uuid NOT NULL, "appellantId" uuid NOT NULL, "reason" character varying NOT NULL, "status" "public"."Appeal_status_enum" NOT NULL DEFAULT 'OPEN', "decidedById" uuid, "decidedAt" TIMESTAMP, "outcomeNote" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_68e64fe346eec48b4c117b11b37" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_72d27c36f4bdf0848b49242e10" ON "Appeal"  ("appellantId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b40172890974fae94e0bde64d9" ON "Appeal"  ("circleId", "status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."Membership_status_enum" AS ENUM('INVITED', 'REQUESTED', 'ACTIVE', 'REMOVED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "Membership" ("id" uuid NOT NULL, "circleId" uuid NOT NULL, "userId" uuid, "name" character varying NOT NULL, "phone" character varying, "invitedEmail" character varying, "position" integer NOT NULL DEFAULT '0', "status" "public"."Membership_status_enum" NOT NULL DEFAULT 'INVITED', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_db6fe01b9c1f9f7b244a12b5092" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fb20f62829592a4a49a465dd6b" ON "Membership"  ("invitedEmail") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_072997fc30e9e070e6f6f9d231" ON "Membership"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8f916bc6df70dbdb84f18c1831" ON "Membership"  ("circleId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."Circle_frequency_enum" AS ENUM('DAILY', 'WEEKLY', 'MONTHLY')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."Circle_status_enum" AS ENUM('ACTIVE', 'COMPLETED', 'PAUSED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "Circle" ("id" uuid NOT NULL, "name" character varying NOT NULL, "contributionAmountNaira" integer NOT NULL, "frequency" "public"."Circle_frequency_enum" NOT NULL, "status" "public"."Circle_status_enum" NOT NULL DEFAULT 'ACTIVE', "memberTarget" integer NOT NULL DEFAULT '0', "coordinatorFeePercent" integer NOT NULL DEFAULT '0', "startDate" TIMESTAMP, "inviteToken" character varying, "coordinatorId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d4e0a8183b05452a4960e8898ff" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_4e373dc966c059f3e00c6e9b9f" ON "Circle"  ("inviteToken") WHERE "inviteToken" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c8131f4d4da04184a05c9e642e" ON "Circle"  ("coordinatorId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "PhoneOtp" ("id" uuid NOT NULL, "phone" character varying NOT NULL, "codeHash" character varying NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "attempts" integer NOT NULL DEFAULT '0', "consumedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1e4b40196ec545713ac6d19c0e1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a0c776dd59b864b5c46eb9adbd" ON "PhoneOtp"  ("phone", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "EmailOtp" ("id" uuid NOT NULL, "email" character varying NOT NULL, "codeHash" character varying NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "attempts" integer NOT NULL DEFAULT '0', "consumedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b8522d11c193fa67f345cdf9d65" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3fbb91ee4abea44cd5468fd0e6" ON "EmailOtp"  ("email", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "WaitlistEntry" ("id" uuid NOT NULL, "email" character varying NOT NULL, "source" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a1cf947578b31c4b5108f852c52" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_94f0f862a35557a92aa96a6ae5" ON "WaitlistEntry"  ("email") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1db507d21e0a33e1fb3a45f38d" ON "WaitlistEntry"  ("createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "PlatformSettings" ("id" integer NOT NULL DEFAULT '1', "supportWhatsapp" character varying, "supportEmail" character varying, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_aa7dcdde119f9f93158c42c1538" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "CollectorApplication" ADD CONSTRAINT "FK_5cc5a283a358d3eeb33df2b4957" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "CollectorApplication" ADD CONSTRAINT "FK_780e5d19a45d06fff0c21342f7e" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Subscription" ADD CONSTRAINT "FK_3ec3c4ae3f6a98ecfcdbf615cf4" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Subscription" ADD CONSTRAINT "FK_9cbb1f303cffaca2ca4b782191f" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "PayoutReceipt" ADD CONSTRAINT "FK_7ae16d52f187b20766ddd031aea" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "PayoutReceipt" ADD CONSTRAINT "FK_775e777bfdfaa6e7a0300ce05d5" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Payout" ADD CONSTRAINT "FK_2d02c680bd09686ce04f8991484" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Payout" ADD CONSTRAINT "FK_15617e7f3189d938b74b5a24b4e" FOREIGN KEY ("collectorId") REFERENCES "Membership"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Cycle" ADD CONSTRAINT "FK_23eb063c4ea5a0b4a0909e6524c" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Cycle" ADD CONSTRAINT "FK_c96e0c327275f0d4bdd4303ce33" FOREIGN KEY ("collectorId") REFERENCES "Membership"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ContributionReceipt" ADD CONSTRAINT "FK_4377052759496593030ca9ad17f" FOREIGN KEY ("contributionId") REFERENCES "Contribution"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ContributionReceipt" ADD CONSTRAINT "FK_8ce12c57869dc006360cfa514ae" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Contribution" ADD CONSTRAINT "FK_cf1eb2cef34c342676f9248161a" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Contribution" ADD CONSTRAINT "FK_3acb9a29399acf9d28f16b76f5b" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Contribution" ADD CONSTRAINT "FK_f29817c3e7bcb9e49d37abaffc8" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "AppealVote" ADD CONSTRAINT "FK_5f8815cd0303111d7a873159dad" FOREIGN KEY ("appealId") REFERENCES "Appeal"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "AppealVote" ADD CONSTRAINT "FK_5802aa2563270f41b389fc2d4d3" FOREIGN KEY ("voterId") REFERENCES "Membership"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Appeal" ADD CONSTRAINT "FK_6740482ca7ee80f9d45067e9a90" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Appeal" ADD CONSTRAINT "FK_72d27c36f4bdf0848b49242e107" FOREIGN KEY ("appellantId") REFERENCES "Membership"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Appeal" ADD CONSTRAINT "FK_b24a907ea72a973d3f880b7530c" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Membership" ADD CONSTRAINT "FK_8f916bc6df70dbdb84f18c18317" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Membership" ADD CONSTRAINT "FK_072997fc30e9e070e6f6f9d231d" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Circle" ADD CONSTRAINT "FK_c8131f4d4da04184a05c9e642ed" FOREIGN KEY ("coordinatorId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "Circle" DROP CONSTRAINT "FK_c8131f4d4da04184a05c9e642ed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Membership" DROP CONSTRAINT "FK_072997fc30e9e070e6f6f9d231d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Membership" DROP CONSTRAINT "FK_8f916bc6df70dbdb84f18c18317"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Appeal" DROP CONSTRAINT "FK_b24a907ea72a973d3f880b7530c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Appeal" DROP CONSTRAINT "FK_72d27c36f4bdf0848b49242e107"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Appeal" DROP CONSTRAINT "FK_6740482ca7ee80f9d45067e9a90"`,
    );
    await queryRunner.query(
      `ALTER TABLE "AppealVote" DROP CONSTRAINT "FK_5802aa2563270f41b389fc2d4d3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "AppealVote" DROP CONSTRAINT "FK_5f8815cd0303111d7a873159dad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Contribution" DROP CONSTRAINT "FK_f29817c3e7bcb9e49d37abaffc8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Contribution" DROP CONSTRAINT "FK_3acb9a29399acf9d28f16b76f5b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Contribution" DROP CONSTRAINT "FK_cf1eb2cef34c342676f9248161a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ContributionReceipt" DROP CONSTRAINT "FK_8ce12c57869dc006360cfa514ae"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ContributionReceipt" DROP CONSTRAINT "FK_4377052759496593030ca9ad17f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Cycle" DROP CONSTRAINT "FK_c96e0c327275f0d4bdd4303ce33"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Cycle" DROP CONSTRAINT "FK_23eb063c4ea5a0b4a0909e6524c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Payout" DROP CONSTRAINT "FK_15617e7f3189d938b74b5a24b4e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Payout" DROP CONSTRAINT "FK_2d02c680bd09686ce04f8991484"`,
    );
    await queryRunner.query(
      `ALTER TABLE "PayoutReceipt" DROP CONSTRAINT "FK_775e777bfdfaa6e7a0300ce05d5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "PayoutReceipt" DROP CONSTRAINT "FK_7ae16d52f187b20766ddd031aea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Subscription" DROP CONSTRAINT "FK_9cbb1f303cffaca2ca4b782191f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Subscription" DROP CONSTRAINT "FK_3ec3c4ae3f6a98ecfcdbf615cf4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "CollectorApplication" DROP CONSTRAINT "FK_780e5d19a45d06fff0c21342f7e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "CollectorApplication" DROP CONSTRAINT "FK_5cc5a283a358d3eeb33df2b4957"`,
    );
    await queryRunner.query(`DROP TABLE "PlatformSettings"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1db507d21e0a33e1fb3a45f38d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_94f0f862a35557a92aa96a6ae5"`,
    );
    await queryRunner.query(`DROP TABLE "WaitlistEntry"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3fbb91ee4abea44cd5468fd0e6"`,
    );
    await queryRunner.query(`DROP TABLE "EmailOtp"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a0c776dd59b864b5c46eb9adbd"`,
    );
    await queryRunner.query(`DROP TABLE "PhoneOtp"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c8131f4d4da04184a05c9e642e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4e373dc966c059f3e00c6e9b9f"`,
    );
    await queryRunner.query(`DROP TABLE "Circle"`);
    await queryRunner.query(`DROP TYPE "public"."Circle_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."Circle_frequency_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8f916bc6df70dbdb84f18c1831"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_072997fc30e9e070e6f6f9d231"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fb20f62829592a4a49a465dd6b"`,
    );
    await queryRunner.query(`DROP TABLE "Membership"`);
    await queryRunner.query(`DROP TYPE "public"."Membership_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b40172890974fae94e0bde64d9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_72d27c36f4bdf0848b49242e10"`,
    );
    await queryRunner.query(`DROP TABLE "Appeal"`);
    await queryRunner.query(`DROP TYPE "public"."Appeal_status_enum"`);
    await queryRunner.query(`DROP TABLE "AppealVote"`);
    await queryRunner.query(`DROP TYPE "public"."AppealVote_value_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_801afded1dffdafe00ed7be680"`,
    );
    await queryRunner.query(`DROP TABLE "Contribution"`);
    await queryRunner.query(`DROP TYPE "public"."Contribution_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4377052759496593030ca9ad17"`,
    );
    await queryRunner.query(`DROP TABLE "ContributionReceipt"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cf77a8050525196246a5a5c343"`,
    );
    await queryRunner.query(`DROP TABLE "Cycle"`);
    await queryRunner.query(`DROP TYPE "public"."Cycle_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_15617e7f3189d938b74b5a24b4"`,
    );
    await queryRunner.query(`DROP TABLE "Payout"`);
    await queryRunner.query(`DROP TYPE "public"."Payout_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7ae16d52f187b20766ddd031ae"`,
    );
    await queryRunner.query(`DROP TABLE "PayoutReceipt"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3ec3c4ae3f6a98ecfcdbf615cf"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1c52c9acef286c097819a1e134"`,
    );
    await queryRunner.query(`DROP TABLE "Subscription"`);
    await queryRunner.query(`DROP TYPE "public"."Subscription_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7c74a548a0f7111f938e8d0e64"`,
    );
    await queryRunner.query(`DROP TABLE "SubscriptionPlan"`);
    await queryRunner.query(
      `DROP TYPE "public"."SubscriptionPlan_interval_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b6783620c1f2415788e662df37"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5cc5a283a358d3eeb33df2b495"`,
    );
    await queryRunner.query(`DROP TABLE "CollectorApplication"`);
    await queryRunner.query(
      `DROP TYPE "public"."CollectorApplication_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_95850461f664daccd64a68b8a7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_619d68708f1a4e36dbc1ae9405"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4a257d2c9837248d70640b3e36"`,
    );
    await queryRunner.query(`DROP TABLE "User"`);
    await queryRunner.query(`DROP TYPE "public"."User_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."User_role_enum"`);
  }
}
