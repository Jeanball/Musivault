/** Date helpers shared by the Discover release views. */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Parse a "YYYY-MM-DD" or "YYYY-MM" string as a *local* date. Passing these
 * straight to `new Date()` parses them as UTC, which shifts the day backwards
 * for negative-offset timezones.
 */
export function parseLocalDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
}

/**
 * Format a release date, honouring MusicBrainz's date precision: month-precision
 * dates ("2026-09") must never render a day.
 */
export function formatReleaseDate(
    dateStr: string,
    precision: 'day' | 'month',
    locale: string
): string {
    const date = parseLocalDate(dateStr);
    return precision === 'month'
        ? date.toLocaleDateString(locale, { year: 'numeric', month: 'long' })
        : date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** "8 Sep" — with the year appended only when it differs from the current one. */
export function formatShortDate(date: Date, locale: string): string {
    const sameYear = date.getFullYear() === new Date().getFullYear();
    return date.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        ...(sameYear ? {} : { year: 'numeric' }),
    });
}

/** "September 2026" — for month-precision buckets. */
export function formatMonthYear(month: string, locale: string): string {
    return parseLocalDate(month).toLocaleDateString(locale, { year: 'numeric', month: 'long' });
}

/** Monday of the week containing `date`, at local midnight. */
export function startOfWeek(date: Date): Date {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const daysSinceMonday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - daysSinceMonday);
    return start;
}

/** Whole weeks between two week starts: 0 = this week, 1 = next week, -1 = last week. */
export function weeksFromCurrentWeek(weekStart: Date): number {
    const current = startOfWeek(new Date());
    return Math.round((weekStart.getTime() - current.getTime()) / (7 * MS_PER_DAY));
}
