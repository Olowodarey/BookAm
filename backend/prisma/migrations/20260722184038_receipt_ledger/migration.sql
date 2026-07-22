-- CreateTable
CREATE TABLE "ContributionReceipt" (
    "id" TEXT NOT NULL,
    "contributionId" TEXT NOT NULL,
    "amountNaira" INTEGER NOT NULL,
    "receiptFileUrl" TEXT NOT NULL,
    "uploadedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContributionReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutReceipt" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "amountNaira" INTEGER NOT NULL,
    "receiptFileUrl" TEXT NOT NULL,
    "uploadedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContributionReceipt_contributionId_idx" ON "ContributionReceipt"("contributionId");

-- CreateIndex
CREATE INDEX "PayoutReceipt_payoutId_idx" ON "PayoutReceipt"("payoutId");

-- AddForeignKey
ALTER TABLE "ContributionReceipt" ADD CONSTRAINT "ContributionReceipt_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "Contribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionReceipt" ADD CONSTRAINT "ContributionReceipt_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutReceipt" ADD CONSTRAINT "PayoutReceipt_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutReceipt" ADD CONSTRAINT "PayoutReceipt_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
