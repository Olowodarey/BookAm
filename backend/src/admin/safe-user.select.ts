/** Prisma select matching SafeUser — keeps passwordHash out of responses. */
export const safeUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  phone: true,
  phoneVerifiedAt: true,
  altPhone: true,
  bankName: true,
  bankAccountNumber: true,
  bankAccountName: true,
  createdAt: true,
} as const;
