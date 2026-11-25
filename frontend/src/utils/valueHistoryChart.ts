import type { ValuePoint } from '../api/collection';

/** A value history point with its day as a timestamp, which is what a time-scaled axis needs. */
export interface ChartPoint extends ValuePoint {
    t: number;
}

/**
 * Add a timestamp `t` to each point so the chart spaces them by time, not by position.
 * The history is sparse (a day is stored only when the total changes), so gaps vary.
 * `date` is a `YYYY-MM-DD` day key written by the backend in local time, so it is parsed as a local
 * midnight; a bare `new Date('YYYY-MM-DD')` would be UTC and could land on the previous day.
 */
export function toChartPoints(points: ValuePoint[]): ChartPoint[] {
    return points.map(p => ({ ...p, t: new Date(`${p.date}T00:00:00`).getTime() }));
}

/** Short `M/D/YY` axis label for a timestamp. */
export function formatAxisDate(ts: number): string {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear().toString().slice(2)}`;
}
