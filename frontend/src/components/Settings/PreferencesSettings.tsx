import React from 'react';
import AppearanceSettings from './AppearanceSettings';
import CollectionSettings from './CollectionSettings';
import ConditionGradingSettings from './ConditionGradingSettings';
import CustomFieldsSettings from './CustomFieldsSettings';
import SortingSettings from './SortingSettings';

const PreferencesSettings: React.FC = () => {
    return (
        <div className="space-y-6">
            {/* Public Collection */}
            <CollectionSettings />

            {/* Artist Sorting */}
            <SortingSettings />

            {/* Custom Fields */}
            <CustomFieldsSettings />

            {/* Condition Grading */}
            <ConditionGradingSettings />

            {/* Appearance: Theme, Language, Display */}
            <AppearanceSettings />
        </div>
    );
};

export default PreferencesSettings;
