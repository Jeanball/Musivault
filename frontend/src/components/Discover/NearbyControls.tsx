import React from 'react';
import LocationControls from './LocationControls';
import RadiusSlider from './RadiusSlider';
import type { NearbyState } from '../../hooks/useNearbySearch';

interface NearbyControlsProps {
    nearby: NearbyState;
    /** Opens the place search straight away — see LocationControls. */
    showManualSearch?: boolean;
    /** Filters specific to the page (search box, genre, date window). */
    children?: React.ReactNode;
    /** Drop the panel background where the controls already sit inside one. */
    bare?: boolean;
}

/**
 * Position and radius, in one panel. Both are shared across every "near you"
 * section, so this renders once per page and every list on it follows.
 */
const NearbyControls: React.FC<NearbyControlsProps> = ({ nearby, showManualSearch, children, bare }) => (
    <div className={bare ? 'space-y-4' : 'bg-base-200 rounded-xl p-4 space-y-4'}>
        <LocationControls
            location={nearby.location}
            error={nearby.error}
            isRequestingPrecise={nearby.isRequestingPrecise}
            onRequestPrecise={nearby.requestBrowserLocation}
            onManualLocation={nearby.setManualLocation}
            showManualSearch={showManualSearch ?? !nearby.location}
        />

        <div className="flex flex-wrap items-end gap-4">
            <RadiusSlider
                value={nearby.radiusKm}
                onChange={nearby.setRadiusKm}
                onCommit={nearby.commitRadius}
            />
            {children}
        </div>
    </div>
);

export default NearbyControls;
