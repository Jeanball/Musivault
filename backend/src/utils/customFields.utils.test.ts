import { describe, expect, it } from 'vitest';
import { formatCustomFieldHeader, parseCustomFieldHeader } from './customFields.utils';

describe('custom field CSV headers', () => {
    it('round-trips the name and hidden uuid', () => {
        const header = formatCustomFieldHeader('Binder', '2f6c1a5e-9d3b-4f0a-8c7e-123456789abc');

        expect(header).toBe('Binder [cf:2f6c1a5e-9d3b-4f0a-8c7e-123456789abc]');
        expect(parseCustomFieldHeader(header)).toEqual({
            name: 'Binder',
            uuid: '2f6c1a5e-9d3b-4f0a-8c7e-123456789abc'
        });
    });

    it('keeps working with files exported before uuids existed', () => {
        expect(parseCustomFieldHeader('Custom Note')).toEqual({ name: 'Custom Note' });
    });

    it('only strips a marker at the end, so names may contain brackets', () => {
        expect(parseCustomFieldHeader('Binder [old] [cf:abc-123]')).toEqual({
            name: 'Binder [old]',
            uuid: 'abc-123'
        });
        expect(parseCustomFieldHeader('Binder [cf:abc-123] notes')).toEqual({
            name: 'Binder [cf:abc-123] notes'
        });
    });
});
