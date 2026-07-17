-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('OPEN', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "VoteValue" AS ENUM ('SUPPORT', 'OPPOSE');

-- CreateTable
CREATE TABLE "Appeal" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "appellantId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'OPEN',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "outcomeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppealVote" (
    "id" TEXT NOT NULL,
    "appealId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "value" "VoteValue" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppealVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Appeal_circleId_status_idx" ON "Appeal"("circleId", "status");

-- CreateIndex
CREATE INDEX "Appeal_appellantId_idx" ON "Appeal"("appellantId");

-- CreateIndex
CREATE UNIQUE INDEX "AppealVote_appealId_voterId_key" ON "AppealVote"("appealId", "voterId");

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_appellantId_fkey" FOREIGN KEY ("appellantId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppealVote" ADD CONSTRAINT "AppealVote_appealId_fkey" FOREIGN KEY ("appealId") REFERENCES "Appeal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppealVote" ADD CONSTRAINT "AppealVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

