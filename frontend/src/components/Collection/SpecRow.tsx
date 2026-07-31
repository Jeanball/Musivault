import React from 'react';

interface SpecRowProps {
    label: string;
    children: React.ReactNode;
}

const SpecRow: React.FC<SpecRowProps> = ({ label, children }) => (
    <div className="flex items-baseline gap-4 py-2.5 border-b border-base-300">
        <span className="w-32 shrink-0 text-xs uppercase tracking-wide text-base-content/60">{label}</span>
        <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">{children}</div>
    </div>
);

export default SpecRow;
