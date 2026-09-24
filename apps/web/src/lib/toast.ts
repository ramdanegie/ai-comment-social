import { writable } from 'svelte/store';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  message: string;
  duration?: number;
}

function createToastStore() {
  const { subscribe, update } = writable<ToastItem[]>([]);

  function add(item: Omit<ToastItem, 'id'>) {
    const id = 'toast_' + Math.random().toString(36).substring(2, 9);
    const duration = item.duration ?? 4000;
    const newToast: ToastItem = { ...item, id, duration };

    update((items) => [...items, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        remove(id);
      }, duration);
    }
    return id;
  }

  function remove(id: string) {
    update((items) => items.filter((t) => t.id !== id));
  }

  function success(message: string, title?: string) {
    return add({ type: 'success', message, title });
  }

  function error(message: string, title?: string) {
    return add({ type: 'error', message, title });
  }

  function info(message: string, title?: string) {
    return add({ type: 'info', message, title });
  }

  function warning(message: string, title?: string) {
    return add({ type: 'warning', message, title });
  }

  return {
    subscribe,
    add,
    remove,
    success,
    error,
    info,
    warning
  };
}

export const toast = createToastStore();
