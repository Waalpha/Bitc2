import { TimetableEntry, TimetableConflict } from '../types/academic.types';
import { LoggerService } from './loggerService';

export class TimetableEngineService {
  /**
   * Helper to convert HH:mm time string to minutes from midnight
   */
  private static timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Check if two time slots overlap
   */
  private static timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
    const s1 = this.timeToMinutes(start1);
    const e1 = this.timeToMinutes(end1);
    const s2 = this.timeToMinutes(start2);
    const e2 = this.timeToMinutes(end2);

    return Math.max(s1, s2) < Math.min(e1, e2);
  }

  /**
   * Detect conflicts across a list of timetable entries
   */
  static detectConflicts(entries: TimetableEntry[]): TimetableConflict[] {
    const conflicts: TimetableConflict[] = [];

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const e1 = entries[i];
        const e2 = entries[j];

        // Same day and overlapping times
        if (e1.day === e2.day && this.timesOverlap(e1.startTime, e1.endTime, e2.startTime, e2.endTime)) {
          // Teacher Conflict
          if (e1.teacherId && e1.teacherId === e2.teacherId) {
            conflicts.push({
              type: 'TEACHER_CONFLICT',
              message: `Teacher conflict for ${e1.teacherName || e1.teacherId} on ${e1.day} (${e1.startTime}-${e1.endTime})`,
              conflictingEntries: [e1, e2],
            });
          }

          // Room Conflict
          const room1 = e1.classroomId || e1.room;
          const room2 = e2.classroomId || e2.room;
          if (room1 && room1 === room2) {
            conflicts.push({
              type: 'ROOM_CONFLICT',
              message: `Room conflict for Room ${room1} on ${e1.day} (${e1.startTime}-${e1.endTime})`,
              conflictingEntries: [e1, e2],
            });
          }

          // Class Conflict
          if (e1.classId && e1.classId === e2.classId) {
            conflicts.push({
              type: 'CLASS_CONFLICT',
              message: `Class conflict for Class ID ${e1.classId} on ${e1.day} (${e1.startTime}-${e1.endTime})`,
              conflictingEntries: [e1, e2],
            });
          }
        }
      }
    }

    if (conflicts.length > 0) {
      LoggerService.warn(`Timetable Engine detected ${conflicts.length} conflicts`, conflicts);
    }

    return conflicts;
  }
}
