import React, { useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { db, messaging } from '../firebase';
import { collection, query, where, onSnapshot, limit, orderBy, arrayUnion, updateDoc, doc } from 'firebase/firestore';
import { getToken } from 'firebase/messaging';

export const NotificationManager: React.FC = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // 1. Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          console.log('SW registered:', reg);
          setupNotifications(reg);
        })
        .catch(err => console.error('SW registration failed:', err));
    }

    // 2. Request Permission
    const setupNotifications = async (registration?: ServiceWorkerRegistration) => {
      if (!('Notification' in window)) return;

      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      if (permission === 'granted' && messaging) {
        try {
          const vapidKey = (import.meta as any).env.VITE_FIREBASE_VAPID_KEY;
          const token = await getToken(messaging, { 
            vapidKey,
            serviceWorkerRegistration: registration 
          });
          if (token) {
            console.log('FCM Token:', token);
            // Save token to user profile
            await updateDoc(doc(db, 'users', user.uid), {
              fcmTokens: arrayUnion(token)
            });
          }
        } catch (error) {
          console.error('Error getting FCM token:', error);
        }
      }
    };

    // 3. Listen for new notifications and show browser popup
    // We only want to show notifications that arrive AFTER the component mounts
    const startTime = new Date().toISOString();
    const notificationSound = new Audio('https://www.soundjay.com/buttons/sounds/button-09.mp3');
    
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          // Only show if it's a new notification created after we started listening
          if (data.createdAt > startTime) {
            playNotificationSound();
            showBrowserNotification(data.title, data.message, data.link);
          }
        }
      });
    });

    const playNotificationSound = () => {
      notificationSound.play().catch(err => {
        console.warn('Notification sound playback blocked:', err);
      });
    };

    return () => unsubscribe();
  }, [user]);

  const showBrowserNotification = (title: string, message: string, link?: string) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      // Use Service Worker for better mobile support
      navigator.serviceWorker.ready.then(registration => {
        const options: any = {
          body: message,
          icon: '/favicon.svg', // Use existing favicon
          badge: '/favicon.svg',
          data: { url: link || window.location.origin },
          vibrate: [200, 100, 200]
        };
        registration.showNotification(title, options);
      });
    } else {
      // Fallback to standard Notification API
      new Notification(title, {
        body: message,
        icon: '/favicon.svg'
      });
    }
  };

  return null; // This component doesn't render anything
};
