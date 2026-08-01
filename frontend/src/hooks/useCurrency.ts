import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getExchangeRates } from '../api/preferences';

export const useCurrency = () => {
    const { preferredCurrency } = useTheme();
    const [rates, setRates] = useState<Record<string, number> | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        let active = true;
        // Caching and in-flight deduplication live in api/preferences.
        getExchangeRates().then(resolvedRates => {
            if (!active) return;
            setRates(resolvedRates);
            setIsLoading(false);
        });
        return () => { active = false; };
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
