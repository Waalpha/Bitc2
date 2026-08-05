export interface AppNotification {
  id: string;
  schoolId?: string;
  userId: string;
  title: string;
  message: string;
  type: 'exam' | 'grade' | 'announcement' | 'deadline' | 'fee' | 'broadcast' | 'chat' | 'attendance';
  read: boolean;
  createdAt: string;
  senderId?: string;
  link?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: 'image' | 'pdf' | 'word' | 'video';
}

export interface ChatRoom {
  id: string;
  schoolId?: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt: string;
  type: 'direct' | 'group';
  name?: string;
  classId?: string;
}

export interface ChatMessage {
  id: string;
  schoolId?: string;
  roomId: string;
  senderId: string;
  text: string;
  createdAt: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'pdf' | 'word' | 'file' | 'video';
  attachmentName?: string;
  attachmentSize?: number;
  readBy?: string[];
}
