import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toastService } from '../../utils/toast';
import type { CustomFieldDefinition } from '../../types/customFields.types';
import { normalizeCustomFieldValues } from '../../types/customFields.types';
import FieldRow from './FieldRow';

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
    const [isSaving, setIsSaving] = useState(false);

    const initialValues = useMemo(() => normalizeCustomFieldValues(values), [values]);

    useEffect(() => {
        setLocalValues(initialValues);
    }, [initialValues]);

    useEffect(() => {
        axios
            .get<CustomFieldDefinition[]>('/api/custom-fields', { withCredentials: true })
            .then((response) => setDefinitions(response.data))
            .catch((error) => console.error('Failed to fetch custom field definitions:', error))
            .finally(() => setIsLoading(false));
    }, []);

    const isDirty = useMemo(() => {
        return definitions.some((field) => {
            const initialVal = initialValues[field._id] || '';
            const localVal = localValues[field._id] || '';
            return initialVal !== localVal;
        });
    }, [definitions, initialValues, localValues]);

    const handleSave = async (e?: React.FormEvent) => {
        if (e) {
            e.preventDefault();
        }

        setIsSaving(true);
        const startTime = Date.now();

        try {
            const response = await axios.put(
                `/api/collection/${itemId}`,
                { customFields: localValues },
                { withCredentials: true }
            );

            // Minimum loading duration of 400ms so the user sees the spinner feedback clearly
            const elapsedTime = Date.now() - startTime;
            if (elapsedTime < 400) {
                await new Promise((resolve) => setTimeout(resolve, 400 - elapsedTime));
            }

            const savedValues = normalizeCustomFieldValues(response.data.customFields);
            onUpdate(savedValues);
            toastService.success(t('customFields.valueSaved'));
        } catch (error) {
            console.error('Failed to save custom field values:', error);
            toastService.error(t('customFields.failedSaveValue'));
            setLocalValues(initialValues);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <FieldRow label={t('customFields.title')}>
                <span className="loading loading-spinner loading-xs"></span>
            </FieldRow>
        );
    }

    if (definitions.length === 0) {
        return null;
    }

    return (
        <form onSubmit={handleSave}>
            {definitions.map((field) => (
                <FieldRow key={field._id} label={field.name}>
                    {field.type === 'textarea' ? (
                        <textarea
                            className="textarea textarea-bordered textarea-sm w-full h-16"
                            value={localValues[field._id] || ''}
                            placeholder={field.placeholder || undefined}
                            onChange={(e) =>
                                setLocalValues((prev) => ({
                                    ...prev,
                                    [field._id]: e.target.value,
                                }))
                            }
                            disabled={isSaving}
                        />
                    ) : (
                        <input
                            type="text"
                            className="input input-bordered input-sm w-full"
                            value={localValues[field._id] || ''}
                            placeholder={field.placeholder || undefined}
                            onChange={(e) =>
                                setLocalValues((prev) => ({
                                    ...prev,
                                    [field._id]: e.target.value,
                                }))
                            }
                            disabled={isSaving}
                        />
                    )}
                </FieldRow>
            ))}

            {isDirty && (
                <div className="flex justify-end py-2">
                    <button
                        type="submit"
                        className="btn btn-primary btn-sm flex items-center gap-2 min-w-28"
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <>
                                <span className="loading loading-spinner loading-xs text-primary-content"></span>
                                <span>{t('common.save')}</span>
                            </>
                        ) : (
                            <span>{t('common.save')}</span>
                        )}
                    </button>
                </div>
            )}
        </form>
    );
};

export default CustomFieldsEditor;
