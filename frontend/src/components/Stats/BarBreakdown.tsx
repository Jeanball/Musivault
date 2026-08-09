import React from 'react';

export interface BarBreakdownEntry {
    name: string;
    count: number;
}

interface BarBreakdownProps {
    entries: BarBreakdownEntry[];
    total: number;
}

/**
 * A ranked list of proportional bars, direct-labelled with the name and count.
 *
 * Not a pie and not a stacked bar on purpose: with a handful of formats or a
 * dozen styles, identity would have to be carried by colour and read off a
 * legend. Here the label sits on the bar, so one hue is enough and the ranking
 * is the point.
 */
const BarBreakdown: React.FC<BarBreakdownProps> = ({ entries, total }) => {
    const max = entries.reduce((m, e) => Math.max(m, e.count), 0);

    return (
        <ul className="flex flex-col gap-2.5">
            {entries.map((entry) => {
                const share = total > 0 ? (entry.count / total) * 100 : 0;
                return (
                    <li key={entry.name} className="flex flex-col gap-1">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="truncate" title={entry.name}>{entry.name}</span>
                            <span className="shrink-0 tabular-nums text-base-content/60">
                                {entry.count}
                                <span className="ml-1.5 text-xs text-base-content/40">
                                    {share.toFixed(0)}%
                                </span>
                            </span>
                        </div>
                        {/* Scaled to the largest entry, not to the total: with a long
                            tail every bar would otherwise collapse into a sliver. */}
                        <div className="h-1.5 rounded-full bg-base-300 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${max > 0 ? (entry.count / max) * 100 : 0}%` }}
                            />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
};

export default BarBreakdown;
