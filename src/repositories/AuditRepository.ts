import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { AuditLogEntry } from '../security/permissionService';

export class AuditRepository extends BaseRepository<AuditLogEntry> {
  constructor() {
    super(COLLECTIONS.AUDIT_LOGS);
  }
}

export const auditRepository = new AuditRepository();
