import { useState, useEffect } from 'react';
import { timelineRepository } from '../repositories/TimelineRepository';
import { TimelineEvent } from '../types/student.types';

export function useStudentTimeline(studentId?: string, schoolId?: string) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    let unmounted = false;
    async function loadTimeline() {
      setLoading(true);
      try {
        const list = await timelineRepository.findByStudent(studentId!, schoolId);
        if (!unmounted) setEvents(list);
      } catch (err) {
        console.error('Error loading timeline:', err);
      } finally {
        if (!unmounted) setLoading(false);
      }
    }

    loadTimeline();
    return () => { unmounted = true; };
  }, [studentId, schoolId]);

  return { events, loading, timelineRepository };
}
