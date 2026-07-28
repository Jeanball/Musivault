import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toastService } from '../../utils/toast';
import type { CustomFieldDefinition } from '../../types/customFields.types';
import { normalizeCustomFieldValues } from '../../types/customFields.types';

interface CustomFieldsEditorProps {
    itemId: string;
    values: Record<string, string> | Map<string, string> | null | undefined;
    onUpdate: (values: Record<string, string>) => void;
}

const CustomFieldsEditor: React.FC<CustomFieldsEditorProps> = ({
    itemId,
    values,
    onUpdate,
}) => {
    const { t } = useTranslation();
    const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([]);
    const [localValues, setLocalValues] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [savingFieldId, setSavingFieldId] = useState<string | null>(null);

    useEffect(() => {
        setLocalValues(normalizeCustomFieldValues(values));
    }, [values]);

    useEffect(() => {
        axios
            .get<CustomFieldDefinition[]>('/api/custom-fields', { withCredentials: true })
            .then((response) => setDefinitions(response.data))
            .catch((error) => console.error('Failed to fetch custom field definitions:', error))
            .finally(() => setIsLoading(false));
    }, []);

    const saveField = async (fieldId: string, value: string) => {
        const currentValues = normalizeCustomFieldValues(values);
        if ((currentValues[fieldId] || '') === value) {
            return;
        }

        setSavingFieldId(fieldId);
        try {
            const updatedValues = {
                ...currentValues,
                [fieldId]: value,
            };

            const response = await axios.put(
                `/api/collection/${itemId}`,
                { customFields: updatedValues },
                { withCredentials: true }
            );

            const savedValues = normalizeCustomFieldValues(response.data.customFields);
            onUpdate(savedValues);
            toastService.success(t('customFields.valueSaved'));
        } catch (error) {
            console.error('Failed to save custom field value:', error);
            toastService.error(t('customFields.failedSaveValue'));
            setLocalValues(normalizeCustomFieldValues(values));
        } finally {
            setSavingFieldId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="collapse collapse-arrow bg-base-200 shadow-xl mb-8">
                <input type="checkbox" />
                <div className="collapse-title text-2xl font-bold">
                    {t('customFields.title')}
                </div>
                <div className="collapse-content">
                    <span className="loading loading-spinner loading-md"></span>
                </div>
            </div>
        );
    }

    if (definitions.length === 0) {
        return null;
    }

    return (
        <details className="collapse collapse-arrow bg-base-200 shadow-xl mb-8" open>
            <summary className="collapse-title text-2xl font-bold">
                {t('customFields.itemSectionTitle')}
            </summary>
            <div className="collapse-content">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {definitions.map((field) => (
                        <div key={field._id} className="form-control">
                            <label className="label">
                                <span className="label-text font-semibold">{field.name}</span>
                                {savingFieldId === field._id && (
                                    <span className="loading loading-spinner loading-xs"></span>
                                )}
                            </label>
                            {field.type === 'textarea' ? (
                                <textarea
                                    className="textarea textarea-bordered min-h-24"
                                    value={localValues[field._id] || ''}
                                    placeholder={field.placeholder || undefined}
                                    onChange={(e) =>
                                        setLocalValues((prev) => ({
                                            ...prev,
                                            [field._id]: e.target.value,
                                        }))
                                    }
                                    onBlur={(e) => saveField(field._id, e.target.value)}
                                    disabled={savingFieldId === field._id}
                                />
                            ) : (
                                <input
                                    type="text"
                                    className="input input-bordered"
                                    value={localValues[field._id] || ''}
                                    placeholder={field.placeholder || undefined}
                                    onChange={(e) =>
                                        setLocalValues((prev) => ({
                                            ...prev,
                                            [field._id]: e.target.value,
                                        }))
                                    }
                                    onBlur={(e) => saveField(field._id, e.target.value)}
                                    disabled={savingFieldId === field._id}
                                />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </details>
    );
};

export default CustomFieldsEditor;
