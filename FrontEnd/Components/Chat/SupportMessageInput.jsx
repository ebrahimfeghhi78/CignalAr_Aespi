import React, { useState, useRef, useEffect } from 'react';
import { Form, Button, Dropdown, ProgressBar, Alert } from 'react-bootstrap';
import { MessageType } from '../../types/chat';
import { IoSend } from "react-icons/io5";
import { useSupportChat } from '../../hooks/useSupportChat';
import secureFileApi from '../../api/secureFileApi';

const SupportMessageInput = ({ roomId }) => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  const { sendMessage, error: sendError } = useSupportChat(roomId);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (sendError) {
      setError(sendError);
    }
  }, [sendError]);

  const handleInputChange = (e) => {
    setMessage(e.target.value);
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
          fileSize: uploadResult.fileSize
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
        message.trim(), 
        messageType, 
        attachmentData?.url,
        attachmentData
      );
      
      // Clear input
      setMessage('');
      setAttachments([]);
      
    } catch (error) {
      setError('خطا در ارسال پیام: ' + error.message);
    }
  };

  const uploadFile = async (file) => {
    setUploading(true);
    setUploadProgress(0);

    try {
      const result = await secureFileApi.uploadFile(file, roomId, 'support-chat');
      
      // Simulate progress for better UX
      for (let i = 0; i <= 100; i += 10) {
        setUploadProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return {
        url: result.url,
        fileName: file.name,
        fileSize: file.size
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
    if (fileType.startsWith('image/')) return 'bi bi-image';
    if (fileType.startsWith('video/')) return 'bi bi-camera-video';
    if (fileType.startsWith('audio/')) return 'bi bi-music-note';
    if (fileType.includes('pdf')) return 'bi bi-file-pdf';
    if (fileType.includes('word')) return 'bi bi-file-word';
    if (fileType.includes('excel')) return 'bi bi-file-excel';
    return 'bi bi-file-earmark';
  };

  return (
    <div className="border-top p-3">
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')} className="mb-2">
          {error}
        </Alert>
      )}

      {uploading && (
        <div className="mb-2">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <small className="text-muted">در حال آپلود...</small>
            <small className="text-muted">{uploadProgress}%</small>
          </div>
          <ProgressBar now={uploadProgress} size="sm" />
        </div>
      )}

      {attachments.length > 0 && (
        <div className="mb-2">
          {attachments.map((file, index) => (
            <div key={index} className="d-flex align-items-center bg-light rounded p-2">
              <i className={`${getFileIcon(file.type)} me-2`} />
              <div className="flex-grow-1 min-width-0">
                <div className="text-truncate small">{file.name}</div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                  {formatFileSize(file.size)}
                </div>
              </div>
              <Button
                variant="link"
                size="sm"
                className="text-danger p-0 ms-2"
                onClick={() => removeAttachment(index)}
              >
                <i className="bi bi-x-lg" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="d-flex gap-2">
        <Dropdown>
          <Dropdown.Toggle
            variant="outline-secondary"
            size="sm"
            className="rounded-circle"
            style={{ width: '40px', height: '40px' }}
          >
            <i className="bi bi-paperclip" />
          </Dropdown.Toggle>

          <Dropdown.Menu>
            <Dropdown.Item onClick={() => fileInputRef.current?.click()}>
              <i className="bi bi-file-earmark me-2" />
              انتخاب فایل
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>

        <input
          ref={fileInputRef}
          type="file"
          className="d-none"
          onChange={handleFileSelect}
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
        />

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
              maxHeight: '120px'
            }}
          />
        </div>

        <Button
          variant="primary"
          size="sm"
          className="rounded-circle"
          style={{ width: '40px', height: '40px' }}
          onClick={handleSendMessage}
          disabled={(!message.trim() && attachments.length === 0) || uploading}
        >
          <IoSend size={20} />
        </Button>
      </div>
    </div>
  );
};

export default SupportMessageInput;
