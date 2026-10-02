
export interface SortOption<T extends string> {
    value: T;
    label: string;
}

interface ListToolbarProps<T extends string> {
    /** Already translated and pluralised by the caller: only it knows what it counts. */
    summary: string;
    sortValue: T;
    onSortChange: (value: T) => void;
    options: SortOption<T>[];
    sortLabel: string;
}

/**
 * The line above a grouped list: what it holds on the left, how it is ordered
 * on the right. Shared so the tracks and labels views cannot drift apart.
 */
function ListToolbar<T extends string>({ summary, sortValue, onSortChange, options, sortLabel }: ListToolbarProps<T>) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-base-content/60">{summary}</div>
            <select
                className="select select-sm w-auto"
                value={sortValue}
                onChange={(e) => onSortChange(e.target.value as T)}
                aria-label={sortLabel}
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>
        </div>
    );
}

export default ListToolbar;
