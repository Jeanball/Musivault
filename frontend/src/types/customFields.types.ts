export type CustomFieldType = 'text' | 'textarea';

export interface CustomFieldDefinition {
    _id: string;
    name: string;
    type: CustomFieldType;
    placeholder?: string;
    order: number;
    createdAt: string;
    updatedAt: string;
}

export type CustomFieldValues = Record<string, string>;

export function normalizeCustomFieldValues(
    customFields: CustomFieldValues | Map<string, string> | null | undefined
): CustomFieldValues {
    if (!customFields) return {};
    if (customFields instanceof Map) {
        return Object.fromEntries(customFields);
    }
    return customFields;
}
