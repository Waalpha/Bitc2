import { studentRepository } from '../repositories/StudentRepository';
import { admissionRepository } from '../repositories/AdmissionRepository';
import { alumniRepository } from '../repositories/AlumniRepository';
import { studentDocumentRepository } from '../repositories/StudentDocumentRepository';
import { LoggerService } from './loggerService';

export class ReportService {
  static async getAdmissionsReport(schoolId?: string) {
    LoggerService.info('Generating Admissions Report', { schoolId });
    const applications = await admissionRepository.findAll(schoolId);
    return {
      totalApplications: applications.length,
      approved: applications.filter(a => a.status === 'approved' || a.stage === 'Approved' || a.stage === 'Enrolled').length,
      pending: applications.filter(a => a.status === 'pending').length,
      rejected: applications.filter(a => a.status === 'rejected').length,
    };
  }

  static async getEnrollmentReport(schoolId?: string) {
    LoggerService.info('Generating Enrollment Report', { schoolId });
    const students = await studentRepository.findAll(schoolId);
    return {
      totalEnrolled: students.length,
      active: students.filter(s => s.status === 'active' || s.lifecycleStatus === 'Active' || !s.status).length,
      deferred: students.filter(s => s.lifecycleStatus === 'Deferred').length,
      suspended: students.filter(s => s.status === 'suspended' || s.lifecycleStatus === 'Suspended').length,
    };
  }

  static async getGraduationReport(schoolId?: string) {
    LoggerService.info('Generating Graduation Report', { schoolId });
    const students = await studentRepository.findAll(schoolId);
    const graduated = students.filter(s => s.status === 'graduated' || s.lifecycleStatus === 'Graduated');
    return {
      graduatedCount: graduated.length,
    };
  }

  static async getAlumniReport(schoolId?: string) {
    LoggerService.info('Generating Alumni Network Report', { schoolId });
    const alumni = await alumniRepository.findAll(schoolId);
    return {
      totalAlumni: alumni.length,
      employed: alumni.filter(a => a.employer).length,
    };
  }

  static async getDocumentAuditReport(schoolId?: string) {
    LoggerService.info('Generating Document Audit Report', { schoolId });
    const docs = await studentDocumentRepository.findAll(schoolId);
    return {
      totalDocuments: docs.length,
      verified: docs.filter(d => d.status === 'verified').length,
      pending: docs.filter(d => d.status === 'pending').length,
    };
  }
}
