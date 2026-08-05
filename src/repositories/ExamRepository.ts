import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';

export interface ExamRecord {
  id?: string;
  schoolId?: string;
  title: string;
  unitCode: string;
  unitName: string;
  date: string;
  venue?: string;
  totalMarks?: number;
  published?: boolean;
}

export class ExamRepository extends BaseRepository<ExamRecord> {
  constructor() {
    super(COLLECTIONS.EXAMS);
  }
}

export const examRepository = new ExamRepository();
