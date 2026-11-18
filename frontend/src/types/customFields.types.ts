export type CustomFieldType = 'text' | 'textarea';

export interface CustomFieldDefinition {
    _id: string;
    name: string;
    type: CustomFieldType;
    placeholder?: string;
    /** Column width in the collection table, in rem (4–24). */
    tableWidthRem?: number;
    order: number;
    createdAt: string;
    updatedAt: string;
}

export type CustomFieldValues = Record<string, string>;
