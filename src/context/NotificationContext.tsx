import React, { createContext, useContext, useRef } from 'react';
import NotificationSystem, { useNotifications, Notification } from '../components/NotificationSystem';

interface NotificationContextType {
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  showSuccess: (title: string, message: string, options?: Partial<Notification>) => string;
  showError: (title: string, message: string, options?: Partial<Notification>) => string;
  showInfo: (title: string, message: string, options?: Partial<Notification>) => string;
  showWarning: (title: string, message: string, options?: Partial<Notification>) => string;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const notificationMethods = useNotifications();
  const recentNotifications = useRef<Set<string>>(new Set());

  // Enhanced methods to prevent duplicates with longer timeout
  const addNotificationWithDuplicateCheck = (notification: Omit<Notification, 'id'>) => {
    const notificationKey = `${notification.type}-${notification.title}-${notification.message}`;
    
    // Check if this notification was shown recently (within 5 seconds)
    if (recentNotifications.current.has(notificationKey)) {
      return '';
    }
    
    // Add to recent notifications
    recentNotifications.current.add(notificationKey);
    
    // Remove from recent after 5 seconds (increased from 2 seconds)
    setTimeout(() => {
      recentNotifications.current.delete(notificationKey);
    }, 5000);
    
    return notificationMethods.addNotification(notification);
  };

  const enhancedMethods = {
    ...notificationMethods,
    addNotification: addNotificationWithDuplicateCheck,
    showSuccess: (title: string, message: string, options?: Partial<Notification>) => {
      return addNotificationWithDuplicateCheck({ type: 'success', title, message, ...options });
    },
    showError: (title: string, message: string, options?: Partial<Notification>) => {
      return addNotificationWithDuplicateCheck({ type: 'error', title, message, ...options });
    },
    showInfo: (title: string, message: string, options?: Partial<Notification>) => {
      return addNotificationWithDuplicateCheck({ type: 'info', title, message, ...options });
    },
    showWarning: (title: string, message: string, options?: Partial<Notification>) => {
      return addNotificationWithDuplicateCheck({ type: 'warning', title, message, ...options });
    }
  };

  return (
    <NotificationContext.Provider value={enhancedMethods}>
      {children}
      <NotificationSystem 
        notifications={notificationMethods.notifications}
        onClose={notificationMethods.removeNotification}
      />
    </NotificationContext.Provider>
  );
};