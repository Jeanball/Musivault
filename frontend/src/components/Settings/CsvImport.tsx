import React, { useState } from 'react';
import axios from 'axios';
import { toastService } from '../../utils/toast';

interface ImportResult {
    imported: number;
    failed: number;
    skipped: number;
    logId: string;
    failures: { index: number; artist: string; album: string; reason: string }[];
}

const CsvImport: React.FC = () => {
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [progress, setProgress] = useState<{
        processed: number;
        total: number;
        success: number;
        failed: number;
        skipped: number;
        status: string;
    } | null>(null);

    const downloadTemplate = () => {
        const csv = [
            'Artist,Album,Format (Vinyl or CD),Year (Optional)',
            'Daft Punk,Discovery,Vinyl,2001',
            'Radiohead,OK Computer,CD,2001'
        ].join('\n');
        const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        const link = document.createElement('a');
        link.href = dataUri;
        link.setAttribute('download', 'musivault_import_template.csv');
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const [isDownloading, setIsDownloading] = useState(false);

    const downloadLog = async (logId: string) => {
        setIsDownloading(true);
        try {
            const response = await axios.get(`/api/collection/import/logs/${logId}/download`, {
                withCredentials: true,
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `import_log_${logId}.json`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            toastService.error('Failed to download log. Try again in a moment.');
        } finally {
            setIsDownloading(false);
        }
    };

    const pollStatus = async (logId: string) => {
        const intervalId = setInterval(async () => {
            try {
                const { data } = await axios.get(`/api/collection/import/logs/${logId}`, {
                    withCredentials: true
                });

                setProgress({
                    processed: data.successCount + data.failCount + data.skipCount,
                    total: data.totalRows,
                    success: data.successCount,
                    failed: data.failCount,
                    skipped: data.skipCount,
                    status: data.status
                });

                if (data.status === 'completed' || data.status === 'error') {
                    clearInterval(intervalId);
                    setIsImporting(false);

                    if (data.status === 'completed') {
                        toastService.success(`Import finished: ${data.successCount} added`);
                        // Transform log entries to expected failures result
                        const failures = data.entries
                            .filter((e: any) => e.status === 'failed')
                            .map((e: any) => ({
                                index: e.rowIndex,
                                artist: e.inputArtist,
                                album: e.inputAlbum,
                                reason: e.reason || 'Unknown error'
                            }));

                        setImportResult({
                            imported: data.successCount,
                            failed: data.failCount,
                            skipped: data.skipCount,
                            logId: data._id,
                            failures
                        });
                    } else {
                        toastService.error('Import stopped with errors');
                    }
                }
            } catch (err) {
                console.error('Polling error', err);
                // Don't stop polling on single error, but maybe warn?
            }
        }, 2000);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const inputElement = e.target;
        if (!file) return;

        setIsImporting(true);
        setImportResult(null);
        setProgress(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            // Start the import
            const { data } = await axios.post('/api/collection/import', formData, {
                withCredentials: true,
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toastService.info('Import started. Please wait...');

            // Initial progress state
            setProgress({
                processed: 0,
                total: data.totalRows,
                success: 0,
                failed: 0,
                skipped: 0,
                status: 'processing'
            });

            // Start polling
            pollStatus(data.logId);

        } catch (error) {
            toastService.error('Failed to start import.');
            setIsImporting(false);
        } finally {
            if (inputElement) inputElement.value = '';
        }
    };

    return (
        <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
                <h2 className="card-title flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v16h16V8l-6-4H4z" />
                    </svg>
                    Import Collection (CSV)
                </h2>
                <p className="text-sm text-gray-500">
                    CSV format: Artist, Album, Format (Vinyl or CD), Year (Optional)
                </p>

                <div className="mt-3 flex flex-wrap gap-3 items-center">
                    <button className="btn btn-outline btn-sm" onClick={downloadTemplate}>
                        Download CSV template
                    </button>
                    {!isImporting && (
                        <label className="btn btn-primary btn-sm">
                            Choose a CSV file
                            <input
                                type="file"
                                accept=".csv,text/csv"
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </label>
                    )}
                </div>

                {isImporting && progress && (
                    <div className="mt-4 w-full">
                        <p className="text-sm font-semibold mb-2">
                            Importing {progress.processed} of {progress.total} albums...
                        </p>
                        <progress
                            className="progress progress-primary w-full"
                            value={progress.processed}
                            max={progress.total}
                        ></progress>
                        <div className="flex gap-4 mt-2 text-xs">
                            <span className="text-success">{progress.success} Success</span>
                            <span className="text-warning">{progress.skipped} Skipped</span>
                            <span className="text-error">{progress.failed} Failed</span>
                        </div>
                    </div>
                )}

                {importResult && !isImporting && (
                    <div className="mt-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <p className="text-sm">
                                <strong>Complete!</strong> {importResult.imported} imported, {importResult.skipped} skipped, {importResult.failed} failed
                            </p>
                            <button
                                className="btn btn-ghost btn-xs"
                                onClick={() => downloadLog(importResult.logId)}
                                disabled={isDownloading}
                            >
                                {isDownloading ? (
                                    <span className="loading loading-spinner loading-xs"></span>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                )}
                                Download Log
                            </button>
                        </div>
                        {importResult.failures.length > 0 && (
                            <div className="overflow-x-auto mt-2 max-h-60">
                                <table className="table table-zebra table-sm">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Artist</th>
                                            <th>Album</th>
                                            <th>Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {importResult.failures.map((f, idx) => (
                                            <tr key={`${f.index}-${idx}`}>
                                                <td>{f.index}</td>
                                                <td>{f.artist}</td>
                                                <td>{f.album}</td>
                                                <td>{f.reason}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CsvImport;
