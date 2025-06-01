// src/components/Chat/MessageList.jsx
// Component for displaying messages in a chat room

import React, {useEffect, useRef, useCallback} from 'react'; // useCallback اضافه شد
import {Spinner, Button} from 'react-bootstrap'; // Button اضافه شد
import MessageItem from './MessageItem';

const MessageList = ({messages, typingUsers, isLoading, hasMoreMessages, onLoadMoreMessages}) => {
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = React.useState(true);

  // Auto scroll to bottom when new messages arrive (if user is at the bottom)
  useEffect(() => {
    if (isAutoScrollEnabled) {
      scrollToBottom();
    }
  }, [messages, isAutoScrollEnabled]); // به messages وابسته است

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({behavior: 'smooth'});
  };

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      // Check if user is near the bottom
      const atBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100; // 100px threshold
      setIsAutoScrollEnabled(atBottom);

      // Check if user is near the top for loading older messages
      if (container.scrollTop <= 50 && hasMoreMessages && !isLoading) {
        // 50px threshold from top
        onLoadMoreMessages();
      }
    }
  }, [hasMoreMessages, isLoading, onLoadMoreMessages]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const formatDateHeader = (date) => {
    const messageDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (messageDate.toDateString() === today.toDateString()) {
      return 'امروز';
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'دیروز';
    } else {
      return messageDate.toLocaleDateString('fa-IR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  };

  const shouldShowDateHeader = (currentMessage, previousMessage) => {
    if (!previousMessage) return true;

    const currentDate = new Date(currentMessage.createdAt).toDateString();
    const previousDate = new Date(previousMessage.createdAt).toDateString();

    return currentDate !== previousDate;
  };

  const groupConsecutiveMessages = (messages) => {
    const grouped = [];
    let currentGroup = null;

    messages.forEach((message, index) => {
      const shouldGroup = currentGroup && currentGroup.senderId === message.senderId && new Date(message.createdAt) - new Date(currentGroup.lastMessage.createdAt) < 300000; // 5 minutes

      if (shouldGroup) {
        currentGroup.messages.push(message);
        currentGroup.lastMessage = message;
      } else {
        if (currentGroup) {
          grouped.push(currentGroup);
        }
        currentGroup = {
          senderId: message.senderId,
          senderName: message.senderName,
          senderFullName:message.senderFullName,
          senderAvatar: message.senderAvatar,
          messages: [message],
          lastMessage: message,
        };
      }
    });

    if (currentGroup) {
      grouped.push(currentGroup);
    }

    return grouped;
  };

  if (isLoading && messages.length === 0) {
    // فقط در بارگذاری اولیه کل صفحه پیام‌ها
    return (
      <div className="flex-grow-1 d-flex align-items-center justify-content-center p-3">
        <Spinner animation="border" />
      </div>
    );
  }

  const messageGroups = groupConsecutiveMessages(messages);

  return (
    <div ref={containerRef} className="flex-grow-1 overflow-auto p-3 chat-bg" style={{maxHeight: 'calc(100vh - 200px)' /* یا ارتفاع مناسب دیگر */}}>
      {isLoading &&
        messages.length > 0 && ( // نمایش لودینگ برای پیام‌های قدیمی‌تر
          <div className="text-center my-2">
            <Spinner animation="border" size="sm" />
          </div>
        )}
      {!isLoading &&
        hasMoreMessages &&
        messages.length > 0 && ( // دکمه برای اطمینان (اختیاری)
          <div className="text-center my-2">
            <Button variant="outline-secondary" size="sm" onClick={onLoadMoreMessages}>
              بارگذاری پیام‌های قدیمی‌تر
            </Button>
          </div>
        )}
      {messages.length === 0 ? (
        <div className="d-flex align-items-center justify-content-center h-100">
          <div className="text-center text-muted">
            <i className="bi bi-chat-text fs-1 mb-2"></i>
            <p>هنوز پیامی ارسال نشده است</p>
            <small>اولین پیام را ارسال کنید!</small>
          </div>
        </div>
      ) : (
        <>
          {messageGroups.map((group, groupIndex) => {
            const isFirstMessageOfGroupNewDate = groupIndex === 0 || shouldShowDateHeader(group.messages[0], messageGroups[groupIndex - 1]?.messages[0]);
            const showDateHeader = groupIndex === 0 || shouldShowDateHeader(group.messages[0], messageGroups[groupIndex - 1]?.messages[0]);

            return (
              <div key={`group-${groupIndex}-${group.messages[0]?.id || 'no-id'}`}>
                {isFirstMessageOfGroupNewDate && (
                  <div className="text-center my-3">
                    <small className="text-muted bg-light px-3 py-1 rounded-pill">{formatDateHeader(group.messages[0].createdAt)}</small>
                  </div>
                )}
                <div className="mb-1">
                  {' '}
                  {/* کاهش فاصله بین گروه‌های پیام */}
                  {group.messages.map((message, messageIndex) => (
                    <MessageItem
                      key={`message-${message.id}`}
                      message={message}
                      showSender={messageIndex === 0} // فقط برای اولین پیام گروه نام فرستنده نمایش داده شود
                      showAvatar={messageIndex === group.messages.length - 1} // فقط برای آخرین پیام گروه آواتار نمایش داده شود
                    />
                  ))}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  );
};

export default MessageList;
