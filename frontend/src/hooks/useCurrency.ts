import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';

// Module-level cache to prevent multiple fetches across components
let cachedRates: Record<string, number> | null = null;
let fetchPromise: Promise<Record<string, number>> | null = null;

export const useCurrency = () => {
    const { preferredCurrency } = useTheme();
    const [rates, setRates] = useState<Record<string, number> | null>(cachedRates);
    const [isLoading, setIsLoading] = useState<boolean>(!cachedRates);

    useEffect(() => {
        if (cachedRates) {
            setRates(cachedRates);
            setIsLoading(false);
            return;
        }

        if (!fetchPromise) {
            fetchPromise = axios.get('/api/preferences/exchange-rates', { withCredentials: true })
                .then(res => {
                    cachedRates = res.data.rates || { USD: 1 };
                    return cachedRates as Record<string, number>;
                })
                .catch(err => {
                    console.error('Failed to fetch exchange rates:', err);
                    // Fallback to basic rates if it fails
                    const fallback = { USD: 1, EUR: 0.92, GBP: 0.79, CAD: 1.35 };
                    cachedRates = fallback;
                    return fallback;
                });
        }

        fetchPromise.then(resolvedRates => {
            setRates(resolvedRates);
            setIsLoading(false);
        });
    }, []);

    const formatValue = useCallback((value: number, inputCurrency: string = 'USD') => {
        // If rates haven't loaded yet, or conversion fails, default to original
        let convertedValue = value;
        let targetCurrency = preferredCurrency;

        if (rates && rates[preferredCurrency] && rates[inputCurrency]) {
            // First convert input to USD (base), then USD to preferred
            const valueInUSD = value / rates[inputCurrency];
            convertedValue = valueInUSD * rates[preferredCurrency];
        } else {
             // Fallback if missing rates
             targetCurrency = inputCurrency;
        }

        try {
            return new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: targetCurrency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(convertedValue);
        } catch {
            return `${targetCurrency} ${convertedValue.toFixed(2)}`;
        }
    }, [preferredCurrency, rates]);

    const getValue = useCallback((value: number, inputCurrency: string = 'USD') => {
         if (rates && rates[preferredCurrency] && rates[inputCurrency]) {
             const valueInUSD = value / rates[inputCurrency];
             return valueInUSD * rates[preferredCurrency];
         }
         return value;
    }, [preferredCurrency, rates]);

    return { formatValue, getValue, isLoading, rates, preferredCurrency };
};
