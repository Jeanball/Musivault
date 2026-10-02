import { client } from './client';
import type { CustomFieldDefinition, CustomFieldType } from '../types/customFields.types';

export interface CustomFieldPayload {
    name: string;
    type: CustomFieldType;
    placeholder: string;
}

export async function getCustomFields(): Promise<CustomFieldDefinition[]> {
    const { data } = await client.get<CustomFieldDefinition[]>('/custom-fields');
    return data;
}

export async function createCustomField(
    payload: CustomFieldPayload
): Promise<CustomFieldDefinition> {
    const { data } = await client.post<CustomFieldDefinition>('/custom-fields', payload);
    return data;
}

export async function updateCustomField(
    fieldId: string,
    payload: CustomFieldPayload
): Promise<CustomFieldDefinition> {
    const { data } = await client.put<CustomFieldDefinition>(`/custom-fields/${fieldId}`, payload);
    return data;
}

export async function deleteCustomField(fieldId: string): Promise<void> {
    await client.delete(`/custom-fields/${fieldId}`);
}
