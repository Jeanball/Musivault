import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

interface DiscogsTagSelectProps {
    /** Id shared by the label and the search input. */
    id: string;
    label: string;
    /** The values already chosen. Values outside `options` are kept so old or
     *  imported data can still be removed without losing it by accident. */
    values: string[];
    options: readonly string[];
    placeholder: string;
    optionalLabel?: string;
    onChange: (values: string[]) => void;
}

/** Enough to browse a little, but a search keeps the huge style list usable. */
const MAX_VISIBLE_OPTIONS = 100;

/**
 * A multi-select over a fixed list, used for the Discogs genres and styles.
 * Typing filters the list; only an entry from the list can be added, so the
 * stored value is always one of the Discogs values. Existing chips can be
 * removed individually.
 */
const DiscogsTagSelect: React.FC<DiscogsTagSelectProps> = ({
    id,
    label,
    values,
    options,
    placeholder,
    optionalLabel,
    onChange,
}) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const listId = `${id}-options`;

    useEffect(() => {
        if (!isOpen) return;
        const onClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setQuery('');
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, [isOpen]);

    const selected = useMemo(() => new Set(values), [values]);
    const matches = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return options
            .filter((option) => !selected.has(option))
            .filter((option) => !needle || option.toLowerCase().includes(needle))
            .slice(0, MAX_VISIBLE_OPTIONS);
    }, [options, query, selected]);

    const addValue = (value: string) => {
        if (selected.has(value)) return;
        onChange([...values, value]);
        setQuery('');
    };

    const removeValue = (value: string) => {
        onChange(values.filter((current) => current !== value));
    };

    return (
        <div className="flex flex-col" ref={containerRef}>
            <label className="label w-full justify-between" htmlFor={id}>
                <span className="text-sm">{label}</span>
                {optionalLabel && (
                    <span className="text-xs text-base-content/50">{optionalLabel}</span>
                )}
            </label>
            <div className="relative">
                <input
                    id={id}
                    type="text"
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            setIsOpen(false);
                            setQuery('');
                        }
                    }}
                    placeholder={placeholder}
                    className="input w-full"
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={isOpen}
                    aria-controls={listId}
                    aria-autocomplete="list"
                />
                {isOpen && (
                    <ul
                        id={listId}
                        role="listbox"
                        className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-box border border-base-300 bg-base-200 p-1 shadow-dropdown"
                    >
                        {matches.length === 0 ? (
                            <li className="px-3 py-2 text-sm text-base-content/60">
                                {t('search.noResults', { query: query.trim() })}
                            </li>
                        ) : matches.map((option) => (
                            <li key={option} role="option" aria-selected={false}>
                                <button
                                    type="button"
                                    className="w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-base-300 focus:bg-base-300"
                                    onClick={() => addValue(option)}
                                >
                                    {option}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {values.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {values.map((value) => (
                        <span key={value} className="badge badge-primary badge-lg gap-1 pr-1">
                            {value}
                            <button
                                type="button"
                                onClick={() => removeValue(value)}
                                className="btn btn-ghost btn-xs btn-circle"
                                aria-label={t('search.removeValue', { value })}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DiscogsTagSelect;
