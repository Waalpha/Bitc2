import { examRepository, ExamRecord } from '../repositories/ExamRepository';
import { ExamValidator } from '../validators/exam.validator';
import { LoggerService } from './loggerService';

export class ExamService {
  static async createExam(schoolId: string, data: Omit<ExamRecord, 'id' | 'schoolId'>): Promise<ExamRecord> {
    ExamValidator.validate(data);
    LoggerService.info('Creating new exam', { schoolId, title: data.title });
    return await examRepository.create({ ...data, schoolId });
  }

  static async publishExam(examId: string): Promise<void> {
    LoggerService.info('Publishing exam', { examId });
    await examRepository.update(examId, { published: true });
  }

  static async getExams(schoolId?: string): Promise<ExamRecord[]> {
    return await examRepository.findAll(schoolId);
  }
}
