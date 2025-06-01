// src/contexts/ChatContextCore.jsx

import { createContext } from 'react';

export const MessageDeliveryStatus = {
  Sent: 'sent',
  Read: 'read'
};

export const ActionTypes = {
  SET_LOADING: 'SET_LOADING',
  SET_LOADING_MESSAGES: 'SET_LOADING_MESSAGES',
  SET_ERROR: 'SET_ERROR',
  SET_CONNECTION_STATUS: 'SET_CONNECTION_STATUS',
  SET_ROOMS: 'SET_ROOMS',
  UPSERT_CHAT_ROOM: 'UPSERT_CHAT_ROOM',
  SET_CURRENT_ROOM: 'SET_CURRENT_ROOM',
  SET_MESSAGES: 'SET_MESSAGES',
  PREPEND_MESSAGES: 'PREPEND_MESSAGES',
  ADD_MESSAGE: 'ADD_MESSAGE',
  UPDATE_MESSAGE_READ_STATUS: 'UPDATE_MESSAGE_READ_STATUS',
  UPDATE_MESSAGE: 'UPDATE_MESSAGE',
  SET_ONLINE_USERS: 'SET_ONLINE_USERS',
  UPDATE_USER_ONLINE_STATUS: 'UPDATE_USER_ONLINE_STATUS',
  UPDATE_TYPING_STATUS: 'UPDATE_TYPING_STATUS',
  UPDATE_MESSAGE_READ_STATUS_FOR_SENDER: 'UPDATE_MESSAGE_READ_STATUS_FOR_SENDER',
  UPDATE_MESSAGE_AS_READ_FOR_RECEIVER: 'UPDATE_MESSAGE_AS_READ_FOR_RECEIVER',
  MARK_ALL_MESSAGES_AS_READ_IN_ROOM: 'MARK_ALL_MESSAGES_AS_READ_IN_ROOM',
  SET_CURRENT_USER: 'SET_CURRENT_USER',
  EDIT_MESSAGE_SUCCESS: 'EDIT_MESSAGE_SUCCESS',
  DELETE_MESSAGE_SUCCESS: 'DELETE_MESSAGE_SUCCESS',
  SET_REPLYING_TO_MESSAGE: 'SET_REPLYING_TO_MESSAGE',
  CLEAR_REPLYING_TO_MESSAGE: 'CLEAR_REPLYING_TO_MESSAGE',
  MESSAGE_REACTION_SUCCESS: 'MESSAGE_REACTION_SUCCESS',
  SHOW_FORWARD_MODAL: 'SHOW_FORWARD_MODAL',
  HIDE_FORWARD_MODAL: 'HIDE_FORWARD_MODAL',
  FORWARD_MESSAGE_SUCCESS: 'FORWARD_MESSAGE_SUCCESS',
};

// Initial state
export const initialState = {
  currentRoom: null,
  rooms: [],
  messages: {}, // { [roomId: number]: { items: ChatMessage[], hasMore: boolean, currentPage: number } }
  onlineUsers: [],
  typingUsers: {},
  isConnected: false,
  isLoading: false,
  isLoadingMessages: false,
  error: null,
  currentLoggedInUserId: null,
  replyingToMessage: null, // { id, content, senderName, type, ... }
  isForwardModalVisible: false,
  messageIdToForward: null,
};

export const ChatContext = createContext();
