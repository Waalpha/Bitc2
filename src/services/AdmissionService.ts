import { admissionRepository } from '../repositories/AdmissionRepository';
import { studentRepository } from '../repositories/StudentRepository';
import { timelineRepository } from '../repositories/TimelineRepository';
import { notificationRepository } from '../repositories/NotificationRepository';
import { AdmissionApplication, AdmissionStage } from '../types/student.types';
import { LoggerService } from './loggerService';
import { ValidationError } from '../lib/errors';

export class AdmissionService {
  static generateAdmissionNumber(prefix = 'ADM'): string {
    const year = new Date().getFullYear();
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}/${year}/${randomSeq}`;
  }

  static async submitApplication(
    schoolId: string,
    data: Omit<AdmissionApplication, 'id' | 'schoolId' | 'stage' | 'status' | 'submittedAt'>
  ): Promise<AdmissionApplication> {
    LoggerService.info('Submitting admission application', { schoolId, email: data.email });

    const existing = await admissionRepository.findByEmail(data.email, schoolId);
    if (existing) {
      throw new ValidationError('An application with this email already exists.');
    }

    const admNo = this.generateAdmissionNumber();
    const app = await admissionRepository.create({
      ...data,
      schoolId,
      admissionNumber: admNo,
      stage: 'Application Submitted',
      status: 'pending',
      submittedAt: new Date().toISOString(),
      history: [{ stage: 'Application Submitted', timestamp: new Date().toISOString(), notes: 'Initial submission' }],
    });

    await notificationRepository.create({
      schoolId,
      title: 'New Admission Application',
      message: `Applicant ${data.studentName} (${admNo}) has submitted an admission request.`,
      targetRole: 'registrar',
      type: 'info',
    });

    return app;
  }

  static async updateStage(
    appId: string,
    newStage: AdmissionStage,
    updatedBy = 'System',
    notes?: string
  ): Promise<AdmissionApplication | null> {
    const app = await admissionRepository.findById(appId);
    if (!app) return null;

    LoggerService.info('Advancing admission application stage', { appId, newStage });

    const history = app.history || [];
    history.push({ stage: newStage, timestamp: new Date().toISOString(), updatedBy, notes });

    let status = app.status;
    if (newStage === 'Approved' || newStage === 'Enrolled') status = 'approved';
    if (newStage === 'Rejected') status = 'rejected';

    await admissionRepository.update(appId, {
      stage: newStage,
      status,
      history,
    });

    // Auto-create student record if stage is Enrolled
    if (newStage === 'Enrolled' && app.schoolId) {
      const existingStudent = await studentRepository.findByRegNo(app.admissionNumber || '', app.schoolId);
      if (!existingStudent) {
        const student = await studentRepository.create({
          uid: `UID_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          role: 'student',
          createdAt: new Date().toISOString(),
          schoolId: app.schoolId,
          name: app.studentName,
          email: app.email,
          phone: app.phone,
          regNo: app.admissionNumber,
          admissionNumber: app.admissionNumber,
          dateOfBirth: app.dateOfBirth,
          gender: app.gender,
          address: app.address,
          course: app.course,
          status: 'active',
          lifecycleStatus: 'Active',
        });

        const createdStudentId = student.id || student.uid || '';
        await timelineRepository.create({
          studentId: createdStudentId,
          schoolId: app.schoolId,
          type: 'Admission',
          title: 'Student Enrolled',
          description: `Successfully enrolled with Registration No ${app.admissionNumber}`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return { ...app, stage: newStage, status, history };
  }
}
