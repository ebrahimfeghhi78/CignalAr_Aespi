// src/contexts/ChatContext.jsx
import React, {useReducer, useEffect, useCallback} from 'react';
import {chatApi} from '../services/chatApi';
import signalRService from '../services/signalRService';
import {MessageType, ReadStatus} from '../types/chat';
import {getUserIdFromToken} from '../utils/jwt';
import {ChatContext, ActionTypes, initialState, MessageDeliveryStatus} from './ChatContextCore';

// Reducer
function chatReducer(state, action) {
  const sortedRooms =
    action.payload && Array.isArray(action.payload)
      ? [...action.payload].sort((a, b) => {
          const timeA = new Date(a.lastMessageTime || a.createdAt).getTime();
          const timeB = new Date(b.lastMessageTime || b.createdAt).getTime();
          return timeB - timeA;
        })
      : [];

  switch (action.type) {
    case ActionTypes.SET_CURRENT_USER:
      return {...state, currentLoggedInUserId: action.payload};
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
      return {
        ...state,
        // Filter out current logged-in user and ensure uniqueness
        onlineUsers: action.payload.filter((user) => user.id !== state.currentLoggedInUserId).filter((user, index, self) => index === self.findIndex((u) => u.id === user.id)),
        isLoading: false, // Assuming this action implies loading has finished for online users
      };

    case ActionTypes.UPDATE_USER_ONLINE_STATUS: {
      const {userId, isOnline, user} = action.payload;
      if (userId === state.currentLoggedInUserId) return state; // Do not add self

      if (isOnline) {
        const userExists = state.onlineUsers.some((u) => u.id === userId);
        if (!userExists && user) {
          return {
            ...state,
            onlineUsers: [...state.onlineUsers, user].filter((u, index, self) => index === self.findIndex((i) => i.id === u.id)), // Ensure uniqueness
          };
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

    case ActionTypes.EDIT_MESSAGE_SUCCESS: {
      const updatedMessage = action.payload; // This should be the full ChatMessageDto
      const roomId = updatedMessage.chatRoomId;
      if (!state.messages[roomId]) return state;

      return {
        ...state,
        messages: {
          ...state.messages,
          [roomId]: {
            ...state.messages[roomId],
            items: state.messages[roomId].items.map((msg) => (msg.id === updatedMessage.id ? updatedMessage : msg)),
          },
        },
      };
    }

    case ActionTypes.DELETE_MESSAGE_SUCCESS: {
      const {messageId, roomId} = action.payload; // Payload from SignalR or API response
      if (!state.messages[roomId]) return state;

      return {
        ...state,
        messages: {
          ...state.messages,
          [roomId]: {
            ...state.messages[roomId],
            // Option 1: Replace message content (soft delete visible)
            items: state.messages[roomId].items.map((msg) => (msg.id === messageId ? {...msg, content: '[پیام حذف شد]', isDeleted: true, attachmentUrl: null /* if applicable */} : msg)),
            // Option 2: Filter out the message (hard delete from view)
            // items: state.messages[roomId].items.filter(msg => msg.id !== messageId),
          },
        },
      };
    }

    case ActionTypes.SET_REPLYING_TO_MESSAGE:
      return {...state, replyingToMessage: action.payload};
    case ActionTypes.CLEAR_REPLYING_TO_MESSAGE:
      return {...state, replyingToMessage: null};

    case ActionTypes.MESSAGE_REACTION_SUCCESS: {
      const {messageId, userId, userName, emoji, chatRoomId} = action.payload;
      if (!state.messages[chatRoomId]) return state;

      return {
        ...state,
        messages: {
          ...state.messages,
          [chatRoomId]: {
            ...state.messages[chatRoomId],
            items: state.messages[chatRoomId].items.map((msg) => {
              if (msg.id === messageId) {
                const existingReactions = msg.reactions || [];
                let newReactions;

                if (action.payload.removed) {
                  newReactions = existingReactions.filter((r) => !(r.userId === userId && r.emoji === emoji));
                } else {
                  const userExistingReactionWithThisEmoji = existingReactions.find((r) => r.userId === userId && r.emoji === emoji);
                  if (userExistingReactionWithThisEmoji) {
                    newReactions = existingReactions.filter((r) => !(r.userId === userId && r.emoji === emoji));
                  } else {
                    newReactions = [...existingReactions, {emoji, userId, userName}];
                  }
                }
                return {...msg, reactions: newReactions};
              }
              return msg;
            }),
          },
        },
      };
    }

    case ActionTypes.SHOW_FORWARD_MODAL:
      return {...state, isForwardModalVisible: true, messageIdToForward: action.payload};

    case ActionTypes.HIDE_FORWARD_MODAL:
      return {...state, isForwardModalVisible: false, messageIdToForward: null, error: null}; // Clear error on hide

    default:
      return state;
  }
}

// Provider component
export const ChatProvider = ({children}) => {
  const [state, dispatch] = useReducer(chatReducer, {
    ...initialState,
    currentLoggedInUserId: getUserIdFromToken(localStorage.getItem('token')),
  });

  // Initialize SignalR connection
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Update currentLoggedInUserId when token changes
      const userId = getUserIdFromToken(token);
      if (userId !== state.currentLoggedInUserId) {
        dispatch({type: ActionTypes.SET_CURRENT_USER, payload: userId});
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

    const handleMessageEdited = (messageDto) => {
      // messageDto is ChatMessageDto
      dispatch({type: ActionTypes.EDIT_MESSAGE_SUCCESS, payload: messageDto});
    };
    const handleMessageDeleted = (payload) => {
      // payload: { MessageId, ChatRoomId, IsDeleted }
      dispatch({type: ActionTypes.DELETE_MESSAGE_SUCCESS, payload: {messageId: payload.MessageId, roomId: payload.ChatRoomId}});
    };

    // Add SignalR listener in useEffect
    // const handleMessageReacted = (reactionDto) => { // reactionDto is MessageReactionDto
    // dispatch({ type: ActionTypes.MESSAGE_REACTION_SUCCESS, payload: reactionDto });
    // };
    // signalRService.addEventListener('MessageReacted', handleMessageReacted);
    // return () => { signalRService.removeEventListener('MessageReacted', handleMessageReacted); };

    // Updated SignalR listener logic based on the reducer needing more info for toggle

    const handleMessageReacted = (reactionData) => {
      // reactionData is MessageReactionDto from backend
      // The reducer needs to know if it's an add or remove.
      // The backend ReactToMessageCommandHandler now returns MessageReactionDto.
      // If the logic is toggle (add if not exist, remove if exist for that user+emoji):
      // The client reducer can infer based on current state.
      dispatch({type: ActionTypes.MESSAGE_REACTION_SUCCESS, payload: reactionData});
    };

    signalRService.addEventListener('MessageReacted', handleMessageReacted);
    signalRService.addEventListener('connectionStatusChanged', handleConnectionStatusChanged);
    signalRService.addEventListener('messageReceived', handleMessageReceived);
    signalRService.addEventListener('userTyping', handleUserTyping);
    signalRService.addEventListener('userOnlineStatus', handleUserOnlineStatus); // تغییر نام رویداد
    signalRService.addEventListener('receiveChatRoomUpdate', handleReceiveChatRoomUpdate);
    signalRService.addEventListener('messageRead', handleMessageRead);
    signalRService.addEventListener('messageReadReceipt', handleMessageReadReceipt);
    signalRService.addEventListener('MessageEdited', handleMessageEdited);
    signalRService.addEventListener('MessageDeleted', handleMessageDeleted);

    return () => {
      signalRService.removeEventListener('MessageReacted', handleMessageReacted);
      signalRService.removeEventListener('connectionStatusChanged', handleConnectionStatusChanged);
      signalRService.removeEventListener('messageReceived', handleMessageReceived);
      signalRService.removeEventListener('userTyping', handleUserTyping);
      signalRService.removeEventListener('userOnlineStatus', handleUserOnlineStatus); // تغییر نام رویداد
      signalRService.removeEventListener('receiveChatRoomUpdate', handleReceiveChatRoomUpdate);
      signalRService.removeEventListener('messageRead', handleMessageRead);
      signalRService.removeEventListener('messageReadReceipt', handleMessageReadReceipt);
      signalRService.removeEventListener('MessageEdited', handleMessageEdited);
      signalRService.removeEventListener('MessageDeleted', handleMessageDeleted);
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

  const setCurrentRoom = useCallback(
    (room) => {
      dispatch({type: ActionTypes.SET_CURRENT_ROOM, payload: room});
      if (room && signalRService.getConnectionStatus()) {
        signalRService.joinRoom(room.id.toString());
        if (room.unreadCount > 0) {
          // اگر پیام خوانده نشده وجود دارد
          markAllMessagesAsReadInRoom(room.id);
        }
      }
    },
    [markAllMessagesAsReadInRoom]
  );

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

  const sendMessage = useCallback(
    async (roomId, content, type = MessageType.Text, attachmentUrl = null, fileInfo = null, replyToMessageId = null) => {
      try {
        const messageData = {
          content,
          type,
          attachmentUrl,
          ...(fileInfo && {fileName: fileInfo.fileName, fileSize: fileInfo.fileSize}),
          replyToMessageId, // Add replyToMessageId here
        };
        const sentMessage = await chatApi.sendMessage(roomId, messageData);
        return sentMessage;
      } catch (error) {
        dispatch({type: ActionTypes.SET_ERROR, payload: error.message});
        throw error;
      }
    },
    [dispatch]
  );

  const markMessageAsRead = useCallback((roomId, messageId) => {
    if (signalRService.getConnectionStatus() && roomId && messageId) {
      // اطمینان از وجود roomId و messageId
      signalRService.markMessageAsRead(messageId.toString(), roomId.toString());
    }
  }, []);

  const editMessage = useCallback(
    async (messageId, roomId, newContent) => {
      try {
        const updatedMessageDto = await chatApi.editMessage(messageId, newContent);
        // SignalR will broadcast "MessageEdited", so local dispatch might be redundant if handled by SignalR listener
        // dispatch({ type: ActionTypes.EDIT_MESSAGE_SUCCESS, payload: updatedMessageDto });
        return updatedMessageDto;
      } catch (error) {
        dispatch({type: ActionTypes.SET_ERROR, payload: error.message});
        throw error;
      }
    },
    [dispatch]
  );
  const deleteMessage = useCallback(
    async (messageId) => {
      try {
        await chatApi.deleteMessage(messageId);
        // SignalR will broadcast "MessageDeleted"
      } catch (error) {
        dispatch({type: ActionTypes.SET_ERROR, payload: error.message});
        throw error;
      }
    },
    [dispatch]
  );

  const setReplyingToMessage = useCallback(
    (messageData) => {
      dispatch({type: ActionTypes.SET_REPLYING_TO_MESSAGE, payload: messageData});
    },
    [dispatch]
  );

  const clearReplyingToMessage = useCallback(() => {
    dispatch({type: ActionTypes.CLEAR_REPLYING_TO_MESSAGE});
  }, [dispatch]);

  const sendReaction = useCallback(
    async (messageId, roomId, emoji) => {
      try {
        // API call will trigger SignalR broadcast "MessageReacted"
        await chatApi.reactToMessage(messageId, {emoji});
        // Optimistic update can be done here if needed, but SignalR is preferred for consistency
      } catch (error) {
        dispatch({type: ActionTypes.SET_ERROR, payload: error.message});
        console.error('Error sending reaction:', error);
      }
    },
    [dispatch]
  );

  const showForwardModal = useCallback(
    (messageId) => {
      dispatch({type: ActionTypes.SHOW_FORWARD_MODAL, payload: messageId});
    },
    [dispatch]
  );

  const hideForwardModal = useCallback(() => {
    dispatch({type: ActionTypes.HIDE_FORWARD_MODAL});
  }, [dispatch]);

  const forwardMessage = useCallback(
    async (originalMessageId, targetChatRoomId) => {
      try {
        // The API call will add a new message to the target room.
        // SignalR's 'ReceiveMessage' and 'ReceiveChatRoomUpdate' will handle UI updates in the target room.
        const forwardedMessageDto = await chatApi.forwardMessage(originalMessageId, targetChatRoomId);
        // dispatch({ type: ActionTypes.FORWARD_MESSAGE_SUCCESS }); // Optional
        return forwardedMessageDto;
      } catch (error) {
        dispatch({type: ActionTypes.SET_ERROR, payload: error.message}); // Set general error for modal to display
        throw error; // Re-throw for the modal to catch locally if needed
      }
    },
    [dispatch]
  );

  const value = {
    ...state,
    loadChatRooms,
    loadMessages,
    sendMessage,
    setReplyingToMessage,
    clearReplyingToMessage,
    createChatRoom,
    setCurrentRoom,
    sendReaction,
    markAllMessagesAsReadInRoom,
    editMessage,
    deleteMessage,
    showForwardModal,
    hideForwardModal,
    forwardMessage,
    isForwardModalVisible: state.isForwardModalVisible,
    messageIdToForward: state.messageIdToForward,
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
    clearError: () => dispatch({type: ActionTypes.SET_ERROR, payload: null}),
    replyingToMessage: state.replyingToMessage,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
