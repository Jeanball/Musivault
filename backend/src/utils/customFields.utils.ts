/**
 * Custom-field columns travel through CSV by name, which a user is free to
 * change. Newer exports therefore append the field's hidden uuid to the header
 * (for example `Binder [cf:2f6c...]`), and the importer prefers it over the
 * name. Files exported before this suffix existed still match by name.
 */

/** Trailing `[cf:<uuid>]` marker, captured at the end of a header. */
const UUID_SUFFIX = / \[cf:([0-9a-zA-Z-]+)\]$/;

export function formatCustomFieldHeader(name: string, uuid: string): string {
    return `${name} [cf:${uuid}]`;
}

export function parseCustomFieldHeader(header: string): { name: string; uuid?: string } {
    const match = header.match(UUID_SUFFIX);
    if (!match) return { name: header.trim() };

    const end = match.index ?? header.length;
    return { name: header.slice(0, end).trim(), uuid: match[1] };
}
