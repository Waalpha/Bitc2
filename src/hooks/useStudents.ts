import { useState, useEffect } from 'react';
import { studentRepository } from '../repositories/StudentRepository';
import { User } from '../types';

export function useStudents(schoolId?: string) {
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = studentRepository.listen(
      schoolId,
      (data) => {
        setStudents(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [schoolId]);

  return { students, loading, error, studentRepository };
}
