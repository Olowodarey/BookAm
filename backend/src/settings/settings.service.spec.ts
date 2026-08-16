import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: {
    platformSettings: {
      upsert: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      platformSettings: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    service = new SettingsService(prisma as unknown as PrismaService);
  });

  describe('get', () => {
    it('upserts the singleton row (id = 1) so it always exists', async () => {
      prisma.platformSettings.upsert.mockResolvedValue({ id: 1 });
      await service.get();
      expect(prisma.platformSettings.upsert).toHaveBeenCalledWith({
        where: { id: 1 },
        update: {},
        create: { id: 1 },
      });
    });
  });

  describe('supportContact', () => {
    it('returns the two fields when the row exists', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue({
        supportWhatsapp: '+2348000000000',
        supportEmail: 'help@bookam.app',
      });
      expect(await service.supportContact()).toEqual({
        supportWhatsapp: '+2348000000000',
        supportEmail: 'help@bookam.app',
      });
    });

    it('defaults to nulls when no row has been created yet', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue(null);
      expect(await service.supportContact()).toEqual({
        supportWhatsapp: null,
        supportEmail: null,
      });
    });
  });

  describe('update', () => {
    it('trims values and upserts the singleton', async () => {
      prisma.platformSettings.upsert.mockResolvedValue({ id: 1 });
      await service.update({
        supportWhatsapp: '  +234 800 000 0000  ',
        supportEmail: ' help@bookam.app ',
      });
      expect(prisma.platformSettings.upsert).toHaveBeenCalledWith({
        where: { id: 1 },
        update: {
          supportWhatsapp: '+234 800 000 0000',
          supportEmail: 'help@bookam.app',
        },
        create: {
          id: 1,
          supportWhatsapp: '+234 800 000 0000',
          supportEmail: 'help@bookam.app',
        },
      });
    });

    it('stores a blank field as null (clears it)', async () => {
      prisma.platformSettings.upsert.mockResolvedValue({ id: 1 });
      await service.update({ supportEmail: '   ' });
      expect(prisma.platformSettings.upsert).toHaveBeenCalledWith({
        where: { id: 1 },
        update: { supportEmail: null },
        create: { id: 1, supportEmail: null },
      });
    });

    it('leaves an omitted field untouched', async () => {
      prisma.platformSettings.upsert.mockResolvedValue({ id: 1 });
      await service.update({ supportWhatsapp: '+2348000000000' });
      const arg = prisma.platformSettings.upsert.mock.calls[0][0];
      expect(arg.update).not.toHaveProperty('supportEmail');
    });
  });
});
