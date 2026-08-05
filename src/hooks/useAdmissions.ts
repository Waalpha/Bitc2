import { useState, useEffect } from 'react';
import { admissionRepository } from '../repositories/AdmissionRepository';
import { AdmissionApplication } from '../types/student.types';

export function useAdmissions(schoolId?: string) {
  const [applications, setApplications] = useState<AdmissionApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unmounted = false;
    async function loadData() {
      setLoading(true);
      try {
        const list = await admissionRepository.findAll(schoolId);
        if (!unmounted) setApplications(list);
      } catch (err) {
        console.error('Error loading admissions:', err);
      } finally {
        if (!unmounted) setLoading(false);
      }
    }

    loadData();
    return () => { unmounted = true; };
  }, [schoolId]);

  return { applications, loading, admissionRepository };
}
