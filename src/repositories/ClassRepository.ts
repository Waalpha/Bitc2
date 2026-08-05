import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { Class } from '../types';

export class ClassRepository extends BaseRepository<Class> {
  constructor() {
    super(COLLECTIONS.CLASSES);
  }
}

export const classRepository = new ClassRepository();
