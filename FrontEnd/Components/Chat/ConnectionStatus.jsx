export const ConnectionStatus = ({ isConnected }) => {
  return (
    <div className="d-flex align-items-center">
      <div
        className={`rounded-circle me-2 ${
          isConnected ? 'bg-success' : 'bg-danger'
        }`}
        style={{ width: '8px', height: '8px' }}
      ></div>
      <small className={`text-${isConnected ? 'success' : 'danger'}`}>
      </small>
    </div>
  );
};

export default ConnectionStatus;