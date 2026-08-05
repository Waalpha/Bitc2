import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { CreditDebitNote } from '../types/finance.types';

export class CreditDebitNoteRepository extends BaseRepository<CreditDebitNote> {
  constructor() {
    super(COLLECTIONS.CREDIT_DEBIT_NOTES);
  }

  async findByStudent(studentId: string, schoolId?: string): Promise<CreditDebitNote[]> {
    const notes = await this.findAll(schoolId);
    return notes.filter(n => n.studentId === studentId);
  }
}

export const creditDebitNoteRepository = new CreditDebitNoteRepository();
