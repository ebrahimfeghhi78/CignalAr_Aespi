// src/components/Chat/Chat.jsx
// Main chat component that brings everything together

import React, {useEffect, useState, useCallback} from 'react'; // useCallback اضافه شد
import {Container, Row, Col, Card, Alert} from 'react-bootstrap'; // Alert برای نمایش خطا
import {useChat} from '../../hooks/useChat';
import ChatRoomList from './ChatRoomList.jsx';
import MessageList from './MessageList.jsx';
import MessageInput from './MessageInput.jsx';
import NewRoomModal from './NewRoomModal.jsx';
import ConnectionStatus from './ConnectionStatus'; // برای نمایش وضعیت اتصال
import OnlineUsers from './OnlineUsers'; // برای نمایش کاربران آنلاین
import ForwardMessageModal from './ForwardMessageModal';
import TypingIndicatorComponent from './TypingIndicator';

const Chat = ({forceRoomId}) => {
  const {
    currentRoom,
    rooms,
    messages,
    typingUsers,
    currentLoggedInUserId,
    isLoading,
    error,
    isConnected,
    onlineUsers, // isConnected و onlineUsers اضافه شد
    loadChatRooms,
    loadMessages,
    setCurrentRoom,
    loadOnlineUsers,
    clearError, // توابع از کانتکست
    isForwardModalVisible,
    hideForwardModal,
    messageIdToForward,
  } = useChat();
  const [showNewRoomModal, setShowNewRoomModal] = useState(false);

  // Load initial data on mount
  useEffect(() => {
    loadChatRooms();
    loadOnlineUsers();
  }, [loadChatRooms, loadOnlineUsers]); // این توابع باید با useCallback در کانتکست تعریف شده باشند

  // Handle forced room when rooms are loaded or forceRoomId changes
  useEffect(() => {
    if (forceRoomId && rooms && rooms.length > 0) {
      const forcedRoom = rooms.find((r) => r.id.toString() === forceRoomId.toString());
      if (forcedRoom) {
        // فقط اگر روم فعلی نیست یا هنوز رومی انتخاب نشده، آن را تنظیم کن
        if (!currentRoom || currentRoom.id.toString() !== forceRoomId.toString()) {
          setCurrentRoom(forcedRoom);
        }
      }
    }
  }, [forceRoomId, rooms, setCurrentRoom, currentRoom]);

  // Load messages when current room changes
  const handleLoadMessages = useCallback(
    (roomId, page, pageSize, loadOlder = false) => {
      if (roomId) {
        loadMessages(roomId, page, pageSize, loadOlder);
      }
    },
    [loadMessages]
  );

  useEffect(() => {
    if (currentRoom) {
      handleLoadMessages(currentRoom.id, 1, 20, false); // بارگذاری صفحه اول پیام‌ها
    }
  }, [currentRoom, handleLoadMessages]);

  const handleRoomSelect = useCallback(
    (room) => {
      setCurrentRoom(room);
    },
    [setCurrentRoom]
  );

  const handleNewRoomCreated = useCallback(
    (newRoom) => {
      // setCurrentRoom(newRoom); // دیگر لازم نیست، سرور آپدیت می‌کند و لیست روم‌ها خودکار به‌روز می‌شود
      setShowNewRoomModal(false);
      // اگر می‌خواهید بلافاصله روم جدید انتخاب شود، می‌توانید این خط را نگه دارید
      // اما بهتر است به آپدیت از سرور تکیه کنید و شاید کاربر بخواهد همان روم قبلی فعال بماند
    },
    [
      /*setCurrentRoom*/
    ]
  );

  // rooms قبلاً در کانتکست مرتب‌سازی شده است
  // const roomsSorted = [...rooms].sort((a, b) => { ... }); // دیگر لازم نیست

  return (
    <Container fluid className="h-100 py-3" style={{minHeight: 'calc(100vh - 56px)'}}>
      {/* 56px ارتفاع احتمالی Navbar */}
      <Row className="h-100 flex-row-reverse gx-2">
        {/* gx-2 برای فاصله کم بین ستون‌ها */}
        <Col lg={3} md={4} className="h-100 order-1 order-lg-0 d-flex flex-column">
          <Card className="flex-grow-1 d-flex flex-column">
            <Card.Header className="d-flex justify-content-between align-items-center py-2">
              <h5 className="mb-0 fs-6">چت‌ها</h5>
              <ConnectionStatus isConnected={isConnected} />
            </Card.Header>
            <Card.Body className="p-0 d-flex flex-column flex-grow-1" style={{overflowY: 'hidden'}}>
              <ChatRoomList
                rooms={rooms} // rooms از کانتکست که مرتب شده است
                currentRoom={currentRoom}
                onRoomSelect={handleRoomSelect}
                onNewRoom={() => setShowNewRoomModal(true)}
                isLoading={isLoading && rooms.length === 0} // لودینگ فقط برای بار اول
              />
              {/* نمایش کاربران آنلاین در پایین لیست چت‌ها */}
              {/* <OnlineUsers users={onlineUsers} /> */}
            </Card.Body>
          </Card>
        </Col>
        <Col lg={9} md={8} className="h-100 order-0 order-lg-1 d-flex flex-column">
          <Card className="flex-grow-1 d-flex flex-column">
            {currentRoom ? (
              <>
                <Card.Header className="py-2">
                  <div className="d-flex flex-row-reverse align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                      <div className="me-3">
                        {currentRoom.avatar ? (
                          <img src={currentRoom.avatar} alt={currentRoom.name} className="rounded-circle" style={{width: '40px', height: '40px'}} />
                        ) : (
                          <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" style={{width: '40px', height: '40px'}}>
                            {currentRoom.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <h6 className="mb-0">{currentRoom.name}</h6>
                        {currentRoom.description && <small className="text-muted">{currentRoom.description}</small>}
                      </div>
                    </div>
                    <div>
                      {typingUsers[currentRoom.id] &&
                        typingUsers[currentRoom.id].filter((u) => u.userId !== currentLoggedInUserId).length > 0 && ( // Filter out self
                          <TypingIndicatorComponent users={typingUsers[currentRoom.id].filter((u) => u.userId !== currentLoggedInUserId)} />
                        )}
                    </div>
                  </div>
                </Card.Header>
                <Card.Body className="p-0 d-flex flex-column flex-grow-1" style={{overflowY: 'hidden'}}>
                  <MessageList
                    messages={messages[currentRoom.id]?.items || []}
                    typingUsers={typingUsers[currentRoom.id] || []}
                    isLoading={isLoading} 
                    hasMoreMessages={messages[currentRoom.id]?.hasMore || false}
                    onLoadMoreMessages={() => {
                      if (messages[currentRoom.id]?.hasMore) {
                        const nextPage = (messages[currentRoom.id]?.currentPage || 0) + 1;
                        handleLoadMessages(currentRoom.id, nextPage, 20, true);
                      }
                    }}
                  />
                  <MessageInput roomId={currentRoom.id} />
                </Card.Body>
              </>
            ) : (
              <Card.Body className="d-flex align-items-center justify-content-center">
                <div className="text-center text-muted">
                  <i className="bi bi-chat-dots fs-1 mb-3"></i>
                  <h5>یک چت را انتخاب کنید</h5>
                  <p>برای شروع گفتگو، یکی از چت‌های موجود را انتخاب کنید یا چت جدید ایجاد کنید.</p>
                </div>
              </Card.Body>
            )}
          </Card>
        </Col>
      </Row>
      {/* New Room Modal */}
      <NewRoomModal show={showNewRoomModal} onHide={() => setShowNewRoomModal(false)} onRoomCreated={handleNewRoomCreated} />

      {isForwardModalVisible && messageIdToForward && <ForwardMessageModal show={isForwardModalVisible} onHide={hideForwardModal} messageIdToForward={messageIdToForward} />}

      {error && (
        <div className="position-fixed bottom-0 end-0 p-3" style={{zIndex: 1050}}>
          <Alert variant="danger" onClose={clearError} dismissible>
            {error}
          </Alert>
        </div>
      )}
    </Container>
  );
};

export default Chat;
