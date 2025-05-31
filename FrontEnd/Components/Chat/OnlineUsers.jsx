import React from 'react';
import {Badge} from 'react-bootstrap'; // Assuming ListGroup is not strictly needed if used differently

// Component for displaying a list of online users
const OnlineUsers = ({users = []}) => {
  if (!users || users.length === 0) {
    return <div className="p-3 text-center text-muted small">در حال حاضر کاربری آنلاین نیست.</div>;
  }

  return (
    <div className="online-users-section border-top">
      {' '}
      {/* Added class for potential specific styling */}
      <div className="p-3 pb-2">
        <h6 className="text-muted mb-2 d-flex justify-content-between align-items-center">
          <span>کاربران آنلاین</span>
          <Badge bg="success" pill className="ms-2">
            {users.length}
          </Badge>
        </h6>
        <div style={{maxHeight: '150px', overflowY: 'auto'}} className="online-users-list">
          {users.map((user) => (
            <div key={user.id} className="d-flex align-items-center mb-2 p-1 rounded hover-bg-light">
              {' '}
              {/* Added hover effect class */}
              <div className="me-2 position-relative flex-shrink-0">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.userName} className="user-avatar" style={{width: '32px', height: '32px'}} />
                ) : (
                  <div className="user-avatar bg-secondary" style={{width: '32px', height: '32px', fontSize: '0.8rem'}}>
                    {user.userName?.charAt(0).toUpperCase() || '?'}
                  </div>
                )}
                {/* Online indicator dot */}
                <div className="position-absolute bg-success rounded-circle border border-white" style={{width: '10px', height: '10px', bottom: '0px', right: '0px'}} title="آنلاین"></div>
              </div>
              <small className="text-truncate" title={user.userName}>
                {user.userName}
              </small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OnlineUsers;
