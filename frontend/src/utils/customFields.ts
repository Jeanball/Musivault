import type { CustomFieldValues } from '../types/customFields.types';

export function normalizeCustomFieldValues(
    customFields: CustomFieldValues | Map<string, string> | null | undefined
): CustomFieldValues {
    if (!customFields) return {};
    if (customFields instanceof Map) {
        return Object.fromEntries(customFields);
    }
    return customFields;
}
