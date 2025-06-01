// src/components/Chat/MessageItem.jsx
// Individual message item component

import React, {useState, useRef, useEffect} from 'react';
import {Dropdown, Button, Form, Spinner} from 'react-bootstrap';
import {MessageDeliveryStatus, MessageType} from '../../types/chat';
import {getUserIdFromToken} from '../../utils/jwt';
import {formatFileSize} from '../../Utils/fileUtils';
import {useChat} from '../../hooks/useChat';
import {OverlayTrigger, Popover} from 'react-bootstrap'; // For reaction picker
import EmojiPicker, {EmojiStyle} from 'emoji-picker-react';
import './Chat.css';

const MessageItem = ({message, showSender = true, showAvatar = true}) => {
  const {editMessage, deleteMessage, currentRoom, setReplyingToMessage, sendReaction, currentLoggedInUserId, showForwardModal} = useChat();
  const token = localStorage.getItem('token');
  const currentUserId = getUserIdFromToken(token);
  const isOwnMessage = message.senderId === currentUserId;

  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [showFullTime, setShowFullTime] = useState(false);
  const editInputRef = useRef(null);

  const handleForward = () => {
    if (showForwardModal) {
      showForwardModal(message.id); // Pass the message ID to be forwarded
    }
  };

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

  const handleReply = () => {
    if (setReplyingToMessage) {
      // Check if function exists in context
      setReplyingToMessage({
        id: message.id,
        content: message.content,
        senderName: message.senderName,
        senderFullName:message.senderFullName,
        type: message.type,
        attachmentUrl: message.attachmentUrl, // if you want to show preview of replied attachment
        fileName: message.fileName,
      });
    }
  };

  const handleReaction = (emojiObject) => {
    if (sendReaction) {
      sendReaction(message.id, message.chatRoomId, emojiObject.emoji);
    }
    // Close popover if used
    document.body.click(); // A way to close bootstrap popovers programmatically
  };

  const renderReactions = () => {
    if (!message.reactions || message.reactions.length === 0) return null;

    // Aggregate reactions by emoji
    const aggregatedReactions = message.reactions.reduce((acc, reaction) => {
      acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
      return acc;
    }, {});

    const currentUserReactionEmoji = message.reactions.find((r) => r.userId === currentLoggedInUserId)?.emoji;

    return (
      <div className="message-reactions mt-1 d-flex flex-wrap gap-1">
        {Object.entries(aggregatedReactions).map(([emoji, count]) => (
          <Button
            key={emoji}
            variant={currentUserReactionEmoji === emoji ? 'primary' : 'outline-secondary'}
            size="sm"
            className="rounded-pill py-0 px-2 d-flex align-items-center"
            style={{fontSize: '0.8rem', lineHeight: '1.2'}}
            onClick={() => handleReaction({emoji: emoji})} // Toggle reaction
            title={message.reactions
              .filter((r) => r.emoji === emoji)
              .map((r) => r.userName)
              .join(', ')}
          >
            <span style={{fontSize: '1rem', marginRight: '3px'}}>{emoji}</span> {count > 0 && count}
          </Button>
        ))}
      </div>
    );
  };

  const reactionPickerPopover = (
    <Popover id={`popover-reaction-${message.id}`} style={{zIndex: 1050}}>
      <Popover.Body style={{padding: '0.5rem'}}>
        <EmojiPicker
          onEmojiClick={(emojiObj) => handleReaction(emojiObj)}
          emojiStyle={EmojiStyle.NATIVE}
          height={300}
          width={280}
          searchDisabled
          skinTonesDisabled
          previewConfig={{showPreview: false}}
          categories={['smileys_people', 'animals_nature', 'food_drink', 'activities', 'objects']} // Customize categories
        />
      </Popover.Body>
    </Popover>
  );

  const renderRepliedMessage = () => {
    if (!message.replyToMessageId || !message.repliedMessageContent) return null;

    let displayContent = message.repliedMessageContent;
    if (message.repliedMessageType === MessageType.Image) {
      displayContent = 'تصویر';
    } else if (message.repliedMessageType === MessageType.File) {
      displayContent = `فایل: ${message.repliedMessageFileName || 'فایل ضمیمه'}`; // Assuming repliedMessageFileName is added to DTO if needed
    } // Add for other types like Video, Audio

    return (
      <div
        className="replied-message-preview bg-light p-2 rounded mb-1"
        style={{borderRight: '3px solid #0d6efd', fontSize: '0.9em'}}
        onClick={() => {
          /* Optional: scroll to original message */
        }}
      >
        <div className="fw-bold text-primary" style={{fontSize: '0.9rem'}}>
          {message.repliedMessageSenderName || 'کاربر'}
        </div>
        <div className="text-muted text-truncate" style={{fontSize: '0.85rem'}}>
          {displayContent}
        </div>
      </div>
    );
  };

  const renderMessageContentInternal = () => {
    if (message.isDeleted) {
      // Check if message is marked as deleted
      return <div className="text-muted fst-italic">[پیام حذف شد]</div>;
    }
    if (isEditing) {
      return (
        <div>
          <Form.Control
            ref={editInputRef}
            as="textarea"
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            rows={1}
            style={{resize: 'none', minHeight: '40px', maxHeight: '120px'}}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitEdit();
              } else if (e.key === 'Escape') {
                cancelEdit();
              }
            }}
          />
          <div className="mt-2">
            <Button variant="secondary" size="sm" onClick={cancelEdit} className="ms-2" disabled={isSubmittingEdit}>
              لغو
            </Button>
            <Button variant="primary" size="sm" onClick={submitEdit} disabled={isSubmittingEdit || editedContent.trim() === message.content || !editedContent.trim()}>
              {isSubmittingEdit ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : 'ذخیره'}
            </Button>
          </div>
        </div>
      );
    }

    switch (message.type) {
      case MessageType.Text:
        return (
          <div className="text-break" style={{whiteSpace: 'pre-wrap'}}>
            {message.content}
          </div>
        );

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
        return (
          <div className="text-break" style={{whiteSpace: 'pre-wrap'}}>
            {message.content}
          </div>
        );
    }
  };

  const renderMessageContent = () => {
    return (
      <>
        {renderRepliedMessage()}
        {renderMessageContentInternal()}
      </>
    );
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

  const handleEdit = () => {
    setIsEditing(true);
    setEditedContent(message.content); // Reset to original content on new edit attempt
  };

  const cancelEdit = () => {
    setIsEditing(false);
  };

  const submitEdit = async () => {
    if (editedContent.trim() === message.content || !editedContent.trim()) {
      setIsEditing(false);
      return;
    }
    setIsSubmittingEdit(true);
    try {
      await editMessage(message.id, message.chatRoomId, editedContent.trim());
      setIsEditing(false);
    } catch (error) {
      console.error('Error editing message:', error);
      // Optionally show an error to the user
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('آیا از حذف این پیام مطمئن هستید؟')) {
      try {
        await deleteMessage(message.id, message.chatRoomId);
        // UI update will be handled by SignalR listener in context
      } catch (error) {
        console.error('Error deleting message:', error);
      }
    }
  };

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.style.height = 'auto';
      editInputRef.current.style.height = editInputRef.current.scrollHeight + 'px';
    }
  }, [isEditing, editedContent]);

  // System messages have different styling
  if (message.type === MessageType.System) {
    return (
      <div className="text-center my-2">
        <small className="text-muted bg-light px-3 py-1 rounded-pill">{message.content}</small>
      </div>
    );
  }

  if (message.isDeleted && !isOwnMessage) {
    // If others delete their messages and you don't want to show options
    return (
      /* Render the deleted message placeholder */
      <div className={`d-flex mb-1 message-item-wrapper ${isOwnMessage ? 'justify-content-start' : 'justify-content-end'}`}>
        <div className={`message-bubble ${isOwnMessage ? 'message-sent' : 'message-received'}`} style={{maxWidth: '70%'}}>
          <div className="text-muted fst-italic">[پیام حذف شد]</div>
          <div className={`mt-1 d-flex align-items-center ${isOwnMessage ? 'justify-content-end' : 'justify-content-start'}`}>
            <small className="text-muted message-time-text" style={{cursor: 'pointer'}}>
              {formatTime(message.createdAt)}
            </small>
          </div>
        </div>
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
          {renderMessageContent()} {/* This now includes replied message preview */}
        </div>
        {renderReactions()} {/* Display reactions here, below content but inside bubble */}
        <div className={`mt-1 d-flex align-items-center justify-content-between`}>
          <div className="d-flex align-items-center gap-2">
            {/* Wrapper for time and status */}
            <small className="text-muted message-time-text" style={{cursor: 'pointer'}} title={formatTime(message.createdAt)}>
              {formatTime(message.createdAt)}
              {message.isEdited && !message.isDeleted && (
                <span className="ms-1 fst-italic" style={{fontSize: '0.7rem'}}>
                  (ویرایش شده)
                </span>
              )}
            </small>
            {isOwnMessage && !message.isDeleted && renderDeliveryStatusIcon()}
          </div>
          {!isEditing &&
            !message.isDeleted &&
            message.type !== MessageType.System && (
              <div className="d-flex align-items-center">
                <OverlayTrigger trigger="click" placement="top" overlay={reactionPickerPopover} rootClose>
                  <Button variant="link" size="sm" className="p-0 text-muted me-1" title="افزودن واکنش">
                    <i className="bi bi-emoji-smile"></i>
                  </Button>
                </OverlayTrigger>
                <Dropdown className="message-options-dropdown" align="end">
                  <Dropdown.Toggle variant="link" size="sm" bsPrefix="p-0 border-0 text-muted no-caret">
                    <i className="bi bi-three-dots-vertical"></i>
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    {/* Edit, Delete, Reply, Forward items */}
                    {isOwnMessage && (
                      <Dropdown.Item onClick={handleEdit} className="small">
                        <i className="bi bi-pencil me-2"></i>ویرایش
                      </Dropdown.Item>
                    )}
                    {isOwnMessage && (
                      <Dropdown.Item onClick={handleDelete} className="small text-danger">
                        <i className="bi bi-trash me-2"></i>حذف
                      </Dropdown.Item>
                    )}
                    <Dropdown.Item onClick={handleReply} className="small">
                      <i className="bi bi-reply me-2"></i>پاسخ
                    </Dropdown.Item>
                    <Dropdown.Item onClick={handleForward} className="small">
                      <i className="bi bi-arrow-right-short me-2"></i>فوروارد
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </div>
            )}
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
