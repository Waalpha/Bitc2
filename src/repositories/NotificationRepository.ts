import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';

export interface NotificationRecord {
  id?: string;
  schoolId?: string;
  userId?: string;
  targetRole?: string;
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'success' | 'urgent';
  read?: boolean;
  createdAt?: string;
}

export class NotificationRepository extends BaseRepository<NotificationRecord> {
  constructor() {
    super(COLLECTIONS.NOTIFICATIONS);
  }
}

export const notificationRepository = new NotificationRepository();
