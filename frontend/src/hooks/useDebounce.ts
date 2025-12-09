import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce a value.
 * It only updates the returned value if no new changes have occurred
 * during the specified delay.
 * @param value The value to debounce (e.g., search text)
 * @param delay The delay in milliseconds (e.g., 500)
 * @returns The debounced value.
 */
export function useDebounce<T>(value: T, delay: number): T {
  // Internal state to store the debounced value
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up a timer to update the value after the delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup function: if the value changes (user types again),
    // cancel the previous timer to create a new one.
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]); // Effect re-triggers only if value or delay changes

  return debouncedValue;
}

