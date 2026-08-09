import { toast, type ToastOptions } from 'react-toastify';

// Helper to get responsive position
const getPosition = () => window.innerWidth < 1024 ? 'top-center' : 'bottom-right';

const baseToastOptions: ToastOptions = {
  theme: 'colored',
  style: {
    borderRadius: '0.5rem',
    padding: '12px 16px',
    fontSize: '14px',
    fontWeight: '500',
  }
};

const getSuccessOptions = (): ToastOptions => ({
  ...baseToastOptions,
  position: getPosition(),
  style: {
    ...baseToastOptions.style,
    background: 'var(--color-primary)',
    color: 'var(--color-primary-content)',
    border: '1px solid var(--color-primary)',
  }
});

const getErrorOptions = (): ToastOptions => ({
  ...baseToastOptions,
  position: getPosition(),
  style: {
    ...baseToastOptions.style,
    background: 'var(--color-error)',
    color: 'var(--color-error-content)',
    border: '1px solid var(--color-error)',
  }
});

const getInfoOptions = (): ToastOptions => ({
  ...baseToastOptions,
  position: getPosition(),
  style: {
    ...baseToastOptions.style,
    background: 'var(--color-primary)',
    color: 'var(--color-primary-content)',
    border: '1px solid var(--color-primary)',
  }
});

/**
 * Deriving the toast id from the message collapses duplicates: an effect that
 * runs twice under StrictMode, or two components reacting to the same failure,
 * shows one toast instead of a stack of identical ones.
 */
const toastId = (message: string) => `toast-${message}`;

export const toastService = {
  success: (message: string) => toast.success(message, { ...getSuccessOptions(), toastId: toastId(message) }),
  error: (message: string) => toast.error(message, { ...getErrorOptions(), toastId: toastId(message) }),
  info: (message: string) => toast.info(message, { ...getInfoOptions(), toastId: toastId(message) }),
  warning: (message: string) => toast.warning(message, {
    ...baseToastOptions,
    position: getPosition(),
    toastId: toastId(message),
    style: {
      ...baseToastOptions.style,
      background: 'var(--color-warning)',
      color: 'var(--color-warning-content)',
      border: '1px solid var(--color-warning)',
    }
  })
};
