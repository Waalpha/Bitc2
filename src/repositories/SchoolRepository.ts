import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';

export interface SchoolRecord {
  id?: string;
  name: string;
  code: string;
  logo?: string;
  email?: string;
  phone?: string;
  address?: string;
  active?: boolean;
}

export class SchoolRepository extends BaseRepository<SchoolRecord> {
  constructor() {
    super(COLLECTIONS.SCHOOLS);
  }
}

export const schoolRepository = new SchoolRepository();
