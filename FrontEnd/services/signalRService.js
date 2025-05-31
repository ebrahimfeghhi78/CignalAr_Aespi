// src/services/signalRService.js
// SignalR service for real-time chat functionality

import {HubConnectionBuilder, LogLevel} from '@microsoft/signalr';

class SignalRService {
  constructor() {
    this.connection = null;
    this.isConnected = false;
    this.listeners = new Map();
  }

  // Initialize connection
  async startConnection(token) {
    try {
      // تعیین آدرس SignalR بر اساس محیط
      const hubUrl = import.meta.env.MODE === 'development' ? 'https://localhost:5001/chathub' : window.location.origin + '/chathub';

      this.connection = new HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => token,
        })
        .configureLogging(LogLevel.Information)
        .build();

      // Set up event handlers
      this.setupEventHandlers();

      await this.connection.start();
      this.isConnected = true;

      // Notify listeners about connection status
      this.notifyListeners('connectionStatusChanged', true);

      return true;
    } catch (error) {
      console.error('SignalR Connection Error:', error);
      this.isConnected = false;
      this.notifyListeners('connectionStatusChanged', false);
      return false;
    }
  }

  // Stop connection
  async stopConnection() {
    if (this.connection) {
      await this.connection.stop();
      this.isConnected = false;
      this.notifyListeners('connectionStatusChanged', false);
    }
  }

  // Setup event handlers
  setupEventHandlers() {
    if (!this.connection) return;

    // Listen for room list updates
    this.connection.on('ReceiveChatRoomUpdate', (roomData) => {
      this.notifyListeners('receiveChatRoomUpdate', roomData);
    });

    // Handle connection closed
    this.connection.onclose((error) => {
      this.isConnected = false;
      this.notifyListeners('connectionStatusChanged', false);

      // Attempt to reconnect after 5 seconds
      setTimeout(() => this.reconnect(), 5000);
    });

    // Handle reconnecting
    this.connection.onreconnecting((error) => {
      this.notifyListeners('connectionStatusChanged', false);
    });

    // Handle reconnected
    this.connection.onreconnected((connectionId) => {
      this.isConnected = true;
      this.notifyListeners('connectionStatusChanged', true);
    });

    // Listen for new messages
    this.connection.on('ReceiveMessage', (message) => {
      this.notifyListeners('messageReceived', message);
    });

    // Listen for typing indicators
    this.connection.on('UserTyping', (typingData) => {
      this.notifyListeners('userTyping', typingData);
    });

    // Listen for message read status
    this.connection.on('MessageRead', (readData) => {
      this.notifyListeners('messageRead', readData);
    });

    // UserOnlineStatus از بک‌اند می‌آید
    this.connection.on('UserOnlineStatus', (userData) => { // userData: { UserId, IsOnline, Avatar, UserName }
      // بر اساس IsOnline، رویداد مناسب را در کلاینت notify کنید
      if (userData.IsOnline) {
        this.notifyListeners('userOnline', { id: userData.UserId, userName: userData.UserName, avatar: userData.Avatar, connectedAt: new Date().toISOString() }); // userData را تبدیل کنید
      } else {
        this.notifyListeners('userOffline', { id: userData.UserId }); // فقط UserId کافیست برای حذف
      }
    });
  }

  // Join a chat room
  async joinRoom(roomId) {
    if (this.connection && this.isConnected) {
      await this.connection.invoke('JoinRoom', roomId.toString());
    }
  }

  // Leave a chat room
  async leaveRoom(roomId) {
    if (this.connection && this.isConnected) {
      await this.connection.invoke('LeaveRoom', roomId.toString());
    }
  }

  // Start typing indicator
  async startTyping(roomId) {
    if (this.connection && this.isConnected) {
      await this.connection.invoke('StartTyping', roomId.toString());
    }
  }

  // Stop typing indicator
  async stopTyping(roomId = null) {
    if (this.connection && this.isConnected) {
      await this.connection.invoke('StopTyping', roomId?.toString());
    }
  }

  // Mark message as read
  async markMessageAsRead(messageId) {
    if (this.connection && this.isConnected) {
      await this.connection.invoke('MarkMessageAsRead', messageId.toString());
    }
  }

  // Add event listener
  addEventListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  // Remove event listener
  removeEventListener(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Notify listeners
  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((callback) => callback(data));
    }
  }

  // Reconnect
  async reconnect() {
    if (!this.isConnected && this.connection) {
      try {
        await this.connection.start();
        this.isConnected = true;
        this.notifyListeners('connectionStatusChanged', true);
      } catch (error) {
        console.error('Reconnection failed:', error);
        setTimeout(() => this.reconnect(), 5000);
      }
    }
  }

  // Get connection status
  getConnectionStatus() {
    return this.isConnected;
  }
}

// Create singleton instance
const signalRService = new SignalRService();
export default signalRService;
