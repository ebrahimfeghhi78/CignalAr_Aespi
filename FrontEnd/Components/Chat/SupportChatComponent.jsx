import React, { useState, useEffect } from 'react';
import { Card, Spinner, Alert } from 'react-bootstrap';
import { useChat } from '../../hooks/useChat';
import MessageList from '../Chat/MessageList';
import SupportMessageInput from './SupportMessageInput';
import secureFileApi from '../../api/secureFileApi';

// Support chat constants
const SUPPORT_AGENT_ID = 'd38189a4-4aa2-49d1-9245-68c18bc249d3';

// Get guest info from localStorage or generate new
const getGuestInfo = () => {
  let guestInfo = localStorage.getItem('guestInfo');
  if (!guestInfo) {
    return null;
  }
  return JSON.parse(guestInfo);
};

const SupportChatComponent = () => {
  const { rooms, messages, setCurrentRoom, typingUsers, loadChatRooms, loadMessages, createChatRoom, isLoading, error } = useChat();
  const [supportRoom, setSupportRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [localError, setLocalError] = useState(null);

  // Get guest info on mount
  const guestInfo = getGuestInfo();
  
  // First, try to find or create a support room
  useEffect(() => {
    const findOrCreateSupportRoom = async () => {
      try {
        // Verify we have guest info
        if (!guestInfo) {
          throw new Error('No guest information found');
        }

        await loadChatRooms();
        
        // Find the support room for this guest
        let room = rooms.find(r => 
          r.isSupportRoom === true && 
          r.members?.some(m => m.email === guestInfo.email)
        );

        // If no support room exists, create a new one
        if (!room) {
          room = await createChatRoom({
            name: 'پشتیبانی',
            description: `گفتگو با ${guestInfo.fullName}`,
            isGroup: false,
            isSupportRoom: true,
            guestInfo: guestInfo, // Pass guest info to backend
            memberIds: [SUPPORT_AGENT_ID],
            metadata: {
              guestEmail: guestInfo.email,
              guestPhone: guestInfo.phone,
              guestId: guestInfo.id
            }
          });
        }

        if (!room) {
          throw new Error('Failed to create or find support chat room');
        }

        setSupportRoom(room);
        setCurrentRoom(room);
        await loadMessages(room.id);
      } catch (err) {
        console.error('Error setting up support chat:', err);
        setLocalError('متأسفانه در برقراری ارتباط با پشتیبانی مشکلی پیش آمده است. لطفاً دوباره تلاش کنید.');
      } finally {
        setLoading(false);
      }
      if (!guestInfo) {
        setLocalError('اطلاعات کاربر مهمان یافت نشد. لطفاً صفحه را رفرش کنید.');
        setLoading(false);
        return;
      }
    };

    findOrCreateSupportRoom();
  }, [guestInfo]); // Run when guest info changes
  if (loading || isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (error || localError) {
    return (
      <Alert variant="danger" className="m-3">
        {localError || 'خطا در برقراری ارتباط با پشتیبانی. لطفا دوباره تلاش کنید.'}
      </Alert>
    );
  }

  if (!supportRoom) {
    return (
      <Alert variant="warning" className="m-3">
        در حال حاضر امکان ارتباط با پشتیبانی وجود ندارد.
      </Alert>
    );
  }

  return (
    <Card className="h-100 border-0 shadow-sm">
      <Card.Header className="bg-primary text-white py-3">
        <div className="d-flex align-items-center">
          <div className="rounded-circle bg-white text-primary d-flex align-items-center justify-content-center me-2" 
               style={{ width: 40, height: 40, fontSize: '1.2rem' }}>
            <i className="bi bi-headset" />
          </div>
          <div>
            <h6 className="mb-0">پشتیبانی آنلاین</h6>
            <small>پاسخگوی سوالات شما هستیم</small>
          </div>
        </div>
      </Card.Header>
      <Card.Body className="p-0">
        <div className="chat-messages-container" style={{ height: 400, overflow: 'auto' }}>
          <MessageList 
            messages={messages[supportRoom.id] || []} 
            typingUsers={typingUsers[supportRoom.id] || []} 
            isLoading={isLoading} 
          />
        </div>
        <div className="border-top">
          <SupportMessageInput roomId={supportRoom.id} />
        </div>
      </Card.Body>
    </Card>
  );
};

export default SupportChatComponent;
