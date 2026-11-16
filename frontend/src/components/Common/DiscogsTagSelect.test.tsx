import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DiscogsTagSelect from './DiscogsTagSelect';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

const options = ['Hard Bop', 'Jazz', 'Modal', 'Rock'];

const renderSelect = (values: string[] = []) => {
    const onChange = vi.fn();
    render(
        <DiscogsTagSelect
            id="tags"
            label="Genres"
            values={values}
            options={options}
            placeholder="Search…"
            onChange={onChange}
        />
    );
    return onChange;
};

describe('DiscogsTagSelect', () => {
    it('filters the list and adds an option from it', () => {
        const onChange = renderSelect();

        const input = screen.getByRole('combobox');
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: 'jazz' } });

        expect(screen.getByRole('button', { name: 'Jazz' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Rock' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Jazz' }));
        expect(onChange).toHaveBeenCalledWith(['Jazz']);
    });

    it('does not offer a value that is already selected', () => {
        renderSelect(['Jazz']);

        fireEvent.focus(screen.getByRole('combobox'));

        expect(screen.queryByRole('button', { name: 'Jazz' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Rock' })).toBeInTheDocument();
    });

    it('removes a selected value', () => {
        const onChange = renderSelect(['Jazz', 'Rock']);

        fireEvent.click(screen.getAllByRole('button', { name: 'search.removeValue' })[0]);

        expect(onChange).toHaveBeenCalledWith(['Rock']);
    });

    it('keeps an existing value that is not in the Discogs list visible', () => {
        renderSelect(['Private Press']);

        expect(screen.getByText('Private Press')).toBeInTheDocument();
    });
});
