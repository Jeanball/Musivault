import React from 'react';
import { X } from 'lucide-react';
import type { DiscogsResult } from '../../types';
import { parseTitle } from '../../utils/formatters';

interface SelectReleaseModalProps {
    isOpen: boolean;
    results: DiscogsResult[];
    onClose: () => void;
    onSelect: (release: DiscogsResult) => void;
    isLoading?: boolean;
}

const SelectReleaseModal: React.FC<SelectReleaseModalProps> = ({
    isOpen,
    results,
    onClose,
    onSelect,
    isLoading = false,
}) => {
    if (!isOpen) return null;

    return (
        <dialog className="modal modal-open">
            <div className="modal-box w-11/12 max-w-2xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg">Multiple Matches Found</h3>
                    <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <p className="text-sm text-gray-400 mb-4">
                    We found multiple albums with this barcode. Please select the correct one:
                </p>

                {/* Results List */}
                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {results.map((result) => {
                        const { artist, album } = parseTitle(result.title);
                        return (
                            <div
                                key={result.id}
                                onClick={() => onSelect(result)}
                                className="flex items-center p-3 bg-base-200 rounded-lg hover:bg-base-300 cursor-pointer transition-colors"
                            >
                                <img
                                    src={result.thumb || '/placeholder-album.png'}
                                    alt={album}
                                    className="w-16 h-16 object-cover rounded mr-4 flex-shrink-0"
                                />
                                <div className="flex-grow min-w-0">
                                    <h4 className="font-semibold truncate">{album}</h4>
                                    <p className="text-sm text-gray-400 truncate">{artist}</p>
                                    <p className="text-xs text-gray-500">{result.year || 'N/A'}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {isLoading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-2xl">
                        <span className="loading loading-spinner loading-lg text-primary"></span>
                    </div>
                )}

                {/* Actions */}
                <div className="modal-action">
                    <button className="btn btn-ghost" onClick={onClose}>
                        Cancel
                    </button>
                </div>
            </div>
            <form method="dialog" className="modal-backdrop">
                <button onClick={onClose}>close</button>
            </form>
        </dialog>
    );
};

export default SelectReleaseModal;
