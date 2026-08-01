import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { toastService } from '../../utils/toast';
import { exportCollection } from '../../api/collection';

const ExportSettings: React.FC = () => {
    const { t } = useTranslation();
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const blob = await exportCollection();

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `musivault_collection_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toastService.success(t('csvExport.exportFinished'));
        } catch {
            toastService.error(t('csvExport.failedExport'));
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
                <h2 className="card-title flex items-center gap-2">
                    <Download size={20} />
                    {t('csvExport.title')}
                </h2>
                <p className="text-sm text-base-content/70">
                    {t('csvExport.description')}
                </p>
                <p className="text-xs text-base-content/50 mt-1">
                    {t('csvExport.hint')}
                </p>

                <div className="mt-3">
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={handleExport}
                        disabled={isExporting}
                    >
                        {isExporting && <span className="loading loading-spinner loading-xs"></span>}
                        {t('csvExport.downloadCsv')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExportSettings;
