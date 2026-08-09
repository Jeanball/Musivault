/**
 * The themes the app ships with. This list must stay in sync with `index.css`,
 * which is where the themes actually exist: `light` and `dark` are declared
 * with `@plugin "daisyui/theme"`, `abyss` and `caramellatte` are pulled from
 * daisyUI's own set via `@plugin "daisyui" { themes: … }`. A name that isn't
 * declared there falls back to the default theme with no error, so anything
 * reaching `data-theme` goes through `isTheme` first.
 *
 * The backend keeps its own copy in `preferences.controller.ts`.
 */
export const THEMES = ['light', 'dark', 'abyss', 'caramellatte'] as const;

export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = 'dark';

export const isTheme = (value: unknown): value is Theme =>
    typeof value === 'string' && (THEMES as readonly string[]).includes(value);
