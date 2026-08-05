import { studentRepository } from '../repositories/StudentRepository';
import { alumniRepository } from '../repositories/AlumniRepository';
import { timelineRepository } from '../repositories/TimelineRepository';
import { notificationRepository } from '../repositories/NotificationRepository';
import { LifecycleStatus, AlumniProfile } from '../types/student.types';
import { LoggerService } from './loggerService';

export class StudentLifecycleService {
  static async changeStatus(
    studentId: string,
    newStatus: LifecycleStatus,
    updatedBy = 'Admin',
    notes?: string,
    schoolId?: string
  ): Promise<void> {
    LoggerService.info('Updating student lifecycle status', { studentId, newStatus });

    const student = await studentRepository.findById(studentId);
    if (!student) return;

    await studentRepository.update(studentId, {
      lifecycleStatus: newStatus,
      status: newStatus.toLowerCase() as any,
    });

    await timelineRepository.create({
      studentId,
      schoolId: schoolId || student.schoolId,
      type: newStatus === 'Graduated' ? 'Graduation' : newStatus === 'Suspended' ? 'Suspension' : 'Admission',
      title: `Status Changed to ${newStatus}`,
      description: `Student lifecycle updated to ${newStatus}. ${notes ? `Note: ${notes}` : ''}`,
      timestamp: new Date().toISOString(),
      createdBy: updatedBy,
    });

    // Handle Graduation -> Move to Alumni automatically
    if (newStatus === 'Graduated') {
      const existingAlumni = await alumniRepository.findByStudent(studentId, schoolId || student.schoolId);
      if (!existingAlumni) {
        const alumniProfile: Omit<AlumniProfile, 'id'> = {
          studentId,
          schoolId: schoolId || student.schoolId,
          fullName: student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim(),
          regNo: student.regNo || student.admissionNumber || 'N/A',
          course: student.course || 'General',
          graduationYear: new Date().getFullYear().toString(),
        };
        await alumniRepository.create(alumniProfile);
      }

      await notificationRepository.create({
        schoolId: schoolId || student.schoolId,
        userId: studentId,
        title: 'Graduation & Alumni Transition',
        message: 'Congratulations! You have been moved to the Alumni network.',
        type: 'success',
      });
    }
  }
}
