import { useState, useEffect } from 'react';
import { teacherRepository } from '../repositories/TeacherRepository';
import { User } from '../types';

export function useTeachers(schoolId?: string) {
  const [teachers, setTeachers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = teacherRepository.listen(
      schoolId,
      (data) => {
        setTeachers(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [schoolId]);

  return { teachers, loading, error, teacherRepository };
}
