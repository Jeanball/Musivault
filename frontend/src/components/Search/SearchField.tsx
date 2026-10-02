import React from 'react';
import { SearchGlassIcon, CrossIcon } from './SearchIcons';

interface SearchFieldProps {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    /** Clears the field; the button stays mounted so nothing shifts under the finger */
    onReset: () => void;
    resetLabel: string;
    isLoading?: boolean;
    /** Controls pinned inside the field, after the reset cross */
    trailing?: React.ReactNode;
    inputRef?: React.RefObject<HTMLInputElement | null>;
    /** Combobox wiring, key handlers, autofocus: whatever the host screen needs */
    inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
}

/**
 * The one search field of the app: magnifier, input, reset cross, and room for
 * whatever the screen adds on the right. Shared so the artist page and the
 * quick search read as the same control.
 */
const SearchField: React.FC<SearchFieldProps> = ({
    value,
    onChange,
    placeholder,
    onReset,
    resetLabel,
    isLoading = false,
    trailing,
    inputRef,
    inputProps
}) => (
    <div className="flex items-center gap-2 h-12 sm:h-14 pl-3 pr-1 sm:pr-1.5 bg-base-100 border-theme border-base-300 rounded-field transition-colors focus-within:border-primary">
        <SearchGlassIcon className="w-5 h-5 shrink-0 text-base-content/50" />
        <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1 min-w-0 h-full bg-transparent border-0 outline-hidden text-base"
            aria-label={placeholder}
            autoComplete="off"
            {...inputProps}
        />
        {isLoading && <span className="loading loading-spinner loading-sm shrink-0"></span>}
        <button
            type="button"
            className={`btn btn-ghost btn-circle h-10 w-10 min-h-10 shrink-0 ${value ? '' : 'invisible'}`}
            onClick={onReset}
            title={resetLabel}
            aria-label={resetLabel}
            tabIndex={value ? 0 : -1}
        >
            <CrossIcon className="w-4 h-4" />
        </button>
        {trailing}
    </div>
);

export default SearchField;
