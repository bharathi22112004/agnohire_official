import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import toast from 'react-hot-toast';

let socket = null;

export const socketService = {
  connect() {
    if (socket?.connected) return socket;

    const token = useAuthStore.getState().accessToken;
    if (!token) return null;

    socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
    });

    socket.on('notification:new', (notification) => {
      useNotificationStore.getState().addNotification(notification);
      toast.success(notification.title, {
        description: notification.message,
        duration: 4000,
      });
    });

    socket.on('interview:started', (data) => {
      toast(`Interview started by ${data.candidate?.name || 'Candidate'}`, { icon: '🎤' });
    });

    socket.on('interview:completed', (data) => {
      toast.success(`Interview completed! AI Score: ${data.aiScore?.toFixed(1)}`);
    });

    socket.on('interview:validated', (data) => {
      toast(`Interview result: ${data.decision?.toUpperCase()}`, { icon: '📋' });
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    socket.on('error', (err) => {
      console.error('Socket error:', err.message);
    });

    return socket;
  },

  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  getSocket() {
    return socket;
  },
};
