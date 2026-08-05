import { useState, useEffect } from 'react';
import { academicYearRepository } from '../repositories/AcademicYearRepository';
import { semesterRepository } from '../repositories/SemesterRepository';
import { AcademicYear, Semester } from '../types/academic.types';

export function useAcademicYears(schoolId?: string) {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unmounted = false;
    async function loadData() {
      setLoading(true);
      try {
        const [years, active] = await Promise.all([
          academicYearRepository.findAll(schoolId),
          academicYearRepository.findActive(schoolId),
        ]);

        if (!unmounted) {
          setAcademicYears(years);
          setActiveYear(active);

          if (active) {
            const sems = await semesterRepository.findByAcademicYear(active.id, schoolId);
            setSemesters(sems);
          }
        }
      } catch (err) {
        console.error('Error loading academic years:', err);
      } finally {
        if (!unmounted) setLoading(false);
      }
    }

    loadData();
    return () => { unmounted = true; };
  }, [schoolId]);

  return { academicYears, activeYear, semesters, loading, academicYearRepository, semesterRepository };
}
