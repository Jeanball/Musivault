import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    icon: LucideIcon;
    title?: string;
    description?: string;
    /** Optional call to action, rendered under the description. */
    children?: React.ReactNode;
}

/**
 * The dashed placeholder panel used wherever a section has nothing to show —
 * no results, no location, nothing shared yet. It was copy-pasted into every
 * such spot, so a tweak to the styling only ever landed in some of them.
 */
const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, children }) => (
    <div className="bg-base-200 rounded-xl p-8 text-center border-2 border-dashed border-base-300">
        <div className="flex justify-center mb-4">
            <Icon size={48} />
        </div>
        {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
        {description && (
            <p className="text-base-content/60 max-w-md mx-auto text-sm md:text-base">
                {description}
            </p>
        )}
        {children && <div className="mt-4">{children}</div>}
    </div>
);

export default EmptyState;
