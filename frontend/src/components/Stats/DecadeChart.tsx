import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DecadeChartProps {
    decadeCounts: Record<string, number>;
}

/**
 * How the collection spreads across decades.
 *
 * Ordered by decade rather than by count — the shape of a collection is the
 * point, and a ranking would destroy it. Gaps are filled with zero-height bars
 * so a decade nobody owns reads as an absence rather than as a shorter axis.
 */
const DecadeChart: React.FC<DecadeChartProps> = ({ decadeCounts }) => {
    const { t } = useTranslation();

    const data = useMemo(() => {
        const decades = Object.keys(decadeCounts)
            .map((label) => Number.parseInt(label, 10))
            .filter((n) => !Number.isNaN(n))
            .sort((a, b) => a - b);

        if (decades.length === 0) return [];

        const series: { decade: string; count: number }[] = [];
        for (let d = decades[0]; d <= decades[decades.length - 1]; d += 10) {
            const label = `${d}s`;
            series.push({ decade: label, count: decadeCounts[label] || 0 });
        }
        return series;
    }, [decadeCounts]);

    if (data.length === 0) return null;

    return (
        <div className="w-full h-55">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="color-mix(in oklab, var(--color-base-content) 10%, transparent)"
                        vertical={false}
                    />
                    <XAxis
                        dataKey="decade"
                        stroke="color-mix(in oklab, var(--color-base-content) 50%, transparent)"
                        fontSize={12}
                        tickLine={false}
                        tickMargin={8}
                    />
                    <YAxis
                        stroke="color-mix(in oklab, var(--color-base-content) 50%, transparent)"
                        fontSize={12}
                        tickLine={false}
                        allowDecimals={false}
                        width={44}
                    />
                    <Tooltip
                        cursor={{ fill: 'color-mix(in oklab, var(--color-base-content) 6%, transparent)' }}
                        contentStyle={{
                            backgroundColor: 'var(--color-base-200)',
                            borderColor: 'var(--color-base-300)',
                            borderRadius: '0.5rem',
                            color: 'var(--color-base-content)',
                        }}
                        itemStyle={{ color: 'var(--color-base-content)' }}
                        formatter={(value) => [Number(value), t('stats.records')]}
                    />
                    <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={56} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default DecadeChart;
