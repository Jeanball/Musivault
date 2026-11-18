import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Music } from 'lucide-react';
import { getCollectionStyles } from '../../api/collection';
import { getPreferences, updatePreferences } from '../../api/preferences';
import { COMMON_STYLES } from '../../constants/discoverStyles';
import EmptyState from '../Common/EmptyState';

interface SuggestedStylesProps {
    /** Called after a style is followed, so the parent can refetch releases. */
    onFollowed: () => void;
    /** Shown when the member already has styles, i.e. the list is empty for another reason. */
    fallback: React.ReactNode;
}

/**
 * Empty state for a member whose collection has no styles and who follows
 * none: Discover would otherwise show nothing and give no way forward.
 * One click on a common style follows it (discoverIncludedStyles).
 */
const SuggestedStyles: React.FC<SuggestedStylesProps> = ({ onFollowed, fallback }) => {
    const { t } = useTranslation();
    const [hasStyles, setHasStyles] = useState<boolean | null>(null);
    const [followed, setFollowed] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const [styles, prefs] = await Promise.all([getCollectionStyles(), getPreferences()]);
                const included = prefs.discoverIncludedStyles || [];
                setFollowed(included);
                setHasStyles(styles.length > 0 || included.length > 0);
            } catch (err) {
                console.error('Failed to load styles:', err);
                setHasStyles(true);
            }
        };
        load();
    }, []);

    const follow = async (style: string) => {
        setIsSaving(true);
        try {
            const next = [...followed, style];
            await updatePreferences({ discoverIncludedStyles: next });
            setFollowed(next);
            setHasStyles(true);
            onFollowed();
        } catch (err) {
            console.error('Failed to follow style:', err);
        } finally {
            setIsSaving(false);
        }
    };

    if (hasStyles === null) return null;
    if (hasStyles) return <>{fallback}</>;

    return (
        <EmptyState
            icon={Music}
            title={t('discover.suggestedStylesTitle')}
            description={t('discover.suggestedStylesDescription')}
        >
            <div className="flex flex-wrap justify-center gap-2">
                {COMMON_STYLES.map((style) => (
                    <button
                        key={style}
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={isSaving}
                        onClick={() => follow(style)}
                    >
                        {style}
                    </button>
                ))}
            </div>
        </EmptyState>
    );
};

export default SuggestedStyles;
