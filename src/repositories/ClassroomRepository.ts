import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { Classroom } from '../types/academic.types';

export class ClassroomRepository extends BaseRepository<Classroom> {
  constructor() {
    super(COLLECTIONS.CLASSROOMS);
  }

  async findAvailable(capacityNeeded: number, schoolId?: string): Promise<Classroom[]> {
    const rooms = await this.findAll(schoolId);
    return rooms.filter(r => r.capacity >= capacityNeeded);
  }
}

export const classroomRepository = new ClassroomRepository();
