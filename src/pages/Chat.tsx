import React, { useState, useEffect, useRef } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { useLocation } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  updateDoc, 
  doc, 
  Timestamp,
  getDocs,
  limit,
  setDoc
} from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { User, ChatRoom, ChatMessage, AppNotification } from '../types';
import { 
  Search, 
  Send, 
  MoreVertical, 
  Smile, 
  Check, 
  CheckCheck, 
  ChevronLeft,
  User as UserIcon,
  MessageSquare,
  Plus,
  Paperclip,
  Users,
  Image as ImageIcon,
  File as FileIcon,
  Download,
  Loader2,
  X,
  Camera,
  Video,
  Headphones,
  FileText,
  MapPin,
  Lock as LockIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { Toast, ToastMessage } from '../components/Toast';

import { uploadFile } from '../services/uploadService';

export const Chat: React.FC = () => {
  const { user, userData } = useAuth();
  const location = useLocation();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStats, setUploadStats] = useState({ current: 0, total: 0, currentFileName: '' });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [selectedPreviewFiles, setSelectedPreviewFiles] = useState<{file: File, preview: string, caption: string}[]>([]);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [classes, setClasses] = useState<any[]>([]); // New: fetch classes
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const addToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const notifyRecipients = async (room: ChatRoom, text: string) => {
    if (!user || !userData) return;

    let recipients: string[] = [];

    if (room.type === 'direct') {
      recipients = room.participants.filter(id => id !== user.uid);
    } else if (room.type === 'group' && room.classId) {
      // For class groups, notify all students in the class
      try {
        const studentsQuery = query(collection(db, 'users'), where('classIds', 'array-contains', room.classId));
        const studentsSnap = await getDocs(studentsQuery);
        recipients = studentsSnap.docs
          .map(doc => doc.id)
          .filter(id => id !== user.uid);

        // Also notify the teacher if not the sender
        const classDoc = classes.find(c => c.id === room.classId);
        if (classDoc?.teacherId && classDoc.teacherId !== user.uid && !recipients.includes(classDoc.teacherId)) {
          recipients.push(classDoc.teacherId);
        }
      } catch (error) {
        console.error('Failed to fetch class recipients for notification:', error);
      }
    }

    // Batch create notifications
    const notificationPromises = recipients.map(recipientId => {
      const notificationData: any = {
        userId: recipientId,
        title: room.type === 'group' ? `Group: ${room.name}` : `Message from ${userData.name}`,
        message: text,
        type: 'chat',
        read: false,
        createdAt: new Date().toISOString(),
        senderId: user.uid,
        link: `/whatsapp`
      };
      return addDoc(collection(db, 'notifications'), notificationData);
    });

    await Promise.all(notificationPromises);
  };

  useEffect(() => {
    if (!user || !userData) return;

    const fetchRoomsAndClasses = async () => {
      setLoading(true);
      try {
        const roomsRef = collection(db, 'chat_rooms');
        
        // 1. Fetch rooms where user is a participant
        const participantRoomsSnap = await getDocs(query(roomsRef, where('participants', 'array-contains', user.uid)));
        const participantRooms = participantRoomsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatRoom));

        // 2. Fetch rooms belonging to user's classes
        const classIds = userData?.classIds || [];
        let classRooms: ChatRoom[] = [];
        if (classIds.length > 0) {
          const classRoomsSnap = await getDocs(query(roomsRef, where('classId', 'in', classIds.slice(0, 10))));
          classRooms = classRoomsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatRoom));
        }

        // 3. For teachers, fetch rooms of classes they teach
        let teacherRooms: ChatRoom[] = [];
        if (userData?.role === 'teacher') {
          const teacherClassesSnap = await getDocs(query(collection(db, 'classes'), where('teacherId', '==', user.uid)));
          const tClassIds = teacherClassesSnap.docs.map(d => d.id);
          if (tClassIds.length > 0) {
            const tRoomsSnap = await getDocs(query(roomsRef, where('classId', 'in', tClassIds.slice(0, 10))));
            teacherRooms = tRoomsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatRoom));
          }
        }

        // Combine and set rooms
        const allRooms = [...participantRooms, ...classRooms, ...teacherRooms];
        const uniqueRoomsMap = new Map(allRooms.map(r => [r.id, r]));
        setRooms(Array.from(uniqueRoomsMap.values())
          .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()));

        // 4. Fetch classes
        const role = userData?.role?.toLowerCase();
        const classesQuery = role === 'admin' 
          ? query(collection(db, 'classes'))
          : role === 'teacher'
            ? query(collection(db, 'classes'), where('teacherId', '==', user.uid))
            : query(collection(db, 'classes'), where('id', 'in', (userData?.classIds && userData.classIds.length > 0) ? userData.classIds : ['dummy']));
        
        const classesSnap = await getDocs(classesQuery);
        setClasses(classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'chat_data');
      } finally {
        setLoading(false);
      }
    };

    fetchRoomsAndClasses();
  }, [user, userData]); // Added userData dependency

  useEffect(() => {
    if (classes.length > 0 && location.state?.openClassId) {
      const targetClass = classes.find(c => c.id === location.state.openClassId);
      if (targetClass && activeRoom?.classId !== targetClass.id) {
        startClassChat(targetClass);
      }
    }
  }, [classes, location.state]);

  useEffect(() => {
    if (!activeRoom) return;

    // Fetch messages for the active room
    const messagesQuery = query(
      collection(db, 'chat_messages'),
      where('roomId', '==', activeRoom.id)
    );

    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ChatMessage))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      setMessages(messagesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chat_messages');
    });

    return () => unsubscribeMessages();
  }, [activeRoom]);

  useEffect(() => {
    // Fetch all users for search (up to 500)
    const usersQuery = query(collection(db, 'users'), limit(500));
    getDocs(usersQuery).then(snapshot => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom || !user || isUploading) return;

    const messageText = newMessage.trim();
    if (!messageText) return;
    
    setNewMessage('');

    try {
      // Add message
      await addDoc(collection(db, 'chat_messages'), {
        roomId: activeRoom.id,
        senderId: user.uid,
        text: messageText,
        createdAt: new Date().toISOString(),
        readBy: [user.uid]
      });

      // Update room last message
      await updateDoc(doc(db, 'chat_rooms', activeRoom.id), {
        lastMessage: messageText,
        lastMessageAt: new Date().toISOString()
      });

      // Send notifications
      await notifyRecipients(activeRoom, messageText);
    } catch (error) {
      console.error('Send message failed:', error);
      addToast("Failed to send message. Please check your connection.", "error");
      handleFirestoreError(error, OperationType.CREATE, 'chat_messages');
    }
  };

  const handleFileClick = (type: 'all' | 'image' | 'document') => {
    setShowAttachmentMenu(false);
    if (type === 'image') imageInputRef.current?.click();
    else if (type === 'document') documentInputRef.current?.click();
    else fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const validFiles: {file: File, preview: string, caption: string}[] = [];

    Array.from(files).forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        addToast(`"${file.name}" is too large. Max size is 10MB.`, "error");
        return;
      }

      validFiles.push({
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
        caption: ''
      });
    });

    setSelectedPreviewFiles(prev => [...prev, ...validFiles]);
    if (e.target) e.target.value = '';
  };

  const removePreviewFile = (index: number) => {
    setSelectedPreviewFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].preview) URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const handleUploadSelectedFiles = async () => {
    if (selectedPreviewFiles.length === 0 || !activeRoom || !user) return;
    if (isUploading) return;

    setIsUploading(true);
    const filesToUpload = [...selectedPreviewFiles];
    setSelectedPreviewFiles([]);
    
    setUploadStats({ current: 0, total: filesToUpload.length, currentFileName: '' });

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const { file, caption } = filesToUpload[i];
        setUploadStats({ current: i + 1, total: filesToUpload.length, currentFileName: file.name });
        
        const uploadResult = await uploadFile(file, (progress) => {
          setUploadProgress(progress);
        });

        const attachmentType = file.type.startsWith('image/') ? 'image' : 
                               file.type === 'application/pdf' ? 'pdf' : 
                               file.type.startsWith('video/') ? 'video' :
                               (file.type.includes('msword') || file.type.includes('officedocument')) ? 'word' : 'file';

        // Save to Firestore
        await addDoc(collection(db, 'chat_messages'), {
          roomId: activeRoom.id,
          senderId: user.uid,
          text: caption || `Sent ${file.name}`,
          createdAt: new Date().toISOString(),
          attachmentUrl: uploadResult.url,
          attachmentType,
          attachmentName: file.name,
          attachmentSize: file.size,
          readBy: [user.uid]
        });

        await updateDoc(doc(db, 'chat_rooms', activeRoom.id), {
          lastMessage: caption || `Shared file: ${file.name}`,
          lastMessageAt: new Date().toISOString()
        });
      }
      
      await notifyRecipients(activeRoom, `Sent ${filesToUpload.length} attachment(s)`);
      addToast("Files sent successfully!", "success");
    } catch (error: any) {
      console.error('File send failed:', error);
      addToast("Failed to upload/send files.", "error");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const downloadFile = (url: string, filename: string) => {
    if (url.startsWith('data:')) {
      // Handle legacy base64 if still present
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        window.open(url, '_blank');
      }
      return;
    }

    // New way: use a proxy download to handle CORS and force download
    const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    window.location.href = downloadUrl;
  };

  const startClassChat = async (cls: any) => {
    if (!user) return;

    // Check if room with this classId already exists
    const existingRoom = rooms.find(r => r.classId === cls.id);

    if (existingRoom) {
      setActiveRoom(existingRoom);
      setShowUserSearch(false);
      return;
    }

    // Create new class group room
    try {
      const newRoomRef = doc(collection(db, 'chat_rooms'));
      const roomData: any = {
        participants: [user.uid], // We'll add all class students via broadcast logic or dynamic participation
        type: 'group',
        classId: cls.id,
        name: cls.name,
        lastMessageAt: new Date().toISOString(),
        lastMessage: `Broadcasting to ${cls.name}`
      };
      
      await setDoc(newRoomRef, roomData);
      setActiveRoom({ id: newRoomRef.id, ...roomData });
      setShowUserSearch(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chat_rooms');
    }
  };

  const startDirectChat = async (targetUser: User) => {
    if (!user) return;

    // Check if room already exists
    const existingRoom = rooms.find(r => 
      r.type === 'direct' && r.participants.includes(targetUser.uid)
    );

    if (existingRoom) {
      setActiveRoom(existingRoom);
      setShowUserSearch(false);
      return;
    }

    // Create new room
    try {
      const newRoomRef = doc(collection(db, 'chat_rooms'));
      const roomData: any = {
        participants: [user.uid, targetUser.uid],
        type: 'direct',
        lastMessageAt: new Date().toISOString(),
        lastMessage: 'Started a new conversation'
      };
      
      await setDoc(newRoomRef, roomData);
      setActiveRoom({ id: newRoomRef.id, ...roomData });
      setShowUserSearch(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chat_rooms');
    }
  };

  const getPartner = (room: ChatRoom) => {
    if (room.type === 'group') return { name: room.name || 'Group Chat', photoUrl: '', role: 'group', admissionNumber: '', course: '' } as Partial<User>;
    const partnerId = room.participants.find(id => id !== user?.uid);
    const partner = users.find(u => u.uid === partnerId);
    return (partner || { name: 'Unknown User', photoUrl: '', role: '', admissionNumber: '', course: '' }) as Partial<User>;
  };

  const filteredUsers = users.filter(u => 
    u.uid !== user?.uid && 
    (u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
     (u.admissionNumber?.toLowerCase().includes(searchTerm.toLowerCase())) ||
     (u.course?.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  const filteredClasses = classes.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const newPreviewFiles = files.map(file => ({
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
        caption: ''
      }));
      setSelectedPreviewFiles(prev => [...prev, ...newPreviewFiles]);
    }
  };

  return (
    <div 
      className="flex bg-[#F0F2F5] h-[calc(100vh-120px)] rounded-2xl overflow-hidden shadow-xl border border-gray-200"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Sidebar */}
      <div className={`w-full md:w-[400px] bg-white flex flex-col border-r border-gray-200 ${activeRoom ? 'hidden md:flex' : 'flex'}`}>
        {/* Sidebar Header */}
        <div className="h-16 bg-[#F0F2F5] px-4 flex items-center justify-between">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
            {userData?.name.charAt(0)}
          </div>
          <div className="flex gap-4 text-[#54656F]">
            <button 
              onClick={() => setShowUserSearch(true)}
              className="p-2 hover:bg-black/5 rounded-full transition-colors"
            >
              <MessageSquare size={20} />
            </button>
            <button className="p-2 hover:bg-black/5 rounded-full transition-colors">
              <MoreVertical size={20} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-2 bg-white border-b border-gray-100 flex items-center">
          <div className="relative flex-1 bg-[#F5F6F6] rounded-lg flex items-center px-3">
            <Search className="text-[#54656F]" size={16} />
            <input 
              type="text" 
              placeholder="Search or start new chat" 
              className="w-full bg-transparent py-2 pl-4 outline-none text-[13px] text-gray-900 placeholder:text-[#8696a0]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
          {/* Class Groups Section */}
          {classes.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-3 text-[#008069] text-[12px] font-bold uppercase tracking-[0.1em] flex items-center gap-4">
                <Users size={18} /> CLASS GROUPS
              </div>
              {classes.map(cls => {
                const room = rooms.find(r => r.classId === cls.id);
                const isActive = activeRoom?.classId === cls.id;
                return (
                  <div 
                    key={cls.id}
                    onClick={() => startClassChat(cls)}
                    className={`flex items-center px-4 py-3 cursor-pointer transition-colors relative ${isActive ? 'bg-[#F0F2F5]' : 'hover:bg-[#F5F6F6]'}`}
                  >
                    <div className="w-[48px] h-[48px] rounded-full bg-[#D9FDD3] flex items-center justify-center text-[#06CF9C] shrink-0 border border-emerald-100 shadow-sm">
                      <Users size={24} />
                    </div>
                    <div className="ml-4 flex-1 border-b border-gray-100 py-3 min-w-0 pr-2">
                      <div className="flex justify-between items-center mb-0.5">
                        <h3 className="font-bold text-[14px] text-gray-900 truncate uppercase tracking-tight leading-tight">{cls.name}</h3>
                        {room && (
                          <span className="text-[11px] text-[#667781] font-medium leading-none">
                            {format(new Date(room.lastMessageAt), 'p')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center text-[13px] text-[#667781] truncate">
                        <span className="truncate">{room?.lastMessage || 'Send a message to the class'}</span>
                      </div>
                    </div>
                    {isActive && <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#00A884]" />}
                  </div>
                );
              })}
            </div>
          )}

          <div className="px-4 py-3 text-[#008069] text-[12px] font-bold uppercase tracking-[0.1em] flex items-center gap-4 border-t border-gray-50 bg-gray-50/50">
            <MessageSquare size={18} /> PERSONAL CHATS
          </div>
          {rooms.filter(r => !r.classId).map(room => {
            const partner = getPartner(room);
            const isActive = activeRoom?.id === room.id;
            return (
              <div 
                key={room.id}
                onClick={() => setActiveRoom(room)}
                className={`flex items-center px-4 py-3 cursor-pointer transition-colors ${isActive ? 'bg-[#F0F2F5]' : 'hover:bg-[#F5F6F6]'}`}
              >
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 overflow-hidden shrink-0">
                  {partner.photoUrl ? (
                    <img src={partner.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon size={24} />
                  )}
                </div>
                <div className="ml-4 flex-1 border-b border-gray-100 pb-3 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <h3 className="font-semibold text-gray-900 truncate">{partner.name}</h3>
                      {partner.role === 'student' && partner.admissionNumber && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-1 py-0 rounded shrink-0">
                          {partner.admissionNumber}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {format(new Date(room.lastMessageAt), 'p')}
                    </span>
                  </div>
                  <div className="flex items-center text-sm text-gray-500 truncate">
                    <CheckCheck size={16} className="mr-1 text-blue-500" />
                    <span className="truncate">{room.lastMessage}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col bg-[#E5DDD5] relative ${!activeRoom ? 'hidden md:flex' : 'flex'}`}>
        {activeRoom ? (
          <>
            {/* Chat Header */}
            <div className="h-16 bg-[#F0F2F5] px-4 flex items-center border-b border-gray-200 sticky top-0 z-10 shadow-sm">
              <button 
                onClick={() => setActiveRoom(null)}
                className="md:hidden mr-2 p-1 hover:bg-black/5 rounded-full"
              >
                <ChevronLeft size={24} className="text-[#54656F]" />
              </button>
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 overflow-hidden">
                {getPartner(activeRoom).photoUrl ? (
                  <img src={getPartner(activeRoom).photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={20} />
                )}
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 truncate">{getPartner(activeRoom).name}</h3>
                  {getPartner(activeRoom).role === 'student' && getPartner(activeRoom).admissionNumber && (
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100">
                      ID: {getPartner(activeRoom).admissionNumber}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#667781]">
                  {getPartner(activeRoom).role === 'student' ? (getPartner(activeRoom).course || 'Student') : 'Teacher'} • online
                </p>
              </div>
              <div className="flex gap-4 text-[#54656F]">
                <Search size={20} />
                <MoreVertical size={20} />
              </div>
            </div>

            {/* Messages Area - with WhatsApp Background Pattern */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-2 bg-[url('https://wallpapercave.com/wp/wp4410714.jpg')] bg-repeat bg-fixed opacity-90">
              <div className="flex flex-col space-y-1">
                {messages.map((msg, index) => {
                  const isMine = msg.senderId === user?.uid;
                  return (
                    <div 
                      key={`${msg.id || 'msg'}_${index}`}
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}
                    >
                      <div 
                        className={`
                          max-w-[75%] px-3 py-1.5 rounded-lg shadow-sm relative
                          ${isMine ? 'bg-[#DCF8C6] text-gray-900 rounded-tr-none' : 'bg-white text-gray-900 rounded-tl-none'}
                        `}
                      >
                        {msg.attachmentUrl && (
                          <div className="mb-2 mt-1">
                            {msg.attachmentType === 'image' ? (
                              <a 
                                href={msg.attachmentUrl} 
                                target="_blank" 
                                rel="noreferrer"
                                className="block rounded-lg overflow-hidden cursor-pointer bg-black/5 min-w-[200px]"
                              >
                                <img 
                                  src={msg.attachmentUrl} 
                                  alt="attachment" 
                                  className="max-w-full max-h-[300px] w-full object-cover transition-transform hover:scale-105"
                                />
                              </a>
                            ) : msg.attachmentType === 'video' ? (
                              <div className="rounded-lg overflow-hidden bg-black/5 min-w-[200px]">
                                <video 
                                  src={msg.attachmentUrl} 
                                  controls 
                                  className="max-w-full max-h-[300px] w-full"
                                />
                              </div>
                            ) : (
                              <button 
                                onClick={() => downloadFile(msg.attachmentUrl!, msg.attachmentName || 'attachment')}
                                className="flex items-center gap-3 p-3 bg-black/5 rounded-xl border border-black/10 cursor-pointer hover:bg-black/10 transition-all text-left w-full group/file"
                              >
                                <div className={`p-2.5 rounded-xl shadow-sm ${
                                  msg.attachmentType === 'pdf' ? 'bg-red-100 text-red-600' :
                                  msg.attachmentType === 'word' ? 'bg-blue-100 text-blue-600' :
                                  'bg-emerald-100 text-emerald-600'
                                }`}>
                                  {msg.attachmentType === 'pdf' ? <FileText size={28} /> : 
                                   msg.attachmentType === 'word' ? <FileText size={28} /> : 
                                   <FileIcon size={28} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[12px] font-bold truncate text-gray-900 leading-tight">
                                    {msg.attachmentName || 'Document'}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest leading-none">
                                      {msg.attachmentType || 'FILE'}
                                    </p>
                                    {msg.attachmentSize && (
                                      <span className="text-[9px] text-gray-400 font-medium">
                                        • {(msg.attachmentSize / 1024).toFixed(1)} KB
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="p-2 bg-white/50 rounded-full group-hover/file:bg-[#00A884] group-hover/file:text-white transition-all">
                                  <Download size={16} />
                                </div>
                              </button>
                            )}
                          </div>
                        )}
                        <p className="text-sm leading-tight break-words pr-12">{msg.text}</p>
                        <div className="absolute bottom-1 right-1.5 flex items-center gap-0.5">
                          <span className="text-xs text-gray-500">
                            {format(new Date(msg.createdAt), 'p')}
                          </span>
                          {isMine && <CheckCheck size={14} className="text-blue-500" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <div className="bg-[#F0F2F5] px-4 py-2 flex flex-col sticky bottom-0 z-20">
              {isUploading && (
                <div className="flex items-center gap-3 bg-white p-3 rounded-t-xl border-t border-x border-gray-200">
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <Loader2 className="animate-spin text-emerald-600" size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        className="h-full bg-emerald-500"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1 uppercase font-bold tracking-wider">
                      {uploadProgress < 100 
                        ? `File ${uploadStats.current}/${uploadStats.total}: ${uploadStats.currentFileName.slice(0, 15)}${uploadStats.currentFileName.length > 15 ? '...' : ''} (${Math.round(uploadProgress)}%)` 
                        : 'Finalizing...'}
                    </p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-4 relative">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  multiple
                />
                <input 
                  type="file" 
                  accept="image/*,video/*"
                  ref={imageInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  multiple
                />
                <input 
                  type="file" 
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                  ref={documentInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  multiple
                />

                <AnimatePresence>
                  {showAttachmentMenu && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 20, scale: 0.8 }}
                      className="absolute bottom-16 left-0 bg-white rounded-2xl shadow-2xl p-4 grid grid-cols-3 gap-6 z-50 border border-gray-100"
                    >
                      <button onClick={() => handleFileClick('document')} className="flex flex-col items-center gap-2 group">
                        <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                          <FileText size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Document</span>
                      </button>
                      <button onClick={() => handleFileClick('image')} className="flex flex-col items-center gap-2 group">
                        <div className="w-12 h-12 rounded-full bg-pink-500 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                          <ImageIcon size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Gallery</span>
                      </button>
                      <button onClick={() => handleFileClick('image')} className="flex flex-col items-center gap-2 group">
                        <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                          <Camera size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Camera</span>
                      </button>
                      <button onClick={() => handleFileClick('all')} className="flex flex-col items-center gap-2 group">
                        <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                          <Headphones size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Audio</span>
                      </button>
                      <button onClick={() => {}} className="flex flex-col items-center gap-2 group">
                        <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                          <MapPin size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Location</span>
                      </button>
                      <button onClick={() => {}} className="flex flex-col items-center gap-2 group">
                        <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                          <UserIcon size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Contact</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-4 text-[#54656F]">
                  <Smile size={24} className="cursor-pointer hover:text-gray-900" />
                  <button 
                    type="button" 
                    onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                    disabled={isUploading}
                    className={`hover:text-gray-900 disabled:opacity-50 transition-transform ${showAttachmentMenu ? 'rotate-45' : ''}`}
                  >
                    <Paperclip size={24} />
                  </button>
                </div>
                <form onSubmit={handleSendMessage} className="flex-1">
                  <input 
                    type="text" 
                    placeholder="Type a message" 
                    className="w-full bg-white py-2.5 px-4 rounded-xl outline-none text-sm text-gray-900 shadow-sm border border-transparent focus:border-emerald-200 transition-colors"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={isUploading}
                  />
                </form>
                <button 
                  onClick={handleSendMessage}
                  disabled={(!newMessage.trim() && !isUploading) || isUploading}
                  className={`p-2 rounded-full transition-all duration-200 ${newMessage.trim() ? 'bg-[#00A884] text-white scale-110 shadow-lg shadow-emerald-200' : 'text-[#54656F] hover:bg-black/5'}`}
                >
                  <Send size={20} />
                </button>
              </div>
            </div>

            {/* Attachment Preview Overlay */}
            <AnimatePresence>
              {selectedPreviewFiles.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col"
                >
                  <div className="h-16 px-6 flex items-center justify-between">
                    <button 
                      onClick={() => setSelectedPreviewFiles([])}
                      className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                      <X size={24} />
                    </button>
                    <div className="text-white font-bold text-sm tracking-widest uppercase">
                      Preview {selectedPreviewFiles.length} {selectedPreviewFiles.length === 1 ? 'file' : 'files'}
                    </div>
                    <div className="w-10 h-10" />
                  </div>

                  <div className="flex-1 overflow-x-auto flex items-center gap-8 px-12 py-8 scrollbar-hide">
                    {selectedPreviewFiles.map((preview, idx) => (
                      <div key={idx} className="relative group shrink-0 min-w-[300px] max-w-[500px]">
                        <div className="bg-white/5 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
                          {preview.preview ? (
                            <img src={preview.preview} alt="" className="w-full h-auto max-h-[60vh] object-contain bg-black/20" />
                          ) : (
                            <div className="h-[200px] flex flex-col items-center justify-center p-8 text-white gap-4">
                              <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center">
                                <FileText size={40} />
                              </div>
                              <p className="text-sm font-bold truncate w-full text-center">{preview.file.name}</p>
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">{(preview.file.size / (1024 * 1024)).toFixed(2)} MB</p>
                            </div>
                          )}
                          <div className="p-4 bg-white/10 border-t border-white/10">
                            <input 
                              type="text"
                              placeholder="Add a caption..."
                              className="w-full bg-transparent text-white outline-none text-sm font-medium border-b border-white/20 focus:border-royal-blue transition-colors py-2"
                              value={preview.caption}
                              onChange={(e) => {
                                const newFiles = [...selectedPreviewFiles];
                                newFiles[idx].caption = e.target.value;
                                setSelectedPreviewFiles(newFiles);
                              }}
                            />
                          </div>
                        </div>
                        <button 
                          onClick={() => removePreviewFile(idx)}
                          className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-10"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}

                    <button 
                      onClick={() => handleFileClick('all')}
                      className="shrink-0 w-20 h-20 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center text-white/50 hover:text-white hover:border-white transition-all hover:bg-white/5"
                    >
                      <Plus size={32} />
                    </button>
                  </div>

                  <div className="h-24 px-12 flex items-center justify-end bg-black/20">
                    <button 
                      onClick={handleUploadSelectedFiles}
                      className="bg-[#00A884] text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#008f70] transition-colors shadow-2xl flex items-center gap-3"
                    >
                      Send Message <Send size={18} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#F0F2F5] border-b-[6px] border-[#00A884] overflow-hidden relative">
            <div className="bg-white/20 absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://wallpapercave.com/wp/wp4410714.jpg')] bg-repeat" />
            
            <div className="w-[450px] text-center space-y-6 relative z-10 px-6">
              <div className="relative mb-12">
                <div className="w-28 h-28 rounded-full bg-emerald-50 flex items-center justify-center mx-auto text-[#00A884]">
                  <MessageSquare size={48} className="stroke-[1.5]" />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-full shadow-lg text-emerald-500">
                  <CheckCheck size={20} />
                </div>
              </div>
              
              <div className="space-y-3">
                <h1 className="text-[32px] font-light text-[#41525d] tracking-tight">WhatsApp School</h1>
                <p className="text-[14px] text-[#667781] leading-relaxed max-w-[320px] mx-auto">
                  Send and receive messages with teachers and classmates. 
                  Your community is securely connected in real-time.
                </p>
              </div>
              
                  <div className="pt-12 flex flex-col items-center gap-4 text-[#8696a0] text-[13px]">
                <div className="flex items-center gap-2">
                  <LockIcon size={14} />
                  <span>End-to-end encrypted</span>
                </div>
                <button 
                  onClick={() => setShowUserSearch(true)}
                  className="mt-4 flex items-center gap-2 text-[#00A884] hover:underline font-medium"
                >
                  <Plus size={16} />
                  <span>Start a new conversation</span>
                </button>
              </div>
            </div>
            
            <div className="absolute bottom-10 text-[11px] text-[#8696a0] font-medium uppercase tracking-[0.2em] opacity-40">
              Smart Learning Portal • BITC
            </div>
          </div>
        )}
      </div>

      {/* User Search Overlay */}
      <AnimatePresence>
        {showUserSearch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowUserSearch(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden"
            >
              <div className="p-4 bg-[#008069] text-white flex items-center gap-4">
                <button onClick={() => setShowUserSearch(false)}>
                  <ChevronLeft size={24} />
                </button>
                <h2 className="font-bold">New Chat</h2>
              </div>
              
              <div className="p-2 border-b border-gray-100">
                <div className="bg-[#F0F2F5] rounded-lg flex items-center px-4">
                  <Search className="text-[#54656F]" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search users..." 
                    className="w-full bg-transparent py-2 pl-4 outline-none text-sm text-gray-900"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {filteredClasses.length > 0 && (
                  <div className="py-2">
                    <div className="px-4 py-2 text-[#008069] text-xs font-bold uppercase tracking-wider">Class Groups</div>
                    {filteredClasses.map(cls => (
                      <div 
                        key={cls.id}
                        onClick={() => startClassChat(cls)}
                        className="flex items-center px-4 py-3 hover:bg-[#F5F6F6] cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                          <Users size={24} />
                        </div>
                        <div className="ml-4 flex-1 border-b border-gray-100 pb-3">
                          <p className="font-bold text-gray-900 uppercase">{cls.name}</p>
                          <p className="text-xs text-gray-500">Message the entire class</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-4 text-[#008069] text-xs font-bold uppercase tracking-wider border-t border-gray-50">Contacts</div>
                {filteredUsers.map(user => (
                  <div 
                    key={user.uid}
                    onClick={() => startDirectChat(user)}
                    className="flex items-center px-4 py-3 hover:bg-[#F5F6F6] cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                      {user.name.charAt(0)}
                    </div>
                    <div className="ml-4 flex-1 border-b border-gray-100 pb-3">
                      <div className="flex justify-between items-center">
                        <p className="font-bold text-gray-900">{user.name}</p>
                        {user.role === 'student' && user.admissionNumber && (
                          <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">
                            {user.admissionNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 capitalize">
                        {user.role} {user.course ? `• ${user.course}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
                {filteredUsers.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    No users found
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Toast messages={toasts} onRemove={removeToast} />
    </div>
  );
};
