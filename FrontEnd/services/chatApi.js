// src/services/chatApi.js
// API service for chat functionality

import apiClient from '../api/axios';

const CHAT_BASE_URL = '/api/chat';

export const chatApi = {
  // Get user's chat rooms
  getChatRooms: async () => {
    const response = await apiClient.get(`${CHAT_BASE_URL}/rooms`);
    return response.data;
  },

  // Get messages for a chat room
  getChatMessages: async (roomId, page = 1, pageSize = 20) => {
    const response = await apiClient.get(
      `${CHAT_BASE_URL}/rooms/${roomId}/messages`,
      {
        params: { page, pageSize }
      }
    );
    return response.data;
  },

  // Create new chat room
  createChatRoom: async (roomData) => {
    const response = await apiClient.post(`${CHAT_BASE_URL}/rooms`, roomData);
    return response.data;
  },

  // Send message
  sendMessage: async (roomId, messageData) => {
    const response = await apiClient.post(
      `${CHAT_BASE_URL}/rooms/${roomId}/messages`,
      messageData
    );
    return response.data;
  },

  // Join chat room
  joinChatRoom: async (roomId) => {
    const response = await apiClient.post(`${CHAT_BASE_URL}/rooms/${roomId}/join`);
    return response.data;
  },

  // Leave chat room
  leaveChatRoom: async (roomId) => {
    const response = await apiClient.delete(`${CHAT_BASE_URL}/rooms/${roomId}/leave`);
    return response.data;
  },

  // Get online users
  getOnlineUsers: async () => {
    const response = await apiClient.get(`${CHAT_BASE_URL}/users/online`);
    return response.data;
  },

  // Search users
  searchUsers: async (query) => {
    const response = await apiClient.get(`${CHAT_BASE_URL}/users/search`, {
      params: { query }
    });
    return response.data;
  },

  // Get chat room members
  getChatRoomMembers: async (roomId) => {
    const response = await apiClient.get(`${CHAT_BASE_URL}/rooms/${roomId}/members`);
    return response.data;
  },

  editMessage: async (messageId, newContent) => {
    const response = await apiClient.put(`${CHAT_BASE_URL}/messages/${messageId}`, { newContent });
    return response.data;
  },

  deleteMessage: async (messageId) => {
    const response = await apiClient.delete(`${CHAT_BASE_URL}/messages/${messageId}`);
    return response.data; 
  },

  reactToMessage: async (messageId, reactionData) => { // reactionData: { emoji: string }
    const response = await apiClient.post(`${CHAT_BASE_URL}/messages/${messageId}/react`, reactionData);
    return response.data; // This should be MessageReactionDto
  },

  forwardMessage: async (originalMessageId, targetChatRoomId) => {
    const response = await apiClient.post(`${CHAT_BASE_URL}/messages/forward`, { originalMessageId, targetChatRoomId });
    return response.data; // Should be ChatMessageDto of the new forwarded message
  },
};