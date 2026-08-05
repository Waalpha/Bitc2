import { useState, useEffect } from 'react';
import { notificationRepository, NotificationRecord } from '../repositories/NotificationRepository';

export function useNotifications(schoolId?: string) {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = notificationRepository.listen(
      schoolId,
      (data) => {
        setNotifications(data);
        setLoading(false);
      },
      (err) => {
        console.error('Live listener error on notifications:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [schoolId]);

  return { notifications, loading, notificationRepository };
}
