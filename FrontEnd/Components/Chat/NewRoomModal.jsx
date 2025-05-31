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
        name: '',
        description: '',
        isGroup: false,
        memberIds: [],
        regionId: null,
      });
      setSelectedUsers([]);
      setSearchQuery('');
      setSearchResults([]);
      setError('');
      setActiveTab('personal');
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
    if (activeTab === 'personal') {
      // For personal chat, only allow one user
      setSelectedUsers([user]);
      setFormData((prev) => ({
        ...prev,
        name: user.userName,
        memberIds: [user.id],
        isGroup: false,
      }));
    } else {
      // For group chat, allow multiple users
      if (selectedUsers.find((u) => u.id === user.id)) {
        // Remove user
        const newSelected = selectedUsers.filter((u) => u.id !== user.id);
        setSelectedUsers(newSelected);
        setFormData((prev) => ({
          ...prev,
          memberIds: newSelected.map((u) => u.id),
        }));
      } else {
        // Add user
        const newSelected = [...selectedUsers, user];
        setSelectedUsers(newSelected);
        setFormData((prev) => ({
          ...prev,
          memberIds: newSelected.map((u) => u.id),
          isGroup: true,
        }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (activeTab === 'personal' && selectedUsers.length === 0) {
      setError('لطفاً یک کاربر انتخاب کنید');
      return;
    }

    if (activeTab === 'group') {
      if (!formData.name.trim()) {
        setError('نام گروه الزامی است');
        return;
      }
      if (selectedUsers.length === 0) {
        setError('حداقل یک عضو برای گروه انتخاب کنید');
        return;
      }
    }

    try {
      setIsLoading(true);
      const roomData = {
        ...formData,
        isGroup: activeTab === 'group',
      };

      const newRoom = await createChatRoom(roomData);
      onRoomCreated(newRoom);
    } catch (error) {
      setError(error.message || 'خطا در ایجاد چت');
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
        <Modal.Title>چت جدید</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-3">
          <Tab eventKey="personal" title="چت شخصی">
            <Form onSubmit={handleSubmit}>
              {/* Search Users */}
              <Form.Group className="mb-3">
                <Form.Label>جستجوی کاربران</Form.Label>
                <Form.Control type="text" placeholder="نام یا نام کاربری را وارد کنید..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                <Form.Text className="text-muted">حداقل 2 کاراکتر وارد کنید</Form.Text>
              </Form.Group>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mb-3">
                  <Form.Label>نتایج جستجو</Form.Label>
                  <ListGroup style={{maxHeight: '200px', overflowY: 'auto'}}>
                    {searchResults.map((user) => {
                      const isUserOnline = onlineUsers.some((onlineUser) => onlineUser.id === user.id); // بررسی آنلاین بودن
                      return (
                        <ListGroup.Item key={user.id} action active={selectedUsers.some((u) => u.id === user.id)} onClick={() => handleUserSelect(user)} className="d-flex align-items-center">
                          <div className="me-3">
                            {user.avatar ? (
                              <img src={user.avatar} alt={user.userName} className="rounded-circle" style={{width: '40px', height: '40px'}} />
                            ) : (
                              <div className="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center" style={{width: '40px', height: '40px'}}>
                                {user.userName.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex-grow-1">
                            <div className="fw-semibold">{user.userName}</div>
                            {user.fullName && <small className="text-muted">{user.fullName}</small>}
                          </div>
                          {isUserOnline && ( // نمایش وضعیت آنلاین
                            <Badge bg="success" pill className="ms-2">
                              آنلاین
                            </Badge>
                          )}
                        </ListGroup.Item>
                      );
                    })}
                  </ListGroup>
                </div>
              )}

              {isSearching && <div className="text-center text-muted mb-3">در حال جستجو...</div>}

              {/* Selected User */}
              {selectedUsers.length > 0 && (
                <div className="mb-3">
                  <Form.Label>کاربر انتخاب شده</Form.Label>
                  <div className="d-flex align-items-center p-2 bg-light rounded">
                    <div className="me-3">
                      {selectedUsers[0].avatar ? (
                        <img src={selectedUsers[0].avatar} alt={selectedUsers[0].userName} className="rounded-circle" style={{width: '40px', height: '40px'}} />
                      ) : (
                        <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" style={{width: '40px', height: '40px'}}>
                          {selectedUsers[0].userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-grow-1">
                      <div className="fw-semibold">{selectedUsers[0].userName}</div>
                      {selectedUsers[0].fullName && <small className="text-muted">{selectedUsers[0].fullName}</small>}
                    </div>
                  </div>
                </div>
              )}
            </Form>
          </Tab>

          <Tab eventKey="group" title="گروه">
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

              {/* Search Users */}
              <Form.Group className="mb-3">
                <Form.Label>جستجوی اعضا</Form.Label>
                <Form.Control type="text" placeholder="نام یا نام کاربری را وارد کنید..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </Form.Group>

              {/* Selected Members */}
              {searchResults.length > 0 && (
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

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mb-3">
                  <Form.Label>نتایج جستجو</Form.Label>
                  <ListGroup style={{maxHeight: '200px', overflowY: 'auto'}}>
                    {searchResults.map((user) => {
                      const isUserOnline = onlineUsers.some((onlineUser) => onlineUser.id === user.id); // بررسی آنلاین بودن
                      return (
                        <ListGroup.Item key={user.id} action active={selectedUsers.some((u) => u.id === user.id)} onClick={() => handleUserSelect(user)} className="d-flex align-items-center">
                          <div className="me-3">
                            {user.avatar ? (
                              <img src={user.avatar} alt={user.userName} className="rounded-circle" style={{width: '32px', height: '32px'}} />
                            ) : (
                              <div className="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center" style={{width: '32px', height: '32px'}}>
                                {user.userName.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex-grow-1">
                            <div className="fw-semibold">{user.userName}</div>
                            {user.fullName && <small className="text-muted">{user.fullName}</small>}
                          </div>
                          {isUserOnline &&
                            !selectedUsers.some((su) => su.id === user.id) && ( // نمایش وضعیت آنلاین اگر انتخاب نشده
                              <Badge bg="success" pill className="ms-auto me-2">
                                آنلاین
                              </Badge>
                            )}
                          {selectedUsers.some((u) => u.id === user.id) && <i className="bi bi-check-circle-fill text-primary ms-auto"></i>}
                        </ListGroup.Item>
                      );
                    })}
                  </ListGroup>
                </div>
              )}
            </Form>
          </Tab>
        </Tabs>

        {/* Error Alert */}
        {error && (
          <Alert variant="danger" className="mb-3">
            {error}
          </Alert>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          انصراف
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={isLoading || (activeTab === 'personal' ? selectedUsers.length === 0 : !formData.name.trim() || selectedUsers.length === 0)}>
          {isLoading ? 'در حال ایجاد...' : 'ایجاد چت'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default NewRoomModal;
