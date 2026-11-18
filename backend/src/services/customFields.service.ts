import { randomUUID } from 'crypto';
import CustomFieldDefinition, { ICustomFieldDefinition } from '../models/CustomFieldDefinition';
import { logger } from '../config/logger.config';

/**
 * The user's custom fields, including their hidden uuid. Definitions created
 * before the uuid existed get one on first use, so every export can identify a
 * field even after it has been renamed.
 */
export async function loadCustomFieldsWithUuids(userId: unknown): Promise<ICustomFieldDefinition[]> {
    const fields = await CustomFieldDefinition.find({ user: userId })
        .select('+uuid')
        .sort({ order: 1, createdAt: 1 })
        .exec();

    const missing = fields.filter((field) => !field.uuid);
    if (missing.length === 0) return fields;

    for (const field of missing) {
        const generated = randomUUID();
        // Conditional write: another request may have assigned one meanwhile.
        const result = await CustomFieldDefinition.updateOne(
            { _id: field._id, uuid: { $in: [null, ''] } },
            { $set: { uuid: generated } }
        );

        if (result.modifiedCount > 0) {
            field.uuid = generated;
            continue;
        }

        const stored = await CustomFieldDefinition.findById(field._id).select('+uuid');
        field.uuid = stored?.uuid ?? generated;
        logger.debug(`[CustomFields] Reused uuid already assigned to field ${String(field._id)}`);
    }

    return fields;
}
