import { useState, useEffect } from 'react';
import { examRepository, ExamRecord } from '../repositories/ExamRepository';

export function useExams(schoolId?: string) {
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = examRepository.listen(
      schoolId,
      (data) => {
        setExams(data);
        setLoading(false);
      },
      (err) => {
        console.error('Live listener error on exams:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [schoolId]);

  return { exams, loading, examRepository };
}
