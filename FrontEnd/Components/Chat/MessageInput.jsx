// src/components/Chat/MessageInput.jsx
// Message input component with file attachment support

import React, {useState, useRef, useEffect} from 'react';
import {Form, Button, Dropdown, ProgressBar, Alert} from 'react-bootstrap';
import {useChat} from '../../hooks/useChat';
import {MessageType} from '../../types/chat';
import {BsSend} from 'react-icons/bs';
import {IoSend} from 'react-icons/io5';
import secureFileApi from '../../api/secureFileApi';
import EmojiPicker, {EmojiStyle} from 'emoji-picker-react';
import {BsEmojiSmile} from 'react-icons/bs';

const MessageInput = ({roomId}) => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  const {sendMessage, startTyping, stopTyping, replyingToMessage, clearReplyingToMessage} = useChat();
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [message]);

  // Handle typing indicator
  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      startTyping(roomId);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      stopTyping(roomId);
    }, 1000);
  };

  // Cleanup typing timeout
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTyping) {
        stopTyping(roomId);
      }
    };
  }, [roomId, isTyping, stopTyping]);

  const onEmojiClick = (emojiObject, event) => {
    setMessage((prevMessage) => prevMessage + emojiObject.emoji);
    setShowEmojiPicker(false); // Optionally close picker after selection
    textareaRef.current?.focus();
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    handleTyping();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() && attachments.length === 0) return;
    setError('');
    try {
      let messageType = MessageType.Text;
      let attachmentData = null;

      // Handle file attachment
      if (attachments.length > 0) {
        const attachment = attachments[0];
        const uploadResult = await uploadFile(attachment);
        attachmentData = {
          url: uploadResult.url,
          fileName: uploadResult.fileName,
          fileSize: uploadResult.fileSize,
        };

        if (attachment.type.startsWith('image/')) {
          messageType = MessageType.Image;
        } else if (attachment.type.startsWith('video/')) {
          messageType = MessageType.Video;
        } else if (attachment.type.startsWith('audio/')) {
          messageType = MessageType.Audio;
        } else {
          messageType = MessageType.File;
        }
      }

      await sendMessage(
        roomId,
        message.trim(),
        messageType,
        attachmentData?.url,
        attachmentData ? {fileName: attachmentData.fileName, fileSize: attachmentData.fileSize} : null,
        replyingToMessage ? replyingToMessage.id : null // Pass replyToMessageId
      );
      setMessage('');
      setAttachments([]);
      setIsTyping(false);
      if (clearReplyingToMessage) clearReplyingToMessage(); // Clear reply state
    } catch (error) {
      setError('خطا در ارسال پیام: ' + error.message);
    }
  };

  const renderReplyingToPreview = () => {
    if (!replyingToMessage) return null;

    let displayContent = replyingToMessage.content;
    if (replyingToMessage.type === MessageType.Image) {
      displayContent = 'تصویر';
    } else if (replyingToMessage.type === MessageType.File) {
      displayContent = `فایل: ${replyingToMessage.fileName || 'فایل ضمیمه'}`;
    } // Add for other types like Video, Audio

    return (
      <div className="replying-to-preview alert alert-info p-2 mb-2">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <small className="fw-bold d-block">پاسخ به: {replyingToMessage.senderName}</small>
            <small className="text-muted text-truncate d-block">{displayContent}</small>
          </div>
          <Button variant="link" size="sm" className="text-danger p-0" onClick={clearReplyingToMessage}>
            <i className="bi bi-x-lg"></i>
          </Button>
        </div>
      </div>
    );
  };

  const uploadFile = async (file) => {
    setUploading(true);
    setUploadProgress(0);

    try {
      // استفاده از secureFileApi برای آپلود فایل
      const result = await secureFileApi.uploadFile(file, roomId, 'chat');

      // شبیه‌سازی پیشرفت آپلود
      for (let i = 0; i <= 100; i += 10) {
        setUploadProgress(i);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      return {
        url: result.url,
        fileName: file.name,
        fileSize: file.size,
      };
    } catch (error) {
      setError('خطا در آپلود فایل: ' + (error.message || 'خطای ناشناخته'));
      throw error;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setAttachments(files.slice(0, 1)); // Only allow one file at a time
    }
  };

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType) => {
    if (fileType.startsWith('image/')) return 'bi-image';
    if (fileType.startsWith('video/')) return 'bi-camera-video';
    if (fileType.startsWith('audio/')) return 'bi-music-note';
    if (fileType.includes('pdf')) return 'bi-file-pdf';
    if (fileType.includes('word')) return 'bi-file-word';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'bi-file-excel';
    return 'bi-file-earmark';
  };

  return (
    <div className="border-top p-3 position-relative">
      {/* Error Alert */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')} className="mb-2">
          {error}
        </Alert>
      )}
      {/* Upload Progress */}
      {uploading && (
        <div className="mb-2">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <small className="text-muted">در حال آپلود...</small>
            <small className="text-muted">{uploadProgress}%</small>
          </div>
          <ProgressBar now={uploadProgress} size="sm" />
        </div>
      )}
      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="mb-2">
          {attachments.map((file, index) => (
            <div key={index} className="d-flex align-items-center bg-light rounded p-2">
              <i className={`bi ${getFileIcon(file.type)} me-2`}></i>
              <div className="flex-grow-1 min-width-0">
                <div className="text-truncate small">{file.name}</div>
                <div className="text-muted" style={{fontSize: '0.75rem'}}>
                  {formatFileSize(file.size)}
                </div>
              </div>
              <Button variant="link" size="sm" className="text-danger p-0 ms-2" onClick={() => removeAttachment(index)}>
                <i className="bi bi-x-lg"></i>
              </Button>
            </div>
          ))}
        </div>
      )}
      {renderReplyingToPreview()}

      {showEmojiPicker && (
        <div style={{position: 'absolute', bottom: '60px', right: '10px', zIndex: 1000}}>
          {' '}
          {/* Adjust positioning as needed */}
          <EmojiPicker
            onEmojiClick={onEmojiClick}
            autoFocusSearch={false}
            emojiStyle={EmojiStyle.APPLE} // Or other styles like GOOGLE, APPLE
            height={350}
            width="100%"
          />
        </div>
      )}

      {/* Message Input */}
      <div className="d-flex flex-row-reverse align-items-end gap-2">
        {/* Emoji Button */}
        <Button variant="outline-secondary" size="sm" className="rounded-circle" style={{width: '40px', height: '40px'}} onClick={() => setShowEmojiPicker(!showEmojiPicker)} title="افزودن اموجی">
          <BsEmojiSmile size={20} />
        </Button>
        {/* Attachment Dropdown */}
        <Dropdown>
          <Dropdown.Toggle variant="outline-secondary" size="sm" className="rounded-circle" style={{width: '40px', height: '40px'}}>
            <i className="bi bi-paperclip"></i>
          </Dropdown.Toggle>

          <Dropdown.Menu>
            <Dropdown.Item onClick={() => fileInputRef.current?.click()}>
              <i className="bi bi-image me-2"></i>
              تصویر
            </Dropdown.Item>
            <Dropdown.Item onClick={() => fileInputRef.current?.click()}>
              <i className="bi bi-camera-video me-2"></i>
              ویدیو
            </Dropdown.Item>
            <Dropdown.Item onClick={() => fileInputRef.current?.click()}>
              <i className="bi bi-music-note me-2"></i>
              صوت
            </Dropdown.Item>
            <Dropdown.Item onClick={() => fileInputRef.current?.click()}>
              <i className="bi bi-file-earmark me-2"></i>
              فایل
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>

        {/* Hidden File Input */}
        <input ref={fileInputRef} type="file" className="d-none" onChange={handleFileSelect} accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" />

        {/* Text Input */}
        <div className="flex-grow-1">
          <Form.Control
            ref={textareaRef}
            as="textarea"
            rows="1"
            placeholder="پیام خود را بنویسید..."
            value={message}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            disabled={uploading}
            style={{
              resize: 'none',
              minHeight: '40px',
              maxHeight: '120px',
            }}
          />
        </div>

        {/* Send Button */}
        <Button variant="primary" size="sm" className="rounded-circle" style={{width: '40px', height: '40px'}} onClick={handleSendMessage} disabled={(!message.trim() && attachments.length === 0) || uploading}>
          <IoSend size={20} />
        </Button>
      </div>
      {/* Input Helper Text */}
      {/* <div className="mt-1">
        <small className="text-muted">
          Enter برای ارسال، Shift+Enter برای خط جدید
        </small>
      </div> */}
    </div>
  );
};

export default MessageInput;
