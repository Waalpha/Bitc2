import { schoolRepository, SchoolRecord } from '../repositories/SchoolRepository';
import { LoggerService } from './loggerService';

export class SchoolService {
  static async getSchools(): Promise<SchoolRecord[]> {
    return await schoolRepository.findAll();
  }

  static async registerSchool(data: Omit<SchoolRecord, 'id'>): Promise<SchoolRecord> {
    LoggerService.info('Registering new school branch/campus', { name: data.name, code: data.code });
    return await schoolRepository.create(data);
  }
}
