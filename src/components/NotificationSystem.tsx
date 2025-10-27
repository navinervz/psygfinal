import React, { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationItemProps {
  notification: Notification;
  onClose: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const handleClose = useCallback(() => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose(notification.id);
    }, 300);
  }, [notification.id, onClose]);

  useEffect(() => {
    // Animate in
    const showTimer = setTimeout(() => setIsVisible(true), 50);

    if (notification.duration && notification.duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, notification.duration);

      return () => {
        clearTimeout(timer);
        clearTimeout(showTimer);
      };
    }

    return () => clearTimeout(showTimer);
  }, [notification.duration, handleClose]);
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-yellow-400" />;
      case 'info':
      default:
        return <Info className="w-6 h-6 text-blue-400" />;
    }
  };

  const getColors = () => {
    switch (notification.type) {
      case 'success':
        return {
          bg: 'from-green-500/20 to-green-600/10',
          border: 'border-green-500/40',
          glow: 'shadow-[0_0_20px_rgba(34,197,94,0.3)]'
        };
      case 'error':
        return {
          bg: 'from-red-500/20 to-red-600/10',
          border: 'border-red-500/40',
          glow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]'
        };
      case 'warning':
        return {
          bg: 'from-yellow-500/20 to-yellow-600/10',
          border: 'border-yellow-500/40',
          glow: 'shadow-[0_0_20px_rgba(234,179,8,0.3)]'
        };
      case 'info':
      default:
        return {
          bg: 'from-[#39ff14]/20 to-[#004d00]/10',
          border: 'border-[#39ff14]/40',
          glow: 'shadow-[0_0_20px_rgba(57,255,20,0.3)]'
        };
    }
  };

  const colors = getColors();

  return (
    <div
      className={`
        relative mb-4 p-4 rounded-xl backdrop-blur-xl border-2 
        bg-gradient-to-r ${colors.bg} ${colors.border} ${colors.glow}
        transform transition-all duration-300 ease-out
        ${isVisible && !isLeaving 
          ? 'translate-x-0 opacity-100 scale-100' 
          : 'translate-x-full opacity-0 scale-95'
        }
        hover:scale-105 hover:${colors.glow.replace('0.3', '0.5')}
        max-w-sm w-full
      `}
    >
      {/* Background decoration */}
      <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-white/20 to-transparent rounded-full blur-sm"></div>
      <div className="absolute -bottom-1 -left-1 w-6 h-6 bg-gradient-to-tl from-white/10 to-transparent rounded-full blur-sm"></div>
      
      {/* Animated border glow */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 animate-pulse"></div>
      
      <div className="relative z-10 flex items-start gap-3">
        {/* Icon with pulse animation */}
        <div className="flex-shrink-0 relative">
          {getIcon()}
          <div className="absolute inset-0 rounded-full animate-ping opacity-20">
            {getIcon()}
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-bold text-sm mb-1 leading-tight">
            {notification.title}
          </h4>
          <p className="text-gray-300 text-xs leading-relaxed">
            {notification.message}
          </p>
          
          {/* Action button */}
          {notification.action && (
            <button
              onClick={notification.action.onClick}
              className="mt-3 text-xs font-semibold text-[#39ff14] hover:text-white transition-colors underline"
            >
              {notification.action.label}
            </button>
          )}
        </div>
        
        {/* Close button */}
        <button
          onClick={handleClose}
          className="flex-shrink-0 text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-full"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {/* Progress bar for timed notifications */}
      {notification.duration && notification.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20 rounded-b-xl overflow-hidden">
          <div 
            className={`h-full bg-gradient-to-r ${colors.bg.replace('/20', '/60')} animate-progress`}
            style={{
              animation: `progress ${notification.duration}ms linear forwards`
            }}
          ></div>
        </div>
      )}
    </div>
  );
};

interface NotificationSystemProps {
  notifications: Notification[];
  onClose: (id: string) => void;
}

const NotificationSystem: React.FC<NotificationSystemProps> = ({ notifications, onClose }) => {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-6 left-6 z-[9999] pointer-events-none">
      <div className="pointer-events-auto">
        {notifications.map(notification => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onClose={onClose}
          />
        ))}
      </div>
    </div>
  );
};

// Hook for managing notifications
export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration ?? 5000, // Default 5 seconds
    };

    setNotifications(prev => [...prev, newNotification]);
    return id;
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  // Convenience methods
  const showSuccess = (title: string, message: string, options?: Partial<Notification>) => {
    return addNotification({ type: 'success', title, message, ...options });
  };

  const showError = (title: string, message: string, options?: Partial<Notification>) => {
    return addNotification({ type: 'error', title, message, ...options });
  };

  const showInfo = (title: string, message: string, options?: Partial<Notification>) => {
    return addNotification({ type: 'info', title, message, ...options });
  };

  const showWarning = (title: string, message: string, options?: Partial<Notification>) => {
    return addNotification({ type: 'warning', title, message, ...options });
  };

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    showSuccess,
    showError,
    showInfo,
    showWarning,
  };
};

export default NotificationSystem;