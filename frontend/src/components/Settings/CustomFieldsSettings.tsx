import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    getCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField
} from '../../api/customFields';
import { isApiError } from '../../api/errors';
import { ListPlus, Pencil, Trash2 } from 'lucide-react';
import { toastService } from '../../utils/toast';
import type { CustomFieldDefinition, CustomFieldType } from '../../types/customFields.types';

interface FieldFormState {
    name: string;
    type: CustomFieldType;
    placeholder: string;
}

const emptyForm: FieldFormState = {
    name: '',
    type: 'text',
    placeholder: '',
};

const CustomFieldsSettings: React.FC = () => {
    const { t } = useTranslation();
    const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FieldFormState>(emptyForm);

    const fetchFields = async () => {
        try {
            setFields(await getCustomFields());
        } catch (error) {
            console.error('Failed to fetch custom fields:', error);
            toastService.error(t('customFields.failedLoad'));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchFields();
    }, []);

    const resetForm = () => {
        setForm(emptyForm);
        setEditingId(null);
        setShowForm(false);
    };

    const startEdit = (field: CustomFieldDefinition) => {
        setEditingId(field._id);
        setForm({
            name: field.name,
            type: field.type,
            placeholder: field.placeholder || '',
        });
        setShowForm(true);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!form.name.trim()) {
            toastService.error(t('customFields.nameRequired'));
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                name: form.name.trim(),
                type: form.type,
                placeholder: form.placeholder.trim(),
            };

            if (editingId) {
                const updated = await updateCustomField(editingId, payload);
                setFields((prev) =>
                    prev.map((field) => (field._id === editingId ? updated : field))
                );
                toastService.success(t('customFields.updated'));
            } else {
                const created = await createCustomField(payload);
                setFields((prev) => [...prev, created]);
                toastService.success(t('customFields.created'));
            }

            resetForm();
        } catch (error) {
            console.error('Failed to save custom field:', error);
            const message = isApiError(error) ? error.serverMessage : undefined;
            toastService.error(message || t('customFields.failedSave'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (fieldId: string) => {
        if (!confirm(t('customFields.confirmDelete'))) {
            return;
        }

        setIsSaving(true);
        try {
            await deleteCustomField(fieldId);
            setFields((prev) => prev.filter((field) => field._id !== fieldId));
            toastService.success(t('customFields.deleted'));
        } catch (error) {
            console.error('Failed to delete custom field:', error);
            toastService.error(t('customFields.failedDelete'));
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="card bg-base-200 shadow-xl">
                <div className="card-body">
                    <div className="skeleton h-6 w-48 mb-4"></div>
                    <div className="skeleton h-4 w-full mb-2"></div>
                    <div className="skeleton h-4 w-3/4"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
                <h2 className="card-title flex items-center gap-2">
                    <ListPlus size={20} />
                    {t('customFields.title')}
                    {isSaving && <span className="loading loading-spinner loading-xs"></span>}
                </h2>
                <p className="text-sm text-base-content/50 mb-4">
                    {t('customFields.description')}
                </p>

                {fields.length > 0 && (
                    <div className="overflow-x-auto mb-4">
                        <table className="table table-sm">
                            <thead>
                                <tr>
                                    <th>{t('customFields.fieldName')}</th>
                                    <th>{t('customFields.fieldType')}</th>
                                    <th>{t('customFields.examplePlaceholder')}</th>
                                    <th className="w-24"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {fields.map((field) => (
                                    <tr key={field._id}>
                                        <td className="font-medium">{field.name}</td>
                                        <td>
                                            {field.type === 'textarea'
                                                ? t('customFields.typeTextarea')
                                                : t('customFields.typeText')}
                                        </td>
                                        <td className="text-base-content/60">
                                            {field.placeholder || '—'}
                                        </td>
                                        <td>
                                            <div className="flex gap-1">
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-xs btn-square"
                                                    onClick={() => startEdit(field)}
                                                    disabled={isSaving}
                                                    title={t('common.edit')}
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-xs btn-square text-error"
                                                    onClick={() => handleDelete(field._id)}
                                                    disabled={isSaving}
                                                    title={t('common.delete')}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {fields.length === 0 && !showForm && (
                    <p className="text-sm text-base-content/60 mb-4">
                        {t('customFields.emptyState')}
                    </p>
                )}

                {showForm ? (
                    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-base-300 rounded-lg">
                        <h3 className="font-semibold">
                            {editingId ? t('customFields.editField') : t('customFields.addField')}
                        </h3>

                        <div className="flex flex-col">
                            <label className="label">
                                <span className="text-sm">{t('customFields.fieldName')}</span>
                            </label>
                            <input
                                type="text"
                                className="input w-full"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder={t('customFields.namePlaceholder')}
                                maxLength={100}
                                required
                            />
                        </div>

                        <div className="flex flex-col">
                            <label className="label">
                                <span className="text-sm">{t('customFields.fieldType')}</span>
                            </label>
                            <select
                                className="select w-full"
                                value={form.type}
                                onChange={(e) =>
                                    setForm({ ...form, type: e.target.value as CustomFieldType })
                                }
                            >
                                <option value="text">{t('customFields.typeText')}</option>
                                <option value="textarea">{t('customFields.typeTextarea')}</option>
                            </select>
                        </div>

                        <div className="flex flex-col">
                            <label className="label">
                                <span className="text-sm">{t('customFields.examplePlaceholder')}</span>
                            </label>
                            <input
                                type="text"
                                className="input w-full"
                                value={form.placeholder}
                                onChange={(e) => setForm({ ...form, placeholder: e.target.value })}
                                placeholder={t('customFields.placeholderHint')}
                                maxLength={500}
                            />
                            <label className="label">
                                <span className="text-xs text-base-content/60">
                                    {t('customFields.placeholderDescription')}
                                </span>
                            </label>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                className={`btn btn-primary btn-sm ${isSaving ? 'loading' : ''}`}
                                disabled={isSaving}
                            >
                                {editingId ? t('common.save') : t('common.add')}
                            </button>
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={resetForm}
                                disabled={isSaving}
                            >
                                {t('common.cancel')}
                            </button>
                        </div>
                    </form>
                ) : (
                    <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setShowForm(true)}
                        disabled={isSaving}
                    >
                        <ListPlus size={16} />
                        {t('customFields.addField')}
                    </button>
                )}
            </div>
        </div>
    );
};

export default CustomFieldsSettings;
