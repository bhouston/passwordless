import { useCallback } from 'react';
import { toast as sonnerToast } from 'sonner';

export type Toast = {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'error';
};

export function useToast() {
  const toast = useCallback(({ title, description, variant = 'default' }: Omit<Toast, 'id'>) => {
    const toastMethod =
      variant === 'success' ? sonnerToast.success : variant === 'error' ? sonnerToast.error : sonnerToast;
    const id = toastMethod(title, { description });
    return id;
  }, []);

  const toastError = useCallback(
    (error: unknown, title: string) => {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ title, description: message, variant: 'error' });
    },
    [toast],
  );

  const removeToast = useCallback((id: string) => {
    sonnerToast.dismiss(id);
  }, []);

  return { toasts: [], toast, toastError, removeToast };
}
