import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { TimelineEvent } from '../types/student.types';

export class TimelineRepository extends BaseRepository<TimelineEvent> {
  constructor() {
    super(COLLECTIONS.STUDENT_TIMELINE);
  }

  async findByStudent(studentId: string, schoolId?: string): Promise<TimelineEvent[]> {
    const list = await this.findAll(schoolId);
    return list
      .filter(t => t.studentId === studentId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}

export const timelineRepository = new TimelineRepository();
