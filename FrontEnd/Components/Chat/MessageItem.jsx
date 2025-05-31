// src/components/Chat/MessageItem.jsx
// Individual message item component

import React, {useState} from 'react';
import {Dropdown, Button} from 'react-bootstrap';
import {MessageDeliveryStatus, MessageType} from '../../types/chat';
import {getUserIdFromToken} from '../../utils/jwt';
import {formatFileSize} from '../../Utils/fileUtils';
import './Chat.css';

const MessageItem = ({message, showSender = true, showAvatar = true}) => {
  const [showFullTime, setShowFullTime] = useState(false);
  const token = localStorage.getItem('token');
  const currentUserId = getUserIdFromToken(token);
  const isOwnMessage = message.senderId === currentUserId;

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    if (showFullTime) {
      return date.toLocaleString('fa-IR');
    }
    return date.toLocaleTimeString('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderFileAttachment = (attachmentUrl, fileName, fileSize) => {
    const getFileIcon = (fileName) => {
      const extension = fileName.split('.').pop().toLowerCase();
      const icons = {
        pdf: 'bi-file-pdf',
        doc: 'bi-file-word',
        docx: 'bi-file-word',
        xls: 'bi-file-excel',
        xlsx: 'bi-file-excel',
        ppt: 'bi-file-ppt',
        pptx: 'bi-file-ppt',
        zip: 'bi-file-zip',
        rar: 'bi-file-zip',
        txt: 'bi-file-text',
        mp3: 'bi-file-music',
        wav: 'bi-file-music',
        mp4: 'bi-file-play',
        png: 'bi-file-image',
        jpg: 'bi-file-image',
        jpeg: 'bi-file-image',
        gif: 'bi-file-image',
      };
      return icons[extension] || 'bi-file-earmark';
    };

    return (
      <div className="file-attachment p-2 bg-light rounded">
        <div className="d-flex align-items-center">
          <i className={`bi ${getFileIcon(fileName)} fs-4 me-2`}></i>
          <div className="flex-grow-1 min-width-0">
            <div className="text-truncate">{fileName}</div>
            {fileSize && <small className="text-muted">{formatFileSize(fileSize)}</small>}
          </div>
          <Button variant="outline-primary" size="sm" className="ms-2" href={attachmentUrl} target="_blank" rel="noopener noreferrer">
            <i className="bi bi-download"></i>
          </Button>
        </div>
      </div>
    );
  };

  const renderMessageContent = () => {
    switch (message.type) {
      case MessageType.Text:
        return <div className="text-break">{message.content}</div>;

      case MessageType.Image:
        return (
          <div>
            <div className="position-relative">
              <img src={message.attachmentUrl} alt="Shared image" className="img-fluid rounded mb-1" style={{maxWidth: '300px', cursor: 'pointer'}} onClick={() => window.open(message.attachmentUrl, '_blank')} />
              <Button variant="light" size="sm" className="position-absolute top-0 end-0 m-1" href={message.attachmentUrl} download>
                <i className="bi bi-download"></i>
              </Button>
            </div>
            {message.content && <div className="text-break">{message.content}</div>}
          </div>
        );

      case MessageType.File:
        return (
          <div>
            {renderFileAttachment(message.attachmentUrl, message.fileName || 'فایل ضمیمه', message.fileSize)}
            {message.content && <div className="text-break mt-2">{message.content}</div>}
          </div>
        );

      case MessageType.Audio:
        return (
          <div>
            <audio controls className="w-100 mb-1">
              <source src={message.attachmentUrl} type="audio/mpeg" />
              مرورگر شما از پخش صوت پشتیبانی نمی‌کند.
            </audio>
            {message.content && <div className="text-break">{message.content}</div>}
            <Button variant="outline-primary" size="sm" className="mt-1" href={message.attachmentUrl} download>
              <i className="bi bi-download me-1"></i>
              دانلود فایل صوتی
            </Button>
          </div>
        );

      case MessageType.Video:
        return (
          <div>
            <div className="position-relative">
              <video controls className="img-fluid rounded mb-1" style={{maxWidth: '300px'}}>
                <source src={message.attachmentUrl} type="video/mp4" />
                مرورگر شما از پخش ویدیو پشتیبانی نمی‌کند.
              </video>
              <Button variant="light" size="sm" className="position-absolute top-0 end-0 m-1" href={message.attachmentUrl} download>
                <i className="bi bi-download"></i>
              </Button>
            </div>
            {message.content && <div className="text-break">{message.content}</div>}
          </div>
        );

      case MessageType.System:
        return (
          <div className="text-center">
            <small className="text-muted fst-italic">{message.content}</small>
          </div>
        );

      default:
        return <div>{message.content}</div>;
    }
  };

  const renderDeliveryStatusIcon = () => {
    if (!isOwnMessage || message.type === MessageType.System) return null;

    switch (message.deliveryStatus) {
      case MessageDeliveryStatus.Sent:
        return <i className="bi bi-check ms-1" title="ارسال شد"></i>; // یک تیک (خاکستری)
      // case MessageDeliveryStatus.Delivered: // اگر پیاده‌سازی شود
      //   return <i className="bi bi-check2 ms-1" title="تحویل داده شد"></i>; // دو تیک (خاکستری)
      case MessageDeliveryStatus.Read:
        return <i className="bi bi-check2-all ms-1 text-primary" title="خوانده شد"></i>; // دو تیک (آبی)
      default:
        return <i className="bi bi-clock ms-1" title="در حال ارسال..."></i>; // یا آیکون ارسال اولیه
    }
  };

  // System messages have different styling
  if (message.type === MessageType.System) {
    return (
      <div className="text-center my-2">
        <small className="text-muted bg-light px-3 py-1 rounded-pill">{message.content}</small>
      </div>
    );
  }

  return (
    <div className={`d-flex mb-1 message-item-wrapper ${isOwnMessage ? 'justify-content-start' : 'justify-content-end'}`}>
      {/* Avatar (for other users) */}
      {/* {!isOwnMessage && showAvatar && (
        <div className="me-2 flex-shrink-0">
          {message.senderAvatar ? (
            <img src={message.senderAvatar} alt={message.senderName} className="rounded-circle user-avatar" />
          ) : (
            <div className="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center user-avatar" style={{fontSize: '12px'}}>
              {message.senderName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )} */}

      {/* Message bubble */}
      <div className={`message-bubble ${isOwnMessage ? 'message-sent' : 'message-received'}`} style={{maxWidth: '70%'}}>
        {/* Sender name (for group chats) */}
        {/* {!isOwnMessage && showSender && (
          <div className="mb-1">
            <small className="text-muted fw-bold">{message.senderName}</small>
          </div>
        )} */}

        {/* Message content */}
        <div>
          {renderMessageContent()}

          {/* Message options dropdown */}
          {/* <Dropdown className="position-absolute top-0 end-0 mt-1 me-1">
            <Dropdown.Toggle variant="link" size="sm" className="p-0 border-0 text-muted" style={{fontSize: '12px'}}>
              <i className="bi bi-three-dots-vertical"></i>
            </Dropdown.Toggle>

            <Dropdown.Menu size="sm">
              <Dropdown.Item onClick={() => setShowFullTime(!showFullTime)} className="small">
                <i className="bi bi-clock me-1"></i>
                نمایش زمان کامل
              </Dropdown.Item>
              {isOwnMessage && (
                <>
                  <Dropdown.Item className="small">
                    <i className="bi bi-pencil me-1"></i>
                    ویرایش
                  </Dropdown.Item>
                  <Dropdown.Item className="small text-danger">
                    <i className="bi bi-trash me-1"></i>
                    حذف
                  </Dropdown.Item>
                </>
              )}
              <Dropdown.Item className="small">
                <i className="bi bi-reply me-1"></i>
                پاسخ
              </Dropdown.Item>
              <Dropdown.Item className="small">
                <i className="bi bi-share me-1"></i>
                فوروارد
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown> */}
        </div>

        {/* Time and status */}
        <div className={`mt-1 d-flex align-items-center ${isOwnMessage ? 'justify-content-end' : 'justify-content-start'}`}>
          <small className="text-muted message-time-text" onClick={() => setShowFullTime(!showFullTime)} style={{cursor: 'pointer'}}>
            {formatTime(message.createdAt)}
            {message.isEdited && (
              <span className="ms-1 fst-italic" style={{fontSize: '0.7rem'}}>
                (ویرایش شده)
              </span>
            )}
          </small>
          {isOwnMessage && renderDeliveryStatusIcon()}
        </div>
      </div>

      {/* Avatar placeholder for own messages */}
      {isOwnMessage && showAvatar && (
        <div className="ms-2" style={{width: '32px'}}>
          {/* Empty space for alignment */}
        </div>
      )}
    </div>
  );
};

export default MessageItem;
