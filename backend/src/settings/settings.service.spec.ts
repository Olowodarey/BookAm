import { Repository } from 'typeorm';
import { PlatformSettings } from '../entities';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let settings: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };

  beforeEach(() => {
    settings = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((row) => Promise.resolve(row)),
      create: jest.fn().mockImplementation((row) => row),
    };
    service = new SettingsService(
      settings as unknown as Repository<PlatformSettings>,
    );
  });

  describe('get', () => {
    it('returns the existing singleton without creating one', async () => {
      const row = { id: 1, supportWhatsapp: null, supportEmail: null };
      settings.findOne.mockResolvedValue(row);
      expect(await service.get()).toBe(row);
      expect(settings.save).not.toHaveBeenCalled();
    });

    it('creates the singleton (id = 1) when missing', async () => {
      settings.findOne.mockResolvedValue(null);
      await service.get();
      expect(settings.create).toHaveBeenCalledWith({ id: 1 });
      expect(settings.save).toHaveBeenCalled();
    });
  });

  describe('supportContact', () => {
    it('returns the two fields when the row exists', async () => {
      settings.findOne.mockResolvedValue({
        supportWhatsapp: '+2348000000000',
        supportEmail: 'help@bookam.app',
      });
      expect(await service.supportContact()).toEqual({
        supportWhatsapp: '+2348000000000',
        supportEmail: 'help@bookam.app',
      });
    });

    it('defaults to nulls when no row has been created yet', async () => {
      settings.findOne.mockResolvedValue(null);
      expect(await service.supportContact()).toEqual({
        supportWhatsapp: null,
        supportEmail: null,
      });
    });
  });

  describe('update', () => {
    it('trims values and saves the singleton', async () => {
      settings.findOne.mockResolvedValue({
        id: 1,
        supportWhatsapp: null,
        supportEmail: null,
      });
      const saved = await service.update({
        supportWhatsapp: '  +234 800 000 0000  ',
        supportEmail: ' help@bookam.app ',
      });
      expect(saved.supportWhatsapp).toBe('+234 800 000 0000');
      expect(saved.supportEmail).toBe('help@bookam.app');
    });

    it('stores a blank field as null (clears it)', async () => {
      settings.findOne.mockResolvedValue({
        id: 1,
        supportWhatsapp: '+234',
        supportEmail: 'x@y.z',
      });
      const saved = await service.update({ supportEmail: '   ' });
      expect(saved.supportEmail).toBeNull();
    });

    it('leaves an omitted field untouched', async () => {
      settings.findOne.mockResolvedValue({
        id: 1,
        supportWhatsapp: null,
        supportEmail: 'keep@me.z',
      });
      const saved = await service.update({ supportWhatsapp: '+2348000000000' });
      expect(saved.supportWhatsapp).toBe('+2348000000000');
      expect(saved.supportEmail).toBe('keep@me.z');
    });
  });
});
