import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';

export interface FeeStructure {
  id?: string;
  schoolId?: string;
  course: string;
  yearOfStudy: number | string;
  term: string;
  amount: number;
  dueDate: string;
}

export class FeeRepository extends BaseRepository<FeeStructure> {
  constructor() {
    super(COLLECTIONS.FEES);
  }
}

export const feeRepository = new FeeRepository();
