import React from 'react';
import AppearanceSettings from './AppearanceSettings';
import CollectionSettings from './CollectionSettings';
import ConditionGradingSettings from './ConditionGradingSettings';

const PreferencesSettings: React.FC = () => {
    return (
        <div className="space-y-6">
            {/* Public Collection */}
            <CollectionSettings />

            {/* Condition Grading */}
            <ConditionGradingSettings />

            {/* Appearance: Theme, Language, Display */}
            <AppearanceSettings />
        </div>
    );
};

export default PreferencesSettings;
