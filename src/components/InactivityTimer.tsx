import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';

export const InactivityTimer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { user, logout, settings } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const timeoutDuration = (settings?.sessionTimeoutSeconds ?? 300) * 1000;

  useEffect(() => {
    const handleTimeout = async () => {
      if (logout) {
        await logout();
      }
      navigate('/');
    };

    const resetTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      if (user && timeoutDuration > 0) {
        timeoutRef.current = setTimeout(() => {
          handleTimeout();
        }, timeoutDuration);
      }
    };

    if (!user || timeoutDuration <= 0) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      return;
    }

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    const activityHandler = () => resetTimer();

    events.forEach(event => {
      window.addEventListener(event, activityHandler);
    });

    resetTimer();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, activityHandler);
      });
    };
  }, [user, timeoutDuration, logout, navigate]);

  return <>{children}</>;
};
