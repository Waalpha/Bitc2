import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { AppSettings } from '../types';

export class SettingsRepository extends BaseRepository<AppSettings> {
  constructor() {
    super(COLLECTIONS.SETTINGS);
  }
}

export const settingsRepository = new SettingsRepository();
