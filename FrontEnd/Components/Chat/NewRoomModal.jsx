// src/components/Chat/NewRoomModal.jsx
// Modal for creating new chat rooms

import React, {useState, useEffect} from 'react';
import {Modal, Form, Button, Alert, Tab, Tabs, ListGroup, Badge} from 'react-bootstrap';
import {useChat} from '../../hooks/useChat';
import {chatApi} from '../../services/chatApi';

const NewRoomModal = ({show, onHide, onRoomCreated}) => {
  const [activeTab, setActiveTab] = useState('personal');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isGroup: false,
    memberIds: [],
    regionId: null,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const {createChatRoom, onlineUsers} = useChat();

  // Reset form when modal opens/closes
  useEffect(() => {
    if (show) {
      setFormData({
        name: '', // Group name
        description: '',
        isGroup: true, // Default to group
        memberIds: [],
        regionId: null, // Will be set by backend based on active region
      });
      setSelectedUsers([]);
      setSearchQuery('');
      setSearchResults([]);
      setError('');
      // setActiveTab('group'); // No tabs needed if only for groups
    }
  }, [show]);

  // Search users with debounce
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        await searchUsers(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const searchUsers = async (query) => {
    try {
      setIsSearching(true);
      const users = await chatApi.searchUsers(query);
      setSearchResults(users);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputChange = (e) => {
    const {name, value, type, checked} = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleUserSelect = (user) => {
    // Modified for group members
    if (selectedUsers.find((u) => u.id === user.id)) {
      const newSelected = selectedUsers.filter((u) => u.id !== user.id);
      setSelectedUsers(newSelected);
      setFormData((prev) => ({
        ...prev,
        memberIds: newSelected.map((u) => u.id),
      }));
    } else {
      const newSelected = [...selectedUsers, user];
      setSelectedUsers(newSelected);
      setFormData((prev) => ({
        ...prev,
        memberIds: newSelected.map((u) => u.id),
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('نام گروه الزامی است');
      return;
    }
    if (selectedUsers.length === 0) {
      setError('حداقل یک عضو برای گروه انتخاب کنید');
      return;
    }

    try {
      setIsLoading(true);
      const roomData = {
        // Ensure this data is for a group
        name: formData.name,
        description: formData.description,
        isGroup: true,
        memberIds: selectedUsers.map((u) => u.id),
        // regionId is handled by backend
      };

      const newRoom = await createChatRoom(roomData);
      onRoomCreated(newRoom); // This should close the modal and potentially select the new room
    } catch (error) {
      setError(error.message || 'خطا در ایجاد گروه');
    } finally {
      setIsLoading(false);
    }
  };

  const removeSelectedUser = (userId) => {
    const newSelected = selectedUsers.filter((u) => u.id !== userId);
    setSelectedUsers(newSelected);
    setFormData((prev) => ({
      ...prev,
      memberIds: newSelected.map((u) => u.id),
    }));
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>گروه جدید</Modal.Title> {/* Changed title */}
      </Modal.Header>

      <Modal.Body>
        {/* Form for Group Creation directly, no tabs */}
        <Form onSubmit={handleSubmit}>
          {/* Group Name */}
          <Form.Group className="mb-3">
            <Form.Label>نام گروه *</Form.Label>
            <Form.Control type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="نام گروه را وارد کنید" required />
          </Form.Group>

          {/* Group Description */}
          <Form.Group className="mb-3">
            <Form.Label>توضیحات</Form.Label>
            <Form.Control as="textarea" rows={2} name="description" value={formData.description} onChange={handleInputChange} placeholder="توضیحات اختیاری برای گروه" />
          </Form.Group>

          {/* Search Users for group members */}
          <Form.Group className="mb-3">
            <Form.Label>افزودن اعضا</Form.Label>
            <Form.Control type="text" placeholder="نام یا نام کاربری را وارد کنید..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </Form.Group>

          {/* Selected Members Preview */}
          {selectedUsers.length > 0 && (
            <div className="mb-3">
              <Form.Label>اعضای انتخاب شده ({selectedUsers.length})</Form.Label>
              <div className="d-flex flex-wrap gap-2">
                {selectedUsers.map((user) => (
                  <Badge key={user.id} bg="primary" className="d-flex align-items-center gap-1 p-2">
                    {user.userName}
                    <Button variant="link" size="sm" className="p-0 text-white" onClick={() => removeSelectedUser(user.id)}>
                      <i className="bi bi-x"></i>
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Search Results for group members */}
          {(isSearching || searchResults.length > 0) && (
            <div className="mb-3">
              <Form.Label>نتایج جستجو</Form.Label>
              {isSearching && <div className="text-center text-muted">در حال جستجو...</div>}
              <ListGroup style={{maxHeight: '200px', overflowY: 'auto'}}>
                {searchResults.map((user) => {
                  const isSelected = selectedUsers.some((su) => su.id === user.id);
                  return (
                    <ListGroup.Item key={user.id} action active={isSelected} onClick={() => handleUserSelect(user)} className="d-flex align-items-center">
                      {/* ... user display with avatar and name ... */}
                      <div className="me-3">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.userName} className="rounded-circle" style={{width: '32px', height: '32px'}} />
                        ) : (
                          <div className="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center" style={{width: '32px', height: '32px', fontSize: '0.8rem'}}>
                            {user.userName?.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-grow-1">
                        <div className="fw-semibold">{user.userName}</div>
                        {user.fullName && <small className="text-muted">{user.fullName}</small>}
                      </div>
                      {isSelected && <i className="bi bi-check-circle-fill text-primary ms-auto"></i>}
                    </ListGroup.Item>
                  );
                })}
              </ListGroup>
            </div>
          )}
          {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && <div className="text-muted mb-3">کاربری یافت نشد.</div>}
        </Form>
        {/* Error Alert */}
        {error && (
          <Alert variant="danger" className="mt-3">
            {error}
          </Alert>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          انصراف
        </Button>
        <Button variant="primary" type="submit" onClick={handleSubmit} disabled={isLoading || !formData.name.trim() || selectedUsers.length === 0}>
          {isLoading ? 'در حال ایجاد...' : 'ایجاد گروه'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default NewRoomModal;
