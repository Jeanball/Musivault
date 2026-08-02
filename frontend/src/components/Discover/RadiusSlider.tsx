import React from 'react';
import { useTranslation } from 'react-i18next';

interface RadiusSliderProps {
    value: number;
    /** Fires on every move — debounce refetches on the consumer side. */
    onChange: (radiusKm: number) => void;
    /** Fires once the user lets go, for persisting the choice. */
    onCommit?: (radiusKm: number) => void;
}

const MIN_RADIUS_KM = 1;
const MAX_RADIUS_KM = 1000;

/** Coarser steps past 100 km, where single kilometres stop being meaningful. */
const STEP_KM = 5;

const clamp = (value: number): number =>
    Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, value));

const RadiusSlider: React.FC<RadiusSliderProps> = ({ value, onChange, onCommit }) => {
    const { t } = useTranslation();

    return (
        <div className="w-full max-w-sm">
            <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-medium">{t('discover.searchRadius')}</span>
                {/* Typing beats dragging for an exact value: at this range one
                    pixel of travel is several kilometres. */}
                <label className="flex items-center gap-1">
                    <input
                        type="number"
                        min={MIN_RADIUS_KM}
                        max={MAX_RADIUS_KM}
                        value={value}
                        onChange={(e) => {
                            const next = Number(e.target.value);
                            if (!Number.isNaN(next)) onChange(clamp(next));
                        }}
                        onBlur={() => onCommit?.(value)}
                        className="input input-bordered input-xs w-20 text-right"
                        aria-label={t('discover.searchRadius')}
                    />
                    <span className="text-xs text-base-content/60">km</span>
                </label>
            </div>
            <input
                type="range"
                min={MIN_RADIUS_KM}
                max={MAX_RADIUS_KM}
                step={STEP_KM}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                // Committing on release rather than on change avoids a write per pixel dragged.
                onMouseUp={(e) => onCommit?.(Number(e.currentTarget.value))}
                onTouchEnd={(e) => onCommit?.(Number(e.currentTarget.value))}
                onKeyUp={(e) => onCommit?.(Number(e.currentTarget.value))}
                className="range range-primary range-sm"
                aria-label={t('discover.searchRadius')}
            />
            <div className="flex justify-between text-xs text-base-content/50 px-1 mt-0.5">
                <span>{MIN_RADIUS_KM} km</span>
                <span>{MAX_RADIUS_KM} km</span>
            </div>
        </div>
    );
};

export default RadiusSlider;
