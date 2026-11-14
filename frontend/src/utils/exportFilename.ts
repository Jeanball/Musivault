/** Two exports in one day must not overwrite each other, so the name carries the time too. */
const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * File name for a collection export, in the user's local time:
 * `musivault_collection_2026-11-14_15-42-07.csv`.
 */
export function collectionExportFilename(date: Date = new Date()): string {
    const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const time = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
    return `musivault_collection_${day}_${time}.csv`;
}
