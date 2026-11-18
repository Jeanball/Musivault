import { describe, expect, it } from 'vitest';
import { formatAxisDate, toChartPoints } from './valueHistoryChart';

const point = (date: string, value = 100) => ({ date, value, itemCount: 1 });
const DAY = 24 * 60 * 60 * 1000;

describe('toChartPoints', () => {
    it('keeps every field and adds a timestamp', () => {
        const [p] = toChartPoints([point('2026-10-28', 250)]);

        expect(p).toMatchObject({ date: '2026-10-28', value: 250, itemCount: 1 });
        expect(typeof p.t).toBe('number');
    });

    it('parses the day as a local date, so it formats back to the same day', () => {
        const [p] = toChartPoints([point('2026-01-01')]);

        expect(new Date(p.t).getFullYear()).toBe(2026);
        expect(new Date(p.t).getMonth()).toBe(0);
        expect(new Date(p.t).getDate()).toBe(1);
    });

    it('keeps the real gaps between sparse days, which is what the time axis draws', () => {
        const [a, b, c] = toChartPoints([point('2026-01-01'), point('2026-01-02'), point('2026-04-02')]);

        // Compared in whole days: a DST change makes a local day 23 or 25 hours.
        expect(Math.round((b.t - a.t) / DAY)).toBe(1);
        expect(Math.round((c.t - b.t) / DAY)).toBe(90);
    });

    it('keeps the order it was given', () => {
        const result = toChartPoints([point('2026-01-01'), point('2026-02-01')]);

        expect(result[0].t).toBeLessThan(result[1].t);
    });

    it('returns nothing for an empty history', () => {
        expect(toChartPoints([])).toEqual([]);
    });
});

describe('formatAxisDate', () => {
    it('writes month/day/two-digit year without padding', () => {
        expect(formatAxisDate(new Date(2026, 6, 4).getTime())).toBe('7/4/26');
        expect(formatAxisDate(new Date(2026, 11, 25).getTime())).toBe('12/25/26');
    });
});
