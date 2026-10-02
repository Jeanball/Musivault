/// <reference types="vite/client" />

// Declared explicitly so unknown env vars fail to compile. Vite's default
// ImportMetaEnv has an `any` index signature, which is how a typo like
// `import.meta.env.API_URL` (missing the VITE_ prefix, so always undefined)
// went unnoticed. The app is served same-origin, so no API base URL is needed.
interface ImportMetaEnv {
    readonly MODE: string;
    readonly BASE_URL: string;
    readonly PROD: boolean;
    readonly DEV: boolean;
    readonly SSR: boolean;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
