// src/contexts/ChatContext.jsx
import React, { useReducer, useEffect, useCallback } from 'react';
import { chatApi } from '../services/chatApi';
import signalRService from '../services/signalRService';
import { MessageType, ReadStatus } from '../types/chat';
import { getUserIdFromToken } from '../utils/jwt';
import { ChatContext, ActionTypes, initialState, MessageDeliveryStatus } from './ChatContextCore';

// Reducer
function chatReducer(state, action) {
  const sortedRooms = action.payload && Array.isArray(action.payload) ? 
    [...action.payload].sort((a, b) => {
      const timeA = new Date(a.lastMessageTime || a.createdAt).getTime();
      const timeB = new Date(b.lastMessageTime || b.createdAt).getTime();
      return timeB - timeA;
    }) : [];

  switch (action.type) {
    case ActionTypes.SET_CURRENT_USER:
      return { ...state, currentLoggedInUserId: action.payload };
    case ActionTypes.SET_LOADING:
      return {...state, isLoading: action.payload};
    case ActionTypes.SET_LOADING_MESSAGES:
      return {...state, isLoadingMessages: action.payload};
    case ActionTypes.SET_ERROR:
      return {...state, error: action.payload, isLoading: false, isLoadingMessages: false};
    case ActionTypes.SET_CONNECTION_STATUS:
      return {...state, isConnected: action.payload};

    case ActionTypes.SET_ROOMS: // برای بارگذاری اولیه روم‌ها
      // مرتب‌سازی بر اساس زمان آخرین پیام یا زمان ایجاد روم

      return {...state, rooms: sortedRooms};

    case ActionTypes.UPSERT_CHAT_ROOM: {
      // برای افزودن یا به‌روزرسانی یک روم
      const updatedRoomData = action.payload;
      const roomExists = state.rooms.some((room) => room.id === updatedRoomData.id);
      let newRoomsArray;
      if (roomExists) {
        newRoomsArray = state.rooms.map((room) => (room.id === updatedRoomData.id ? {...room, ...updatedRoomData} : room));
      } else {
        newRoomsArray = [...state.rooms, updatedRoomData];
      }
      newRoomsArray.sort((a, b) => {
        const timeA = new Date(a.lastMessageTime || a.createdAt).getTime();
        const timeB = new Date(b.lastMessageTime || b.createdAt).getTime();
        return timeB - timeA;
      });
      return {...state, rooms: newRoomsArray};
    }

    case ActionTypes.SET_CURRENT_ROOM:
      return {...state, currentRoom: action.payload};

    case ActionTypes.SET_MESSAGES: {
      // برای بارگذاری اولیه پیام‌های یک روم
      const {roomId, messages, hasMore, currentPage} = action.payload;
      return {
        ...state,
        messages: {
          ...state.messages,
          [roomId]: {items: messages, hasMore, currentPage},
        },
      };
    }
    case ActionTypes.PREPEND_MESSAGES: {
      // برای افزودن پیام‌های قدیمی‌تر به ابتدای لیست
      const {roomId, messages, hasMore, currentPage} = action.payload;
      const existingRoomMessages = state.messages[roomId]?.items || [];
      return {
        ...state,
        messages: {
          ...state.messages,
          [roomId]: {
            items: [...messages, ...existingRoomMessages], // پیام‌های جدید به ابتدا اضافه می‌شوند
            hasMore,
            currentPage,
          },
        },
      };
    }

    case ActionTypes.UPDATE_MESSAGE_READ_STATUS: {
      const {messageId, readByUserId, roomIdToUpdate} = action.payload; // roomIdToUpdate باید از جایی مشخص شود
      if (!roomIdToUpdate || !state.messages[roomIdToUpdate]) return state;

      const updatedMessagesForRoom = state.messages[roomIdToUpdate].items.map(
        (msg) => (msg.id === messageId ? {...msg, readStatus: ReadStatus.Read, readBy: [...(msg.readBy || []), readByUserId]} : msg) // readBy آرایه‌ای از یوزرآیدی‌ها
      );
      return {
        ...state,
        messages: {
          ...state.messages,
          [roomIdToUpdate]: {...state.messages[roomIdToUpdate], items: updatedMessagesForRoom},
        },
      };
    }

    case ActionTypes.SET_ONLINE_USERS:
      return {...state, onlineUsers: action.payload};

    case ActionTypes.UPDATE_USER_ONLINE_STATUS: {
      const {userId, isOnline, user} = action.payload; // user شامل avatar, userName
      if (isOnline) {
        const userExists = state.onlineUsers.some((u) => u.id === userId);
        if (!userExists && user) {
          // اطمینان از وجود user
          return {...state, onlineUsers: [...state.onlineUsers, user]};
        }
      } else {
        return {...state, onlineUsers: state.onlineUsers.filter((u) => u.id !== userId)};
      }
      return state;
    }
    case ActionTypes.UPDATE_TYPING_STATUS: {
      const {chatRoomId, userId: typingUserId, userName, isTyping} = action.payload;
      const currentTypingInRoom = state.typingUsers[chatRoomId] || [];
      let newTypingUsersInRoom;

      if (isTyping) {
        if (!currentTypingInRoom.some((u) => u.userId === typingUserId)) {
          newTypingUsersInRoom = [...currentTypingInRoom, {userId: typingUserId, userName, isTyping: true}];
        } else {
          newTypingUsersInRoom = currentTypingInRoom; // تغییری ایجاد نشده
        }
      } else {
        newTypingUsersInRoom = currentTypingInRoom.filter((u) => u.userId !== typingUserId);
      }
      return {
        ...state,
        typingUsers: {...state.typingUsers, [chatRoomId]: newTypingUsersInRoom},
      };
    }

    case ActionTypes.ADD_MESSAGE: {
      const newMessage = action.payload;
      const roomId = newMessage.chatRoomId;
      const currentRoomMessages = state.messages[roomId]?.items || [];
      const currentRoomInfo = state.messages[roomId] || {items: [], hasMore: false, currentPage: 1};

      // اگر پیام جدید از طرف دیگری است و روم فعلی باز نیست، باید isReadByMe = false باشد
      // این منطق می‌تواند پیچیده باشد، ساده‌تر است که وضعیت اولیه isReadByMe از سرور بیاید یا بعدا آپدیت شود
      const messageWithInitialReadState = {
        ...newMessage,
        deliveryStatus: MessageDeliveryStatus.Sent, // وضعیت اولیه برای فرستنده
        isReadByMe: newMessage.senderId === state.currentLoggedInUserId, // اگر خودم فرستادم، خوانده شده توسط من است
      };

      return {
        ...state,
        messages: {
          ...state.messages,
          [roomId]: {
            ...currentRoomInfo,
            items: [...currentRoomMessages, messageWithInitialReadState],
          },
        },
      };
    }

    case ActionTypes.UPDATE_MESSAGE_READ_STATUS_FOR_SENDER: {
      // payload: { messageId, readByUserId, chatRoomId }
      const {messageId, chatRoomId} = action.payload;
      if (!chatRoomId || !state.messages[chatRoomId]) return state;

      const updatedMessagesForRoom = state.messages[chatRoomId].items.map((msg) =>
        msg.id === messageId && msg.senderId === state.currentLoggedInUserId // فقط پیام‌های خودم را آپدیت کن
          ? {...msg, deliveryStatus: MessageDeliveryStatus.Read}
          : msg
      );
      return {
        ...state,
        messages: {
          ...state.messages,
          [chatRoomId]: {...state.messages[chatRoomId], items: updatedMessagesForRoom},
        },
      };
    }

    case ActionTypes.UPDATE_MESSAGE_AS_READ_FOR_RECEIVER: {
      // payload: { messageId, chatRoomId, status }
      const {messageId, chatRoomId} = action.payload;
      if (!chatRoomId || !state.messages[chatRoomId]) return state;

      const updatedMessagesForRoom = state.messages[chatRoomId].items.map((msg) =>
        msg.id === messageId && msg.senderId !== state.currentLoggedInUserId // فقط پیام‌های دیگران را که من دریافت کردم
          ? {...msg, isReadByMe: true}
          : msg
      );
      return {
        ...state,
        messages: {
          ...state.messages,
          [chatRoomId]: {...state.messages[chatRoomId], items: updatedMessagesForRoom},
        },
      };
    }

    case ActionTypes.MARK_ALL_MESSAGES_AS_READ_IN_ROOM: {
      const {roomId, userId} = action.payload; // userId کاربر لاگین کرده
      if (!roomId || !state.messages[roomId]) return state;

      let unreadCountChanged = false;
      const updatedMessages = state.messages[roomId].items.map((msg) => {
        if (msg.senderId !== userId && !msg.isReadByMe) {
          unreadCountChanged = true;
          return {...msg, isReadByMe: true};
        }
        return msg;
      });

      if (!unreadCountChanged) return state; // اگر تغییری نبود، state جدید برنگردان

      const updatedRooms = state.rooms
        .map(
          (r) => (r.id === roomId ? {...r, unreadCount: 0} : r) // unreadCount آن روم برای کاربر فعلی صفر می‌شود
        )
        .sort((a, b) => new Date(b.lastMessageTime || b.createdAt) - new Date(a.lastMessageTime || a.createdAt));

      return {
        ...state,
        messages: {
          ...state.messages,
          [roomId]: {...state.messages[roomId], items: updatedMessages},
        },
        rooms: updatedRooms,
      };
    }

    default:
      return state;
  }
}

