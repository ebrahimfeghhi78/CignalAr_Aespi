// src/components/Chat/ChatRoomList.jsx
// Component for displaying list of chat rooms
import React, {useState, useEffect} from 'react';
import {ListGroup, Button, Form, Spinner, Badge, Dropdown} from 'react-bootstrap';
import {BiPlus, BiSearch} from 'react-icons/bi';
import {BsPeopleFill, BsFillPersonFill} from 'react-icons/bs';
import {useChat} from '../../hooks/useChat'; // Import useChat
import {chatApi} from '../../services/chatApi'; // Import chatApi

const ChatRoomList = ({rooms, currentRoom, onRoomSelect, onNewRoom, isLoading}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const {setCurrentRoom: contextSetCurrentRoom, createChatRoom, rooms: contextRooms} = useChat();

  // Filter rooms based on search term
  const filteredRooms = rooms.filter((room) => room.name.toLowerCase().includes(searchTerm.toLowerCase()) || (room.description && room.description.toLowerCase().includes(searchTerm.toLowerCase())));

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (userSearchTerm.trim().length >= 2) {
        setIsSearchingUsers(true);
        try {
          const users = await chatApi.searchUsers(userSearchTerm);
          setUserSearchResults(users || []);
        } catch (error) {
          console.error('Error searching users:', error);
          setUserSearchResults([]);
        } finally {
          setIsSearchingUsers(false);
        }
      } else {
        setUserSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [userSearchTerm]);

  const handleUserSelectForChat = async (selectedUser) => {
    setUserSearchTerm(''); // Clear search
    setUserSearchResults([]);

    // Check if a private chat with this user already exists
    const existingRoom = contextRooms.find(
      (room) =>
        !room.isGroup &&
        room.members && // Ensure members array exists (should be provided by GetChatRoomsQuery)
        room.members.some((member) => member.id === selectedUser.id) &&
        room.members.length === 2 // Private chats usually have 2 members (current user + selectedUser)
      // This part needs careful checking of how `room.members` is structured.
      // A more robust check would be to see if the room name matches selectedUser.userName (if that's the convention)
      // Or, if the backend returns participant IDs directly in the ChatRoomDto.
      // For now, let's assume the backend logic for finding existing rooms is primary.
    );

    // A simplified frontend check based on room name for non-group chats (assuming name = other user's name)
    const existingPrivateChat = contextRooms.find(
      (room) => !room.isGroup && room.name === selectedUser.userName // Or however private chats are named
    );

    if (existingPrivateChat) {
      onRoomSelect(existingPrivateChat);
    } else {
      try {
        // Create a new private chat room
        // The name of the room will be the other user's username for the creator.
        // The backend will handle setting the correct name for the other participant.
        const newRoomDto = await createChatRoom({
          name: selectedUser.userName, // Initial name for the creator
          isGroup: false,
          memberIds: [selectedUser.id],
          // regionId will be handled by backend based on creator's active region
        });
        if (newRoomDto) {
          // The useChat hook's createChatRoom should ideally update the rooms list via SignalR or an explicit dispatch.
          // If not, you might need to manually add/update the room in the local state or re-fetch rooms.
          // For now, we expect `createChatRoom` from context to handle state updates,
          // then we select the new room.
          onRoomSelect(newRoomDto); // Select the newly created room
        }
      } catch (error) {
        console.error('Error creating chat room:', error);
        // Handle error (e.g., show a notification)
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('fa-IR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (days === 1) {
      return 'دیروز';
    } else if (days < 7) {
      return `${days} روز پیش`;
    } else {
      return date.toLocaleDateString('fa-IR');
    }
  };

  return (
    <div className="d-flex flex-column h-100">
      <div className="p-3 border-bottom">
        <div className="d-flex gap-2 mb-2">
          {/* Room Filter Input */}
          <Form.Control type="text" placeholder="فیلتر چت‌ها..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} size="sm" className="search-input" />
          {/* New Group Button */}
          <Button variant="primary" size="sm" onClick={onNewRoom} className="flex-shrink-0" title="ایجاد گروه جدید">
            <BsPeopleFill size={18} /> <span className="d-none d-md-inline">گروه</span>
          </Button>
        </div>
        {/* User Search Input for Private Chat */}
        <Dropdown>
          <Dropdown.Toggle
            as={Form.Control}
            type="text"
            placeholder="جستجوی کاربر برای چت شخصی..."
            value={userSearchTerm}
            onChange={(e) => setUserSearchTerm(e.target.value)}
            size="sm"
            className="search-input mt-2"
          ></Dropdown.Toggle>
          <Dropdown.Menu show={userSearchResults.length > 0 || isSearchingUsers} style={{width: '100%'}}>
            {isSearchingUsers && <Dropdown.ItemText>در حال جستجو...</Dropdown.ItemText>}
            {userSearchResults.map((user) => (
              <Dropdown.Item key={user.id} onClick={() => handleUserSelectForChat(user)}>
                <div className="d-flex align-items-center">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.userName} className="rounded-circle me-2" style={{width: '30px', height: '30px'}} />
                  ) : (
                    <div className="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center me-2" style={{width: '30px', height: '30px', fontSize: '0.8rem'}}>
                      {user.userName?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span>
                    {user.userName} ({user.fullName})
                  </span>
                </div>
              </Dropdown.Item>
            ))}
            {!isSearchingUsers && userSearchTerm.length >= 2 && userSearchResults.length === 0 && <Dropdown.ItemText>کاربری یافت نشد.</Dropdown.ItemText>}
          </Dropdown.Menu>
        </Dropdown>
      </div>

      {/* Rooms List */}
      <div className="flex-grow-1 overflow-auto">
        {isLoading ? (
          <div className="d-flex justify-content-center p-4">
            <Spinner animation="border" size="sm" />
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="text-center p-4 text-muted">{searchTerm ? 'چت‌ی پیدا نشد' : 'هنوز چتی ندارید'}</div>
        ) : (
          <ListGroup variant="flush">
            {filteredRooms.map((room) => (
              <ListGroup.Item
                key={room.id}
                action
                active={currentRoom?.id === room.id}
                onClick={() => onRoomSelect(room)}
                className="border-0 border-bottom rounded-0 chat-room-list-item" // یک کلاس برای استایل‌دهی احتمالی
                // style={{ backgroundColor: room.unreadCount > 0 && currentRoom?.id !== room.id ? '#e9f5ff' : 'transparent' }} // هایلایت روم با پیام خوانده نشده
              >
                <div className="d-flex flex-row-reverse align-items-center">
                  {/* Room Avatar */}
                  <div className="me-3 flex-shrink-0">
                    {room.avatar ? (
                      <img src={room.avatar} alt={room.name} className="rounded-circle" style={{width: '45px', height: '45px'}} />
                    ) : (
                      <div className={`rounded-circle ${room.isGroup ? 'bg-success' : 'bg-primary'} text-white d-flex align-items-center justify-content-center`} style={{width: '45px', height: '45px'}}>
                        {room.isGroup ? <BsPeopleFill size={20} /> : <BsFillPersonFill size={20} />}
                      </div>
                    )}
                    {room.unreadCount > 0 && (
                      <Badge
                        bg="primary"
                        pill
                        className="position-absolute top-0 start-100 translate-middle p-1 border border-light rounded-circle" // موقعیت بهتر برای badge
                        style={{fontSize: '0.6rem', lineHeight: '1', minWidth: '18px', minHeight: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}
                        title={`${room.unreadCount} پیام خوانده نشده`}
                      >
                        {room.unreadCount > 9 ? '9+' : room.unreadCount}
                      </Badge>
                    )}
                  </div>

                  {/* Room Info */}
                  <div className="flex-grow-1 min-width-0">
                    <div className="d-flex justify-content-between align-items-start">
                      <h6 className={`mb-0 text-truncate fw-semibold ${room.unreadCount > 0 && currentRoom?.id !== room.id ? 'text-primary' : ''}`}>{room.name}</h6>
                      {room.lastMessageTime && ( // نمایش زمان آخرین پیام
                        <small className="text-muted flex-shrink-0 ms-2">{formatDate(room.lastMessageTime)}</small>
                      )}
                    </div>

                    <div className="d-flex justify-content-between align-items-center">
                      <small className={`text-muted text-truncate ${room.unreadCount > 0 && currentRoom?.id !== room.id ? 'fw-bold' : ''}`} style={{fontSize: '0.8rem'}}>
                        {room.lastMessageSenderName && room.lastMessageContent ? `${room.lastMessageSenderName}: ${room.lastMessageContent}` : room.description || (room.isGroup ? 'گروه' : 'چت شخصی')}
                      </small>
                      {/* Badge تعداد کل پیام‌ها (اختیاری) */}
                      {/* {room.messageCount > 0 && room.unreadCount === 0 && (
                        <Badge bg="secondary" pill className="flex-shrink-0 ms-2" style={{fontSize: '0.7rem'}}>
                          {room.messageCount > 99 ? '99+' : room.messageCount}
                        </Badge>
                      )} */}
                    </div>
                  </div>
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </div>
    </div>
  );
};

export default ChatRoomList;
