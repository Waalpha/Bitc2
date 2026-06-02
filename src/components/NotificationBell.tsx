import React, { useEffect, useState } from 'react';
import { Bell, X, Check, Trash2, ExternalLink, Wallet, File as FileIcon, Image as ImageIcon, FileText, Download, MessageSquare, Calendar } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, where, orderBy, updateDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from './AuthProvider';
import { AppNotification } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

interface NotificationBellProps {
  addToast?: (text: string, type: 'success' | 'error' | 'warning') => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ addToast }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);
  const unreadCount = notifications.filter(n => !n.read).length;
  const mountTime = React.useRef(new Date().toISOString());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
      // Sort in memory to avoid composite index requirement
      docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(docs);

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          // Only show toast if created after component mount and it's unread
          if (data.createdAt > mountTime.current && !data.read && addToast) {
            addToast(`${data.title}: ${data.message}`, 'success');
          }
        }
      });
    }, (error) => {
      console.warn("Firestore Notification watch failed:", error.message);
      if (!navigator.onLine) {
        // Silently fail if offline, we'll wait for reconnection
        return;
      }
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    return unsubscribe;
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const markAllAsRead = async () => {
    try {
      const batch = writeBatch(db);
      notifications.filter(n => !n.read).forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notifications/batch');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notifications/${id}`);
    }
  };

  const getTypeColor = (type: AppNotification['type']) => {
    switch (type) {
      case 'exam': return 'bg-blue-100 text-blue-600';
      case 'grade': return 'bg-green-100 text-green-600';
      case 'deadline': return 'bg-red-100 text-red-600';
      case 'announcement': return 'bg-purple-100 text-purple-600';
      case 'fee': return 'bg-orange-100 text-orange-600';
      case 'chat': return 'bg-emerald-100 text-emerald-600';
      case 'attendance': return 'bg-rose-100 text-rose-600 border border-rose-200';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getTypeIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'fee': return <Wallet size={20} />;
      case 'chat': return <MessageSquare size={20} />;
      case 'attendance': return <Calendar size={20} />;
      default: return <Bell size={20} />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none"
      >
        <Bell size={24} />
        {!isOnline && (
          <span className="absolute -top-1 -right-1 block h-3 w-3 rounded-full bg-amber-500 border-2 border-white" title="Offline - using cached data" />
        )}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {selectedNotification && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSelectedNotification(null)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            >
              <div className={`p-6 ${getTypeColor(selectedNotification.type)} flex items-center justify-between shrink-0`}>
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-xl">
                    {getTypeIcon(selectedNotification.type)}
                  </div>
                  <h3 className="text-lg font-bold text-white">Notification Details</h3>
                </div>
                <button 
                  onClick={() => setSelectedNotification(null)}
                  className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 sm:p-8 flex-1 overflow-y-auto custom-scrollbar">
                <div className="mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 leading-tight">
                    {selectedNotification.title}
                  </h2>
                  <p className="text-[10px] font-bold text-gray-450 uppercase tracking-widest">
                    {formatDistanceToNow(new Date(selectedNotification.createdAt), { addSuffix: true })}
                  </p>
                </div>

                <div className="prose prose-sm max-w-none text-gray-600 mb-8 whitespace-pre-wrap leading-relaxed font-medium">
                  {selectedNotification.message}
                </div>

                {selectedNotification.attachmentUrl && (
                  <div className="mb-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Attachment</p>
                    <a 
                      href={selectedNotification.attachmentUrl.startsWith('http') ? `/api/download?url=${encodeURIComponent(selectedNotification.attachmentUrl)}&filename=${encodeURIComponent(selectedNotification.attachmentName || 'attachment')}` : selectedNotification.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50 transition-all group text-left"
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        selectedNotification.attachmentType === 'pdf' ? 'bg-red-100 text-red-600' : 
                        selectedNotification.attachmentType === 'word' ? 'bg-blue-600 text-white' : 
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {selectedNotification.attachmentType === 'pdf' ? <FileIcon size={24} /> : 
                         selectedNotification.attachmentType === 'word' ? <FileText size={24} /> : 
                         <ImageIcon size={24} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">
                          {selectedNotification.attachmentName || 'View Attachment'}
                        </p>
                        <p className="text-xs text-gray-500 uppercase">{selectedNotification.attachmentType}</p>
                      </div>
                      <Download size={20} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                    </a>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex gap-3 shrink-0">
                {selectedNotification.link && (
                  <Link 
                    to={selectedNotification.link} 
                    onClick={() => setSelectedNotification(null)}
                    className="flex-1 bg-blue-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200 text-xs uppercase tracking-widest"
                  >
                    View Page <ExternalLink size={14} />
                  </Link>
                )}
                <button 
                  onClick={() => setSelectedNotification(null)}
                  className={`flex-1 font-bold py-3.5 px-4 rounded-xl transition-all text-xs uppercase tracking-widest ${selectedNotification.link ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'}`}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl ring-1 ring-black ring-opacity-5 z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length > 0 ? (
                  <div className="divide-y divide-gray-50">
                    {notifications.map((n, idx) => (
                      <div 
                        key={`${n.id || 'notif'}_${idx}`} 
                        onClick={() => {
                          setSelectedNotification(n);
                          if (!n.read) markAsRead(n.id);
                        }}
                        className={`p-4 transition-colors hover:bg-gray-50 flex gap-3 cursor-pointer ${!n.read ? 'bg-blue-50/30' : ''}`}
                      >
                        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${getTypeColor(n.type)}`}>
                          {getTypeIcon(n.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <p className={`text-sm font-bold truncate ${!n.read ? 'text-gray-900' : 'text-gray-600'}`}>
                              {n.title}
                            </p>
                            <div className="flex gap-1 ml-2">
                              {!n.read && (
                                <button 
                                  onClick={() => markAsRead(n.id)}
                                  className="p-1 text-blue-400 hover:text-blue-600"
                                  title="Mark as read"
                                >
                                  <Check size={14} />
                                </button>
                              )}
                              <button 
                                onClick={() => deleteNotification(n.id)}
                                className="p-1 text-gray-300 hover:text-red-500"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2 mb-2">{n.message}</p>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-blue-600">Click to view full message</span>
                          </div>
                          {n.attachmentUrl && (
                            <a 
                              href={n.attachmentUrl.startsWith('http') ? `/api/download?url=${encodeURIComponent(n.attachmentUrl)}&filename=${encodeURIComponent(n.attachmentName || 'attachment')}` : n.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="mb-2 w-full flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors"
                            >
                              {n.attachmentType === 'pdf' ? <FileIcon size={14} className="text-red-500" /> : <ImageIcon size={14} className="text-blue-500" />}
                              <span className="text-[10px] font-medium text-gray-600 truncate">{n.attachmentName || 'Download'}</span>
                              <Download size={10} className="text-gray-400 ml-auto" />
                            </a>
                          )}
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-gray-400">
                              {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                            </span>
                            {n.link && (
                              <Link 
                                to={n.link} 
                                onClick={() => {
                                  markAsRead(n.id);
                                  setIsOpen(false);
                                }}
                                className="text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:underline"
                              >
                                View <ExternalLink size={10} />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <div className="bg-gray-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                      <Bell size={24} />
                    </div>
                    <p className="text-sm text-gray-500 font-medium">No notifications yet</p>
                    <p className="text-xs text-gray-400">We'll let you know when something important happens.</p>
                  </div>
                )}
              </div>

              {notifications.length > 0 && (
                <div className="p-3 border-t border-gray-100 bg-gray-50/50 text-center">
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                  >
                    Close
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
