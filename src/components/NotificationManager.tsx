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
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) {
          // Fallback to audio element if Web Audio API is unsupported
          notificationSound.play().catch(err => {
            console.warn('Notification sound playback blocked:', err);
          });
          return;
        }

        const ctx = new AudioContextClass();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        const now = ctx.currentTime;

        // Note 1: E5 (659.25Hz), starts immediately, decays quickly
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, now);
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.12, now + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.35);

        // Note 2: A5 (880.00Hz), starts with a short delay (staggered), decays beautifully
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880.00, now + 0.08);
        gain2.gain.setValueAtTime(0, now);
        gain2.gain.setValueAtTime(0, now + 0.08);
        gain2.gain.linearRampToValueAtTime(0.12, now + 0.13);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.50);

        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.50);
      } catch (err) {
        console.warn('Offline Web Audio synthesis failed, trying backup audio stream:', err);
        notificationSound.play().catch(e => {
          console.warn('Notification backup sound playback blocked:', e);
        });
      }
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
