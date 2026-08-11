import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getExchangeRates } from '../api/preferences';

interface UseCurrency {
    formatValue: (value: number, inputCurrency?: string) => string;
    formatCompactValue: (value: number, inputCurrency?: string) => string;
    getValue: (value: number, inputCurrency?: string) => number;
    isLoading: boolean;
    rates: Record<string, number> | null;
    preferredCurrency: string;
}

export const useCurrency = (): UseCurrency => {
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

    // Shared by both formatters: without rates we can't convert, so we keep the
    // amount as-is and label it with the currency it came in.
    const convert = useCallback((value: number, inputCurrency: string) => {
        if (rates && rates[preferredCurrency] && rates[inputCurrency]) {
            // First convert input to USD (base), then USD to preferred
            const valueInUSD = value / rates[inputCurrency];
            return { value: valueInUSD * rates[preferredCurrency], currency: preferredCurrency };
        }
        return { value, currency: inputCurrency };
    }, [preferredCurrency, rates]);

    const formatValue = useCallback((value: number, inputCurrency: string = 'USD') => {
        const { value: convertedValue, currency: targetCurrency } = convert(value, inputCurrency);

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
    }, [convert]);

    /**
     * Abbreviated form for chart axes: "$1.9K" where formatValue gives
     * "$1,900.00". A full currency label overflows the axis box Recharts
     * reserves and gets clipped, which silently drops leading digits.
     *
     * narrowSymbol on top of that, because the default disambiguating form is
     * what overflows: CAD renders as "CA$1.4K" but "$1.4K" fits. The ambiguity
     * costs nothing on an axis, where the currency is fixed for the whole page
     * and both the tooltip and the KPI still spell it out.
     */
    const formatCompactValue = useCallback((value: number, inputCurrency: string = 'USD') => {
        const { value: convertedValue, currency: targetCurrency } = convert(value, inputCurrency);

        const options: Intl.NumberFormatOptions = {
            style: 'currency',
            currency: targetCurrency,
            notation: 'compact',
            maximumFractionDigits: 1,
        };

        try {
            return new Intl.NumberFormat(undefined, { ...options, currencyDisplay: 'narrowSymbol' }).format(convertedValue);
        } catch {
            // narrowSymbol is the newer option of the two, so it is what an old
            // engine rejects: fall back to the default symbol before giving up.
            try {
                return new Intl.NumberFormat(undefined, options).format(convertedValue);
            } catch {
                return `${targetCurrency} ${Math.round(convertedValue)}`;
            }
        }
    }, [convert]);

    const getValue = useCallback((value: number, inputCurrency: string = 'USD') => {
         return convert(value, inputCurrency).value;
    }, [convert]);

    return { formatValue, formatCompactValue, getValue, isLoading, rates, preferredCurrency };
};
