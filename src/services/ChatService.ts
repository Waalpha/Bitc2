import { chatRepository, ChatMessage } from '../repositories/ChatRepository';
import { LoggerService } from './loggerService';

export class ChatService {
  static async sendMessage(schoolId: string, messageData: Omit<ChatMessage, 'id' | 'schoolId' | 'timestamp'>): Promise<ChatMessage> {
    LoggerService.info('Sending chat message', { schoolId, senderId: messageData.senderId });
    return await chatRepository.create({
      ...messageData,
      schoolId,
      timestamp: new Date().toISOString(),
    });
  }
}
