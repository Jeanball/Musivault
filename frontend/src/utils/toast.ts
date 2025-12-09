import { toast, type ToastOptions } from 'react-toastify';

const baseToastOptions: ToastOptions = {
  theme: 'colored',
  style: {
    borderRadius: '0.5rem',
    padding: '12px 16px',
    fontSize: '14px',
    fontWeight: '500',
  }
};

const successOptions: ToastOptions = {
  ...baseToastOptions,
  position: 'bottom-right',
  style: {
    ...baseToastOptions.style,
    background: 'var(--fallback-p,oklch(var(--p)))',
    color: 'var(--fallback-pc,oklch(var(--pc)))',
    border: '1px solid var(--fallback-p,oklch(var(--p)))',
  }
};

const errorOptions: ToastOptions = {
  ...baseToastOptions,
  position: 'bottom-right',
  style: {
    ...baseToastOptions.style,
    background: 'var(--fallback-er,oklch(var(--er)))',
    color: 'var(--fallback-erc,oklch(var(--erc)))',
    border: '1px solid var(--fallback-er,oklch(var(--er)))',
  }
};

const infoOptions: ToastOptions = {
  ...baseToastOptions,
  position: 'top-center',
  style: {
    ...baseToastOptions.style,
    background: 'var(--fallback-p,oklch(var(--p)))',
    color: 'var(--fallback-pc,oklch(var(--pc)))',
    border: '1px solid var(--fallback-p,oklch(var(--p)))',
  }
};

export const toastService = {
  success: (message: string) => toast.success(message, successOptions),
  error: (message: string) => toast.error(message, errorOptions),
  info: (message: string) => toast.info(message, infoOptions),
  warning: (message: string) => toast.warning(message, {
    ...baseToastOptions,
    position: 'top-center',
    style: {
      ...baseToastOptions.style,
      background: 'var(--fallback-wa,oklch(var(--wa)))',
      color: 'var(--fallback-wac,oklch(var(--wac)))',
      border: '1px solid var(--fallback-wa,oklch(var(--wa)))',
    }
  })
};

// Predefined messages for common actions
export const toastMessages = {
  auth: {
    loginSuccess: 'Connection successful!',
    loginError: 'Invalid credentials',
    signupSuccess: 'Account created successfully!',
    signupError: 'Registration failed',
    logoutSuccess: 'Logged out successfully'
  },
  collection: {
    addSuccess: 'Album added to your collection!',
    addError: 'Failed to add album',
    deleteSuccess: 'Album deleted from your collection!',
    deleteError: 'Failed to delete album',
    importSuccess: 'Collection imported successfully!',
    importError: 'Failed to import collection'
  },
  general: {
    saveSuccess: 'Changes saved successfully!',
    saveError: 'Failed to save changes',
    networkError: 'Network error. Please try again.',
    unexpectedError: 'An unexpected error occurred'
  }
};
