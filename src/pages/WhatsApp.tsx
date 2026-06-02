import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  getDocs,
  limit,
  setDoc
} from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { User, ChatRoom, ChatMessage } from '../types';
import { 
  Search, 
  Send, 
  MoreVertical, 
  Smile, 
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
  Headphones,
  FileText,
  MapPin,
  Lock as LockIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { Toast, ToastMessage } from '../components/Toast';

import { uploadFile } from '../services/uploadService';

export const WhatsApp: React.FC = () => {
  const { user, userData } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
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
  const [selectedBroadcastClasses, setSelectedBroadcastClasses] = useState<string[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
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
      try {
        const studentsQuery = query(collection(db, 'users'), where('classIds', 'array-contains', room.classId));
        const studentsSnap = await getDocs(studentsQuery);
        recipients = studentsSnap.docs
          .map(doc => doc.id)
          .filter(id => id !== user.uid);

        const classDoc = classes.find(c => c.id === room.classId);
        if (classDoc?.teacherId && classDoc.teacherId !== user.uid && !recipients.includes(classDoc.teacherId)) {
          recipients.push(classDoc.teacherId);
        }
      } catch (error) {
        console.error('Failed to fetch class recipients for notification:', error);
      }
    }

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
      try {
        const roomsRef = collection(db, 'chat_rooms');
        let allRooms: ChatRoom[] = [];

        // Fetch participant rooms
        const participantRoomsQuery = query(roomsRef, where('participants', 'array-contains', user.uid));
        const pSnap = await getDocs(participantRoomsQuery);
        allRooms = pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatRoom));

        // Fetch class rooms
        const classIds = userData?.classIds || [];
        if (classIds.length > 0) {
          const classRoomsQuery = query(roomsRef, where('classId', 'in', classIds.slice(0, 10)));
          const cSnap = await getDocs(classRoomsQuery);
          cSnap.docs.forEach(doc => {
            if (!allRooms.find(r => r.id === doc.id)) {
              allRooms.push({ id: doc.id, ...doc.data() } as ChatRoom);
            }
          });
        }

        // Teacher classes
        if (userData?.role === 'teacher') {
          const teacherClassesQuery = query(collection(db, 'classes'), where('teacherId', '==', user.uid));
          const tSnap = await getDocs(teacherClassesQuery);
          const tClassIds = tSnap.docs.map(d => d.id);
          if (tClassIds.length > 0) {
            const tRoomsQuery = query(roomsRef, where('classId', 'in', tClassIds.slice(0, 10)));
            const trSnap = await getDocs(tRoomsQuery);
            trSnap.docs.forEach(doc => {
              if (!allRooms.find(r => r.id === doc.id)) {
                allRooms.push({ id: doc.id, ...doc.data() } as ChatRoom);
              }
            });
          }
        }

        setRooms(allRooms.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()));
        setLoading(false);

        // Fetch classes
        const role = userData?.role?.toLowerCase();
        const classesQuery = (role === 'admin' || role === 'teacher')
          ? query(collection(db, 'classes'))
          : query(collection(db, 'classes'), where('id', 'in', (userData?.classIds && userData.classIds.length > 0) ? userData.classIds : ['dummy']));
        
        const clsSnap = await getDocs(classesQuery);
        setClasses(clsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'whatsapp-init');
        setLoading(false);
      }
    };

    fetchRoomsAndClasses();
  }, [user, userData]);

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
      await addDoc(collection(db, 'chat_messages'), {
        roomId: activeRoom.id,
        senderId: user.uid,
        text: messageText,
        createdAt: new Date().toISOString(),
        readBy: [user.uid]
      });

      await updateDoc(doc(db, 'chat_rooms', activeRoom.id), {
        lastMessage: messageText,
        lastMessageAt: new Date().toISOString()
      });

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

    // Determine target rooms
    const targetRoomIds = (userData?.role === 'teacher' && selectedBroadcastClasses.length > 0)
      ? await Promise.all(selectedBroadcastClasses.map(async (classId) => {
          const cls = classes.find(c => c.id === classId);
          if (!cls) return null;
          const existingRoom = rooms.find(r => r.classId === classId);
          if (existingRoom) return existingRoom.id;
          
          // Create room if missing
          const newRoomRef = doc(collection(db, 'chat_rooms'));
          await setDoc(newRoomRef, {
            participants: [user.uid],
            type: 'group',
            classId: cls.id,
            name: cls.name,
            lastMessageAt: new Date().toISOString(),
            lastMessage: `WhatsApp Group started for ${cls.name}`
          });
          return newRoomRef.id;
        })).then(ids => ids.filter(Boolean) as string[])
      : [activeRoom.id];

    try {
      // 1. Upload all files first to the server/Cloudinary
      const uploadedFileDatas = [];
      for (let i = 0; i < filesToUpload.length; i++) {
        const { file, caption } = filesToUpload[i];
        setUploadStats({ current: i + 1, total: filesToUpload.length, currentFileName: file.name });
        
        const uploadResult = await uploadFile(file);
        
        const attachmentType = file.type.startsWith('image/') ? 'image' : 
                               file.type === 'application/pdf' ? 'pdf' : 
                               file.type.startsWith('video/') ? 'video' :
                               (file.type.includes('msword') || file.type.includes('officedocument')) ? 'word' : 'file';

        uploadedFileDatas.push({
          url: uploadResult.url,
          name: file.name,
          type: attachmentType,
          size: file.size,
          caption: caption
        });
      }

      // 2. Add messages to documents
      for (const roomId of targetRoomIds) {
        const room = rooms.find(r => r.id === roomId) || activeRoom;
        
        for (const fileData of uploadedFileDatas) {
          await addDoc(collection(db, 'chat_messages'), {
            roomId: roomId,
            senderId: user.uid,
            text: fileData.caption || `Sent ${fileData.name}`,
            createdAt: new Date().toISOString(),
            attachmentUrl: fileData.url,
            attachmentType: fileData.type,
            attachmentName: fileData.name,
            attachmentSize: fileData.size,
            readBy: [user.uid]
          });

          await updateDoc(doc(db, 'chat_rooms', roomId), {
            lastMessage: fileData.caption || `Shared file: ${fileData.name}`,
            lastMessageAt: new Date().toISOString()
          });
        }
        
        if (room) {
          await notifyRecipients(room, `Sent ${uploadedFileDatas.length} attachment(s)`);
        }
      }
      
      addToast(`Files sent successfully to ${targetRoomIds.length} group(s)!`, "success");
      setSelectedBroadcastClasses([]);
    } catch (error: any) {
      console.error('File upload/send failed:', error);
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
    const existingRoom = rooms.find(r => r.classId === cls.id);
    if (existingRoom) {
      setActiveRoom(existingRoom);
      setShowUserSearch(false);
      return;
    }

    try {
      const newRoomRef = doc(collection(db, 'chat_rooms'));
      const roomData: any = {
        participants: [user.uid],
        type: 'group',
        classId: cls.id,
        name: cls.name,
        lastMessageAt: new Date().toISOString(),
        lastMessage: `WhatsApp Group started for ${cls.name}`
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
    const existingRoom = rooms.find(r => 
      r.type === 'direct' && r.participants.includes(targetUser.uid)
    );
    if (existingRoom) {
      setActiveRoom(existingRoom);
      setShowUserSearch(false);
      return;
    }

    try {
      const newRoomRef = doc(collection(db, 'chat_rooms'));
      const roomData: any = {
        participants: [user.uid, targetUser.uid],
        type: 'direct',
        lastMessageAt: new Date().toISOString(),
        lastMessage: 'WhatsApp Direct Chat'
      };
      
      await setDoc(newRoomRef, roomData);
      setActiveRoom({ id: newRoomRef.id, ...roomData });
      setShowUserSearch(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chat_rooms');
    }
  };

  const getPartner = (room: ChatRoom) => {
    if (room.type === 'group') return { name: room.name || 'Group Chat', photoUrl: '', role: 'group' } as Partial<User>;
    const partnerId = room.participants.find(id => id !== user?.uid);
    const partner = users.find(u => u.uid === partnerId);
    return (partner || { name: 'Unknown User', photoUrl: '', role: '' }) as Partial<User>;
  };

  const filteredUsers = users.filter(u => 
    u.uid !== user?.uid && 
    (u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     u.role.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredClasses = classes.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex bg-[#F0F2F5] h-[calc(100vh-120px)] rounded-2xl overflow-hidden shadow-xl border border-gray-200">
      <div className={`w-full md:w-[400px] bg-white flex flex-col border-r border-gray-200 ${activeRoom ? 'hidden md:flex' : 'flex'}`}>
        <div className="h-16 bg-[#F0F2F5] px-4 flex items-center justify-between">
          <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold">
            {userData?.name.charAt(0)}
          </div>
          <div className="flex gap-4 text-[#54656F]">
            {userData?.role !== 'teacher' && (
              <button onClick={() => setShowUserSearch(true)} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                <Plus size={20} />
              </button>
            )}
            <button className="p-2 hover:bg-black/5 rounded-full transition-colors">
              <MoreVertical size={20} />
            </button>
          </div>
        </div>

        <div className="p-2 bg-white border-b border-gray-100 flex items-center">
          <div className="relative flex-1 bg-[#F5F6F6] rounded-lg flex items-center px-3">
            <Search className="text-[#54656F]" size={16} />
            <input 
              type="text" 
              placeholder="Search or start new group chat" 
              className="w-full bg-transparent py-2 pl-4 outline-none text-[13px] text-gray-900 placeholder:text-[#8696a0]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
          {classes.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-3 text-[#008069] text-[12px] font-bold uppercase tracking-[0.1em] flex items-center gap-4">
                <Users size={18} /> WHATSAPP GROUPS
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
                        <span className="truncate">{room?.lastMessage || 'Message students in this group'}</span>
                      </div>
                    </div>
                    {isActive && <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#00A884]" />}
                  </div>
                );
              })}
            </div>
          )}

          {userData?.role !== 'teacher' && (
            <>
              <div className="px-4 py-3 text-[#008069] text-[12px] font-bold uppercase tracking-[0.1em] flex items-center gap-4 border-t border-gray-50 bg-gray-50/50">
                <MessageSquare size={18} /> DIRECT MESSAGES
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
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 overflow-hidden shrink-0">
                      {partner.photoUrl ? (
                        <img src={partner.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon size={24} />
                      )}
                    </div>
                    <div className="ml-4 flex-1 border-b border-gray-100 pb-3 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{partner.name}</h3>
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
            </>
          )}
        </div>
      </div>

      <div className={`flex-1 flex flex-col bg-[#E5DDD5] relative ${!activeRoom ? 'hidden md:flex' : 'flex'}`}>
        {activeRoom ? (
          <>
            <div className="h-16 bg-[#F0F2F5] px-4 flex items-center border-b border-gray-200 sticky top-0 z-10 shadow-sm">
              <button onClick={() => setActiveRoom(null)} className="md:hidden mr-2 p-1 hover:bg-black/5 rounded-full">
                <ChevronLeft size={24} className="text-[#54656F]" />
              </button>
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 overflow-hidden">
                {activeRoom.type === 'group' ? <Users size={20} /> : <UserIcon size={20} />}
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 truncate">{getPartner(activeRoom).name}</h3>
                <p className="text-xs text-[#667781]">WhatsApp Group • active</p>
              </div>
              <div className="flex gap-4 text-[#54656F]">
                <Search size={20} />
                <MoreVertical size={20} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-2 bg-[url('https://wallpapercave.com/wp/wp4410714.jpg')] bg-fixed relative">
              {/* Stronger Background Overlay for better readability */}
              <div className="absolute inset-0 bg-white/60 pointer-events-none z-0" />
              
              <div className="flex flex-col space-y-1 relative z-10">
                {messages.map((msg, idx) => {
                  const isMine = msg.senderId === user?.uid;
                  return (
                    <div key={`${msg.id || 'msg'}_${idx}`} className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}>
                      <div className={`max-w-[85%] md:max-w-[75%] px-3 py-2 rounded-xl shadow-md relative ${isMine ? 'bg-[#D9FDD3] text-[#111B21]' : 'bg-white text-[#111B21]'} border border-black/5`}>
                        {msg.attachmentUrl && (
                          <div className="mb-2 mt-1">
                            {msg.attachmentType === 'image' ? (
                              <img src={msg.attachmentUrl} alt="" className="rounded-lg max-h-[300px] w-full object-cover shadow-sm border border-black/5" />
                            ) : (
                              <button onClick={() => downloadFile(msg.attachmentUrl!, msg.attachmentName || 'file')} className="flex items-center gap-3 p-3 bg-black/5 rounded-xl border border-black/10 w-full text-left hover:bg-black/10 transition-colors">
                                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                                  <FileText size={20} />
                                </div>
                                <div className="flex-1 truncate">
                                  <p className="text-xs font-bold truncate text-[#111B21]">{msg.attachmentName || 'WhatsApp Attachment'}</p>
                                  <p className="text-[10px] uppercase font-bold opacity-70 text-slate-600">{msg.attachmentType}</p>
                                </div>
                                <Download size={16} className="text-slate-500" />
                              </button>
                            )}
                          </div>
                        )}
                        <p className="text-sm leading-tight break-words pr-12 text-[#111B21] font-medium">{msg.text}</p>
                        <div className="absolute bottom-1 right-1.5 flex items-center gap-0.5">
                          <span className="text-[10px] text-gray-600 font-bold">{format(new Date(msg.createdAt), 'p')}</span>
                          {isMine && <CheckCheck size={12} className="text-[#34B7F1]" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="bg-[#F0F2F5] px-4 py-2 flex flex-col sticky bottom-0 z-20">
              {isUploading && (
                <div className="flex items-center gap-3 bg-white p-2 rounded-t-xl border-x border-t border-gray-200">
                  <Loader2 className="animate-spin text-emerald-600" size={16} />
                  <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-4">
                <AnimatePresence>
                  {showAttachmentMenu && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute bottom-16 left-0 bg-white rounded-2xl shadow-2xl p-4 grid grid-cols-3 gap-6 z-50">
                      <button onClick={() => handleFileClick('document')} className="flex flex-col items-center gap-1">
                        <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white"><FileText size={20} /></div>
                        <span className="text-[10px] font-bold">Doc</span>
                      </button>
                      <button onClick={() => handleFileClick('image')} className="flex flex-col items-center gap-1">
                        <div className="w-12 h-12 rounded-full bg-pink-500 flex items-center justify-center text-white"><ImageIcon size={20} /></div>
                        <span className="text-[10px] font-bold">Gallery</span>
                      </button>
                      <button onClick={() => handleFileClick('all')} className="flex flex-col items-center gap-1">
                        <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-white"><Headphones size={20} /></div>
                        <span className="text-[10px] font-bold">Audio</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="flex gap-3 text-[#54656F]">
                  <Smile size={24} className="cursor-pointer" />
                  <Paperclip size={24} className="cursor-pointer" onClick={() => setShowAttachmentMenu(!showAttachmentMenu)} />
                </div>
                <form onSubmit={handleSendMessage} className="flex-1">
                  <input 
                    type="text" 
                    placeholder="Type in WhatsApp Group..." 
                    className="w-full bg-white py-2 px-4 rounded-xl outline-none text-sm text-gray-900 border border-transparent focus:border-emerald-200"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                  />
                </form>
                <button onClick={handleSendMessage} className={`p-2 rounded-full ${newMessage.trim() ? 'bg-[#00A884] text-white' : 'text-[#54656F]'}`}><Send size={20} /></button>
              </div>
            </div>

            <AnimatePresence>
              {selectedPreviewFiles.length > 0 && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col p-6 items-center justify-center">
                  <div className="max-w-md w-full bg-white rounded-3xl p-6 overflow-hidden max-h-[90vh] flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-gray-900">WhatsApp Group Preview</h3>
                      <button onClick={() => { setSelectedPreviewFiles([]); setSelectedBroadcastClasses([]); }} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={20} className="text-gray-500" />
                      </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
                      {selectedPreviewFiles[0].preview ? (
                        <img src={selectedPreviewFiles[0].preview} alt="" className="w-full h-48 object-cover rounded-xl shadow-sm border border-gray-100" />
                      ) : (
                        <div className="h-48 bg-gray-50 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-200"><FileText size={48} className="text-gray-300" /></div>
                      )}
                      
                      <div className="space-y-4">
                        <p className="text-xs font-bold uppercase text-gray-400 tracking-wider">Caption</p>
                        <input 
                          type="text" 
                          placeholder="Add a caption..." 
                          className="w-full px-4 py-2 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-emerald-500 font-medium text-sm"
                          value={selectedPreviewFiles[0].caption}
                          onChange={(e) => {
                            const newFiles = [...selectedPreviewFiles];
                            newFiles[0].caption = e.target.value;
                            setSelectedPreviewFiles(newFiles);
                          }}
                        />
                      </div>

                      {userData?.role === 'teacher' && (
                        <div className="space-y-3">
                          <p className="text-xs font-bold uppercase text-gray-400 tracking-wider flex justify-between">
                            Send to Multiple Classes
                            <span className="text-emerald-500 lowercase font-medium tracking-normal">{selectedBroadcastClasses.length} selected</span>
                          </p>
                          <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-xl p-2 space-y-1 bg-gray-50/50">
                            {classes.map(cls => (
                              <label key={cls.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                                  checked={selectedBroadcastClasses.includes(cls.id) || (cls.id === activeRoom?.classId && selectedBroadcastClasses.length === 0)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedBroadcastClasses(prev => [...prev, cls.id]);
                                    } else {
                                      setSelectedBroadcastClasses(prev => prev.filter(id => id !== cls.id));
                                    }
                                  }}
                                  disabled={cls.id === activeRoom?.classId && selectedBroadcastClasses.length === 0}
                                />
                                <span className="text-xs font-bold text-gray-700 uppercase">{cls.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <button onClick={handleUploadSelectedFiles} className="w-full bg-[#00A884] text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-100 hover:bg-[#008f6f] transition-all active:scale-[0.98]">
                      {selectedBroadcastClasses.length > 1 ? `Broadcast to ${selectedBroadcastClasses.length} Groups` : 'Send to Group'}
                    </button>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#F0F2F5] border-b-[6px] border-[#00A884]">
            <div className="text-center space-y-4 px-6">
              <div className="w-24 h-24 rounded-full bg-emerald-50 flex items-center justify-center mx-auto text-[#00A884]">
                <MessageSquare size={40} />
              </div>
              <h1 className="text-2xl font-light text-gray-700">WhatsApp Group Communication</h1>
              <p className="text-sm text-gray-500 max-w-xs mx-auto">Select a class group to start sending messages and attachments to students.</p>
              <div className="pt-8 flex items-center justify-center gap-2 text-gray-400 text-xs">
                <LockIcon size={12} /><span>Encrypted Group Messaging</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
      <input type="file" accept="image/*,video/*,audio/*" ref={imageInputRef} onChange={handleFileChange} className="hidden" multiple />
      <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar" ref={documentInputRef} onChange={handleFileChange} className="hidden" multiple />
      <Toast messages={toasts} onRemove={removeToast} />
    </div>
  );
};
