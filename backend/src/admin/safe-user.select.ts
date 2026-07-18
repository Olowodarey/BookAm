/** Prisma select matching SafeUser — keeps passwordHash out of responses. */
export const safeUserSelect = {
  id: true,
  phone: true,
  name: true,
  role: true,
  status: true,
  email: true,
  altPhone: true,
  bankName: true,
  bankAccountNumber: true,
  bankAccountName: true,
  createdAt: true,
} as const;
