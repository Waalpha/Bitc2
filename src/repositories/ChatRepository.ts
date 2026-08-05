import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';

export interface ChatMessage {
  id?: string;
  schoolId?: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  content: string;
  channelId?: string;
  timestamp: string;
}

export class ChatRepository extends BaseRepository<ChatMessage> {
  constructor() {
    super(COLLECTIONS.CHATS);
  }
}

export const chatRepository = new ChatRepository();
