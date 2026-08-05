import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { Unit } from '../types';

export class UnitRepository extends BaseRepository<Unit> {
  constructor() {
    super(COLLECTIONS.UNITS);
  }
}

export const unitRepository = new UnitRepository();
