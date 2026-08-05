import { useState, useEffect } from 'react';
import { schoolRepository, SchoolRecord } from '../repositories/SchoolRepository';

export function useSchool(schoolId?: string) {
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [activeSchool, setActiveSchool] = useState<SchoolRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unmounted = false;
    async function loadSchools() {
      setLoading(true);
      try {
        const data = await schoolRepository.findAll();
        if (!unmounted) {
          setSchools(data);
          if (schoolId) {
            const found = data.find(s => s.id === schoolId);
            if (found) setActiveSchool(found);
          }
        }
      } catch (err) {
        console.error('Failed to load schools:', err);
      } finally {
        if (!unmounted) setLoading(false);
      }
    }

    loadSchools();
    return () => { unmounted = true; };
  }, [schoolId]);

  return { schools, activeSchool, loading, schoolRepository };
}
