import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useTheme } from '../context/ThemeContext';

const themes = [
    "light", "dark", "cupcake", "bumblebee", "emerald", "corporate",
    "synthwave", "retro", "cyberpunk", "valentine", "halloween", "garden",
    "forest", "aqua", "lofi", "pastel", "fantasy", "wireframe", "black",
    "luxury", "dracula", "cmyk", "autumn", "business", "acid", "lemonade"
];

const SettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const { theme, setTheme } = useTheme();
    const [isSaving, setIsSaving] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<{
        imported: number;
        failed: number;
        failures: { index: number; artiste: string; album: string; reason: string }[];
    } | null>(null);

    const handleThemeChange = async (newTheme: string) => {
        setTheme(newTheme); // Mise à jour immédiate (localStorage via ThemeContext)
        setIsSaving(true);

        try {
            await axios.put('/api/users/preferences', { theme: newTheme }, { withCredentials: true });
            toast.success('Theme saved!');
        } catch (error) {
            console.error('Failed to save theme to server:', error);
            // Le thème reste appliqué localement même si la sauvegarde serveur échoue
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm">
                    ← Back
                </button>
                <h1 className="text-2xl font-bold">Settings</h1>
            </div>

            {/* Theme Section */}
            <div className="card bg-base-200 shadow-xl">
                <div className="card-body">
                    <h2 className="card-title flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                        Theme
                        {isSaving && <span className="loading loading-spinner loading-xs"></span>}
                    </h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Choose your preferred color theme. Your choice will be saved to your account.
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {themes.map((themeOption) => (
                            <button
                                key={themeOption}
                                onClick={() => handleThemeChange(themeOption)}
                                className={`btn btn-sm capitalize ${
                                    theme === themeOption 
                                        ? 'btn-primary' 
                                        : 'btn-outline'
                                }`}
                            >
                                {themeOption}
                                {theme === themeOption && (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Import CSV Section */}
            <div className="card bg-base-200 shadow-xl mt-6">
                <div className="card-body">
                    <h2 className="card-title flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v16h16V8l-6-4H4z" />
                        </svg>
                        Import Collection (CSV)
                        {isImporting && <span className="loading loading-spinner loading-xs"></span>}
                    </h2>
                    <p className="text-sm text-gray-500">
                        Format attendu: Artiste, Album, Annee (optionnel), Type (Vinyl ou CD)
                    </p>

                    <div className="mt-3 flex flex-wrap gap-3 items-center">
                        <button
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                                // Générer le template côté client avec Data URI (évite les warnings HTTP)
                                const csv = [
                                    'Artiste,Album,Annee (Optionnel),Type (Vinyl ou CD)',
                                    'Daft Punk,Discovery,2001,Vinyl',
                                    'Radiohead,OK Computer,,CD'
                                ].join('\n');
                                const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
                                const link = document.createElement('a');
                                link.href = dataUri;
                                link.setAttribute('download', 'musivault_import_template.csv');
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                            }}
                        >
                            Télécharger le template CSV
                        </button>
                        <label className="btn btn-primary btn-sm">
                            Choisir un fichier CSV
                            <input
                                type="file"
                                accept=".csv,text/csv"
                                className="hidden"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    const inputElement = e.target;
                                    if (!file) return;
                                    setIsImporting(true);
                                    setImportResult(null);
                                    try {
                                        const formData = new FormData();
                                        formData.append('file', file);
                                        const { data } = await axios.post('/api/collection/import', formData, {
                                            withCredentials: true,
                                            headers: { 'Content-Type': 'multipart/form-data' }
                                        });
                                        setImportResult(data);
                                        toast.success(`Import terminé: ${data.imported} ajoutés, ${data.failed} échecs`);
                                    } catch (error) {
                                        toast.error('Échec de l\'import.');
                                    } finally {
                                        setIsImporting(false);
                                        // reset file input
                                        if (inputElement) inputElement.value = '';
                                    }
                                }}
                            />
                        </label>
                    </div>

                    {importResult && (
                        <div className="mt-4">
                            <p className="text-sm">
                                <strong>Résultat:</strong> {importResult.imported} importés, {importResult.failed} échecs
                            </p>
                            {importResult.failures.length > 0 && (
                                <div className="overflow-x-auto mt-2">
                                    <table className="table table-zebra table-sm">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Artiste</th>
                                                <th>Album</th>
                                                <th>Raison</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {importResult.failures.map((f, idx) => (
                                                <tr key={`${f.index}-${idx}`}>
                                                    <td>{f.index}</td>
                                                    <td>{f.artiste}</td>
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
        </div>
    );
};

export default SettingsPage;
