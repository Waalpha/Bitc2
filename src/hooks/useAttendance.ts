import { useState, useEffect } from 'react';
import { attendanceRepository, AttendanceRecord } from '../repositories/AttendanceRepository';

export function useAttendance(schoolId?: string) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = attendanceRepository.listen(
      schoolId,
      (data) => {
        setRecords(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [schoolId]);

  return { records, loading, error, attendanceRepository };
}