// Provider component
export const ChatProvider = ({children}) => {
  const [state, dispatch] = useReducer(chatReducer, {
    ...initialState,
    currentLoggedInUserId: getUserIdFromToken(localStorage.getItem('token'))
  });

  // Initialize SignalR connection
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Update currentLoggedInUserId when token changes
      const userId = getUserIdFromToken(token);
      if (userId !== state.currentLoggedInUserId) {
        dispatch({ type: ActionTypes.SET_CURRENT_USER, payload: userId });
      }
      
      signalRService.startConnection(token).then((connected) => {
        dispatch({type: ActionTypes.SET_CONNECTION_STATUS, payload: connected});
      });
    }

    const handleConnectionStatusChanged = (isConnected) => {
      dispatch({type: ActionTypes.SET_CONNECTION_STATUS, payload: isConnected});
    };
    const handleMessageReceived = (message) => {
      // message: ChatMessageDto
      dispatch({type: ActionTypes.ADD_MESSAGE, payload: message});
      // همچنین باید unreadCount در روم مربوطه برای کاربر فعلی آپدیت شود اگر پیام از دیگری است و روم فعلی نیست
      // این منطق با ReceiveChatRoomUpdate از سرور ساده‌تر می‌شود.
    };
    const handleUserTyping = (typingData) => {
      dispatch({type: ActionTypes.UPDATE_TYPING_STATUS, payload: typingData});
    };
    const handleUserOnlineStatus = (userData) => {
      // userData: { UserId, IsOnline, Avatar, UserName }
      // این رویداد از سرور با نام UserOnlineStatus می‌آید
      dispatch({
        type: ActionTypes.UPDATE_USER_ONLINE_STATUS,
        payload: {userId: userData.UserId, isOnline: userData.IsOnline, user: {id: userData.UserId, userName: userData.UserName, avatar: userData.Avatar, connectedAt: new Date().toISOString()}},
      });
    };
    const handleReceiveChatRoomUpdate = (roomData) => {
      // roomData: ChatRoomDto (تکمیل شده)
      dispatch({type: ActionTypes.UPSERT_CHAT_ROOM, payload: roomData});
    };

    const handleMessageRead = (readData) => {
      // readData: { MessageId, ReadBy, ChatRoomId }
      dispatch({
        type: ActionTypes.UPDATE_MESSAGE_READ_STATUS_FOR_SENDER,
        payload: readData,
      });
    };
    const handleMessageReadReceipt = (receiptData) => {
      // receiptData: { MessageId, ChatRoomId, Status }
      dispatch({
        type: ActionTypes.UPDATE_MESSAGE_AS_READ_FOR_RECEIVER,
        payload: receiptData,
      });
    };

    signalRService.addEventListener('connectionStatusChanged', handleConnectionStatusChanged);
    signalRService.addEventListener('messageReceived', handleMessageReceived);
    signalRService.addEventListener('userTyping', handleUserTyping);
    signalRService.addEventListener('userOnlineStatus', handleUserOnlineStatus); // تغییر نام رویداد
    signalRService.addEventListener('receiveChatRoomUpdate', handleReceiveChatRoomUpdate);
    signalRService.addEventListener('messageRead', handleMessageRead);
    signalRService.addEventListener('messageReadReceipt', handleMessageReadReceipt);
    return () => {
      signalRService.removeEventListener('connectionStatusChanged', handleConnectionStatusChanged);
      signalRService.removeEventListener('messageReceived', handleMessageReceived);
      signalRService.removeEventListener('userTyping', handleUserTyping);
      signalRService.removeEventListener('userOnlineStatus', handleUserOnlineStatus); // تغییر نام رویداد
      signalRService.removeEventListener('receiveChatRoomUpdate', handleReceiveChatRoomUpdate);
      signalRService.removeEventListener('messageRead', handleMessageRead);
      signalRService.removeEventListener('messageReadReceipt', handleMessageReadReceipt);
      signalRService.stopConnection();
    };
  }, [state.currentLoggedInUserId]);

  // Actions

  const markAllMessagesAsReadInRoom = useCallback(
    (roomId) => {
      if (!roomId || !state.messages[roomId]?.items) return;
      const messagesInRoom = state.messages[roomId].items;
      let lastUnreadMessageId = null;

      for (let i = messagesInRoom.length - 1; i >= 0; i--) {
        const msg = messagesInRoom[i];
        // فقط پیام‌هایی که کاربر فعلی نفرستاده و هنوز توسط او خوانده نشده‌اند
        if (msg.senderId !== state.currentLoggedInUserId && !msg.isReadByMe) {
          lastUnreadMessageId = msg.id;
          // به جای ارسال برای تک تک پیام‌ها، می‌توان آخرین پیام خوانده نشده را به سرور فرستاد
          // یا اینکه کلاینت خودش unreadCount را صفر کند و به سرور اطلاع دهد که تا این پیام خوانده شده
          // در اینجا، ما فقط آخرین پیام خوانده نشده را به هاب می‌فرستیم
          // هاب باید منطقی برای آپدیت LastReadMessageId و سپس ارسال آپدیت روم داشته باشد
          break; // فقط آخرین پیام خوانده نشده را در نظر می‌گیریم
        }
      }
      if (lastUnreadMessageId && signalRService.getConnectionStatus()) {
        signalRService.markMessageAsRead(lastUnreadMessageId.toString(), roomId.toString());
      }
      // آپدیت UI به صورت خوشبینانه (optimistic update)
      dispatch({type: ActionTypes.MARK_ALL_MESSAGES_AS_READ_IN_ROOM, payload: {roomId, userId: state.currentLoggedInUserId}});
    },
    [state.messages, state.currentLoggedInUserId]
  );

  const loadChatRooms = useCallback(async () => {
    try {
      dispatch({type: ActionTypes.SET_LOADING, payload: true});
      const rooms = await chatApi.getChatRooms(); // این API باید ChatRoomDto تکمیل شده را برگرداند
      dispatch({type: ActionTypes.SET_ROOMS, payload: rooms});
      return rooms; // بازگرداندن روم‌ها برای استفاده مستقیم در صورت نیاز
    } catch (error) {
      dispatch({type: ActionTypes.SET_ERROR, payload: error.message});
      return []; // بازگرداندن آرایه خالی در صورت خطا
    } finally {
      dispatch({type: ActionTypes.SET_LOADING, payload: false});
    }
  }, []);

  const loadMessages = useCallback(async (roomId, page = 1, pageSize = 20, loadOlder = false) => {
    if (!roomId) return;
    try {
      dispatch({type: ActionTypes.SET_LOADING_MESSAGES, payload: true});
      // API باید PaginatedResult<ChatMessageDto> را برگرداند
      const result = await chatApi.getChatMessages(roomId, page, pageSize);
      // result باید شامل items, totalPages, currentPage, hasNextPage (برای پیام‌های قدیمی‌تر hasPreviousPage) باشد
      // فرض می‌کنیم result.items آرایه پیام‌هاست و result.hasMore نشان‌دهنده وجود صفحات قدیمی‌تر است
      const messages = result.items || result; // تطبیق با ساختار فعلی یا جدید
      const hasMore = result.pageNumber ? result.pageNumber < result.totalPages : false; // اگر صفحه‌بندی کامل باشد

      if (loadOlder) {
        dispatch({type: ActionTypes.PREPEND_MESSAGES, payload: {roomId, messages, hasMore, currentPage: page}});
      } else {
        dispatch({type: ActionTypes.SET_MESSAGES, payload: {roomId, messages, hasMore, currentPage: page}});
      }
    } catch (error) {
      dispatch({type: ActionTypes.SET_ERROR, payload: error.message});
    } finally {
      dispatch({type: ActionTypes.SET_LOADING_MESSAGES, payload: false});
    }
  }, []);

  // ... (بقیه اکشن‌ها مانند sendMessage, createChatRoom با تغییرات جزئی برای هماهنگی)

  const setCurrentRoom = useCallback((room) => {
    dispatch({ type: ActionTypes.SET_CURRENT_ROOM, payload: room });
    if (room && signalRService.getConnectionStatus()) {
      signalRService.joinRoom(room.id.toString());
      if (room.unreadCount > 0) { // اگر پیام خوانده نشده وجود دارد
          markAllMessagesAsReadInRoom(room.id);
      }
    }
  }, [markAllMessagesAsReadInRoom]); 

  const createChatRoom = useCallback(async (roomData) => {
    // roomData: CreateChatRoomRequest
    try {
      dispatch({type: ActionTypes.SET_LOADING, payload: true});
      // roomData باید شامل IsSupportRoom و اطلاعات مهمان باشد اگر لازم است
      const newRoom = await chatApi.createChatRoom(roomData); // این API باید ChatRoomDto برگرداند
      // نیازی به dispatch ADD_ROOM نیست، چون سرور از طریق ReceiveChatRoomUpdate اطلاع می‌دهد
      // dispatch({ type: ActionTypes.UPSERT_CHAT_ROOM, payload: newRoom }); // یا اینکه اینجا هم اضافه کنیم برای نمایش فوری به ایجاد کننده
      return newRoom;
    } catch (error) {
      dispatch({type: ActionTypes.SET_ERROR, payload: error.message});
      throw error;
    } finally {
      dispatch({type: ActionTypes.SET_LOADING, payload: false});
    }
  }, []);

  const sendMessage = useCallback(async (roomId, content, type = MessageType.Text, attachmentUrl = null, fileInfo = null) => {
    try {
      // dispatch({ type: ActionTypes.SET_LOADING, payload: true }); // لودینگ برای ارسال پیام شاید لازم نباشد
      const messageData = {
        content,
        type,
        attachmentUrl,
        ...(fileInfo && {fileName: fileInfo.fileName, fileSize: fileInfo.fileSize}),
      };
      // API sendMessage، پیام ارسال شده (ChatMessageDto) را برمی‌گرداند
      const sentMessage = await chatApi.sendMessage(roomId, messageData);
      // نیازی به dispatch ADD_MESSAGE نیست، چون سرور از طریق ReceiveMessage اطلاع می‌دهد
      // و نیازی به آپدیت دستی روم نیست چون سرور از طریق ReceiveChatRoomUpdate اطلاع می‌دهد
      return sentMessage;
    } catch (error) {
      dispatch({type: ActionTypes.SET_ERROR, payload: error.message});
      throw error;
    } finally {
      // dispatch({ type: ActionTypes.SET_LOADING, payload: false });
    }
  }, []);

  const markMessageAsRead = useCallback((roomId, messageId) => {
    if (signalRService.getConnectionStatus() && roomId && messageId) {
      // اطمینان از وجود roomId و messageId
      signalRService.markMessageAsRead(messageId.toString(), roomId.toString());
    }
  }, []);

  const value = {
    ...state,
    loadChatRooms,
    loadMessages,
    sendMessage,
    createChatRoom,
    setCurrentRoom,
    markAllMessagesAsReadInRoom,
    startTyping: (roomId) => signalRService.startTyping(roomId.toString()),
    stopTyping: (roomId) => signalRService.stopTyping(roomId ? roomId.toString() : null),
    markMessageAsRead,
    loadOnlineUsers: useCallback(async () => {
      try {
        const users = await chatApi.getOnlineUsers();
        dispatch({type: ActionTypes.SET_ONLINE_USERS, payload: users});
      } catch (error) {
        dispatch({type: ActionTypes.SET_ERROR, payload: error.message});
      }
    }, []),
    clearError: () => dispatch({type: ActionTypes.SET_ERROR, payload: null})
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

// Hook moved to hooks/useChat.js
