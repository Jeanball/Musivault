import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import LabelModal from '../Modal/LabelModal';
import type { Label } from '../../types/collection.types';

interface LabelLinkProps {
    label: Label;
}

/**
 * Renders a label name as a button opening the label's card, where its official
 * website can be reached. Gives the label the visibility a plain text line doesn't.
 */
const LabelLink: React.FC<LabelLinkProps> = ({ label }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (!label.name) return null;

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="inline-flex items-baseline gap-1 link link-hover font-medium text-left max-w-full"
            >
                <span className="truncate">{label.name}</span>
                <ExternalLink className="w-3 h-3 shrink-0 self-center opacity-60" />
            </button>
            {isOpen && <LabelModal label={label} onClose={() => setIsOpen(false)} />}
        </>
    );
};

export default LabelLink;
