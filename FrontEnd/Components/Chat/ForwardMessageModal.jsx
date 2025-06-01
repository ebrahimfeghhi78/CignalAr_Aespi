// File: FrontEnd/Components/Chat/ForwardMessageModal.jsx (New File)
import React, {useState} from 'react';
import {Modal, Button, ListGroup, Form, Alert} from 'react-bootstrap';
import {useChat} from '../../hooks/useChat';

const ForwardMessageModal = ({show, onHide, messageIdToForward}) => {
  const {rooms, currentRoom, forwardMessage, isLoading: contextIsLoading, error: contextError, clearError} = useChat();
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isForwarding, setIsForwarding] = useState(false);
  const [forwardError, setForwardError] = useState('');

  const availableRooms = rooms.filter((room) => room.id !== currentRoom?.id); // Exclude current room
  const filteredRooms = availableRooms.filter((room) => room.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleForward = async () => {
    if (!selectedRoomId || !messageIdToForward) return;
    setIsForwarding(true);
    setForwardError('');
    if (contextError) clearError();

    try {
      await forwardMessage(messageIdToForward, selectedRoomId);
      onHide(); // Close modal on success
    } catch (err) {
      setForwardError(err.message || 'خطا در فوروارد پیام.');
      console.error('Forwarding error:', err);
    } finally {
      setIsForwarding(false);
    }
  };

  if (!show) return null;

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>فوروارد پیام به...</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {contextError && (
          <Alert variant="warning" onClose={clearError} dismissible>
            {contextError}
          </Alert>
        )}
        {forwardError && (
          <Alert variant="danger" onClose={() => setForwardError('')} dismissible>
            {forwardError}
          </Alert>
        )}
        <Form.Control type="text" placeholder="جستجوی چت..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="mb-3" />
        {contextIsLoading && filteredRooms.length === 0 && <p>در حال بارگذاری لیست چت‌ها...</p>}
        {!contextIsLoading && filteredRooms.length === 0 && <p>چت دیگری برای فوروارد یافت نشد.</p>}
        <ListGroup style={{maxHeight: '300px', overflowY: 'auto'}}>
          {filteredRooms.map((room) => (
            <ListGroup.Item key={room.id} action active={selectedRoomId === room.id} onClick={() => setSelectedRoomId(room.id)}>
              {room.name}
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={isForwarding}>
          انصراف
        </Button>
        <Button variant="primary" onClick={handleForward} disabled={!selectedRoomId || isForwarding}>
          {isForwarding ? 'در حال ارسال...' : 'فوروارد'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ForwardMessageModal;
