import React from 'react';
import type { ChangelogEntry } from '../../hooks/useWhatsNew';
import { Sparkles, Plus, RefreshCw, Wrench, Trash2 } from 'lucide-react';

interface WhatsNewModalProps {
    entries: ChangelogEntry[];
    currentVersion: string;
    onDismiss: () => void;
}

const sectionIcons: Record<string, React.ReactNode> = {
    Added: <Plus className="w-4 h-4 text-green-400" />,
    Changed: <RefreshCw className="w-4 h-4 text-blue-400" />,
    Fixed: <Wrench className="w-4 h-4 text-yellow-400" />,
    Removed: <Trash2 className="w-4 h-4 text-red-400" />
};

const sectionColors: Record<string, string> = {
    Added: 'text-green-400',
    Changed: 'text-blue-400',
    Fixed: 'text-yellow-400',
    Removed: 'text-red-400'
};

const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ entries, currentVersion, onDismiss }) => {
    return (
        <dialog className="modal modal-open">
            <div className="modal-box max-w-2xl max-h-[80vh]">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary/20 rounded-lg">
                        <Sparkles className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-bold text-xl">What's New in Musivault</h3>
                        <p className="text-sm text-gray-400">Version {currentVersion}</p>
                    </div>
                </div>

                {/* Changelog entries */}
                <div className="overflow-y-auto max-h-[50vh] pr-2 space-y-6">
                    {entries.map((entry) => (
                        <div key={entry.version} className="border-l-2 border-primary/30 pl-4">
                            <div className="flex items-baseline gap-2 mb-3">
                                <span className="font-bold text-lg">v{entry.version}</span>
                                {entry.date && (
                                    <span className="text-sm text-gray-500">{entry.date}</span>
                                )}
                            </div>

                            {entry.sections.map((section, idx) => (
                                <div key={idx} className="mb-3">
                                    <div className={`flex items-center gap-2 font-medium mb-2 ${sectionColors[section.type]}`}>
                                        {sectionIcons[section.type]}
                                        <span>{section.type}</span>
                                    </div>
                                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-300 ml-6">
                                        {section.items.map((item, itemIdx) => (
                                            <li key={itemIdx}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="modal-action mt-6">
                    <button className="btn btn-primary" onClick={onDismiss}>
                        Got it!
                    </button>
                </div>
            </div>
            <form method="dialog" className="modal-backdrop">
                <button onClick={onDismiss}>close</button>
            </form>
        </dialog>
    );
};

export default WhatsNewModal;
