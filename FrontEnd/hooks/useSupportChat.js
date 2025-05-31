import { useChat } from '../hooks/useChat';
import { useState, useCallback } from 'react';
import { MessageType } from '../types/chat';

export const useSupportChat = (roomId) => {
  const { sendMessage: originalSendMessage } = useChat();
  const [error, setError] = useState(null);

  const getGuestInfo = () => {
    const guestInfo = localStorage.getItem('guestInfo');
    return guestInfo ? JSON.parse(guestInfo) : null;
  };

  const sendMessage = useCallback(async (content, type = MessageType.Text, attachmentUrl = null, fileInfo = null) => {
    try {
      const guestInfo = getGuestInfo();
      if (!guestInfo) {
        throw new Error('اطلاعات کاربری یافت نشد');
      }

      // Create message with guest info
      const messageData = {
        content,
        type,
        attachmentUrl,
        ...(fileInfo && {
          fileName: fileInfo.fileName,
          fileSize: fileInfo.fileSize
        }),
        sender: {
          id: guestInfo.id,
          userName: guestInfo.userName,
          email: guestInfo.email,
          fullName: guestInfo.fullName,
          roles: ['SupportGuest']
        }
      };

      await originalSendMessage(roomId, messageData);
    } catch (err) {
      setError(err.message || 'خطا در ارسال پیام');
      throw err;
    }
  }, [roomId, originalSendMessage]);

  return {
    sendMessage,
    error,
    clearError: () => setError(null)
  };
};
