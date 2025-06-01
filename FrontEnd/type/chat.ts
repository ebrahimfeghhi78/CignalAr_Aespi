// src/types/chat.ts
// Type definitions for chat functionality

export enum MessageType {
  Text = 0,
  Image = 1,
  File = 2,
  Audio = 3,
  Video = 4,
  System = 5
}

export enum ReadStatus {
  Sent = 0,
  Delivered = 1,
  Read = 2
}

export enum ChatRole {
  Member = 0,
  Admin = 1,
  Owner = 2
}

export enum MessageDeliveryStatus { 
  Sent = 0,
  Delivered = 1, 
  Read = 2
}

export interface ChatMessage {
  id: number;
  content: string;
  senderId?: string;
  senderName: string;
  senderFullName:string;
  senderAvatar?: string;
  chatRoomId: number;
  type: MessageType;
  attachmentUrl?: string;
  fileName?: string; // برای فایل‌ها
  fileSize?: number; // برای فایل‌ها
  replyToMessageId?: number;
  createdAt: string;
  isEdited: boolean;
  editedAt?: string;
  deliveryStatus?: MessageDeliveryStatus; // برای فرستنده: وضعیت پیام (ارسال شده، تحویل داده شده، خوانده شده)
  isReadByMe?: boolean; // برای گیرنده: آیا این پیام توسط من خوانده شده است؟
}

export interface ChatRoom {
  id: number;
  name: string;
  description?: string;
  isGroup: boolean;
  avatar?: string;
  createdAt: string;
  messageCount: number;
  lastMessageContent?: string;
  lastMessageTime?: string; 
  lastMessageSenderName?: string;
  unreadCount: number;
}

export interface TypingIndicator {
  userId?: string;
  userName: string;
  chatRoomId: number;
  isTyping: boolean;
}

export interface ChatRoomMember {
  id: string;
  userName: string;
  avatar?: string;
  role: ChatRole;
  joinedAt: string;
  lastSeenAt?: string;
}

export interface OnlineUser {
  id: string;
  userName: string;
  avatar?: string;
  connectedAt: string;
}

export interface CreateChatRoomRequest {
  name: string;
  description?: string;
  isGroup: boolean;
  memberIds?: string[];
  regionId?: number;
}

export interface SendMessageRequest {
  content: string;
  type?: MessageType;
  attachmentUrl?: string;
  replyToMessageId?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface ChatState {
  currentRoom?: ChatRoom;
  rooms: ChatRoom[];
  messages: { [roomId: number]: ChatMessage[] };
  onlineUsers: OnlineUser[];
  typingUsers: { [roomId: number]: TypingIndicator[] };
  isConnected: boolean;
  isLoading: boolean;
  error?: string;
}