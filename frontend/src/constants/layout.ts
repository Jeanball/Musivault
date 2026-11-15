/**
 * Classes that cap the page content to a comfortable reading width.
 * Wide screen mode drops the cap so the content fills the viewport.
 */
export const CENTERED_CONTENT_CLASS = 'max-w-250 mx-auto w-full';

export function contentWidthClass(wideScreenMode: boolean): string {
    return wideScreenMode ? '' : CENTERED_CONTENT_CLASS;
}
