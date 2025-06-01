const TypingIndicator = ({ users }) => {
  if (!users || users.length === 0) return null;

  const getTypingText = () => {
    if (users.length === 1) {
      return `در حال تایپ`;
    } else if (users.length === 2) {
      return `${users[0].userName} و ${users[1].userName} در حال تایپ هستند...`;
    } else {
      return `${users.length} نفر در حال تایپ هستند...`;
    }
  };

  return (
    <div className="d-flex align-items-center mb-2">
      <div className="me-3" style={{ width: '32px' }}>
        <div className="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
      <div className="bg-light rounded p-2 flex-grow-1">
        <small className="text-muted fst-italic">
          {getTypingText()}
        </small>
      </div>
    </div>
  );
};

export default TypingIndicator;