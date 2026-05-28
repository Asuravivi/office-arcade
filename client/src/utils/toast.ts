// client/src/utils/toast.ts

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

type ToastListener = (toast: ToastMessage) => void;

class ToastEmitter {
  private listeners: ToastListener[] = [];

  subscribe(listener: ToastListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit(type: ToastType, message: string) {
    const toast: ToastMessage = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      message,
    };
    this.listeners.forEach(l => l(toast));
  }

  success(message: string) { this.emit('success', message); }
  error(message: string) { this.emit('error', message); }
  warning(message: string) { this.emit('warning', message); }
  info(message: string) { this.emit('info', message); }
}

export const toast = new ToastEmitter();
