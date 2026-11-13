import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addManualAlbum, updateManualAlbum } from '../../api/collection';
import { isApiError } from '../../api/errors';
import { toastService } from '../../utils/toast';
import { getImageUrl } from '../../utils/imageUrl';
import type { CollectionItem, Track } from '../../types/collection.types';
import { Upload, X, Music, Plus, Trash2 } from 'lucide-react';


const FORMATS = ['Vinyl', 'CD', 'Cassette'];

interface TrackDraft extends Track {
    /** Stable key so editing or removing a row keeps the other inputs in place. */
    key: number;
}

let nextTrackKey = 0;

const createTrackDraft = (track?: Partial<Track>): TrackDraft => ({
    key: nextTrackKey++,
    position: track?.position || '',
    title: track?.title || '',
    duration: track?.duration || '',
    artist: track?.artist || '',
});

interface ManualAlbumFormProps {
    /** When present the form edits this album instead of creating a new one. */
    item?: CollectionItem | null;
    onSaved?: (item: CollectionItem) => void;
    onCancel?: () => void;
}

const ManualAlbumForm: React.FC<ManualAlbumFormProps> = ({ item, onSaved, onCancel }) => {
    const { t } = useTranslation();
    const isEditing = Boolean(item);

    const firstLabel = item?.album.labels?.[0];
    const currentCover = item?.album.cover_image || item?.album.thumb || '';
    const initialTracks = item?.album.tracklist?.length
        ? item.album.tracklist.map(createTrackDraft)
        : [createTrackDraft()];

    const [title, setTitle] = useState(item?.album.title || '');
    const [artist, setArtist] = useState(item?.album.artist || '');
    const [year, setYear] = useState(item?.album.year || '');
    const [format, setFormat] = useState(item?.format.name || FORMATS[0]);
    const [label, setLabel] = useState(firstLabel?.name || '');
    const [catno, setCatno] = useState(firstLabel?.catno === 'none' ? '' : firstLabel?.catno || '');
    const [genres, setGenres] = useState((item?.album.styles || []).join(', '));
    const [value, setValue] = useState(item?.manualValue != null ? String(item.manualValue) : '');
    const [tracks, setTracks] = useState<TrackDraft[]>(initialTracks);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(currentCover ? getImageUrl(currentCover) : null);
    const [removeCover, setRemoveCover] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetForm = () => {
        setTitle('');
        setArtist('');
        setYear('');
        setFormat(FORMATS[0]);
        setLabel('');
        setCatno('');
        setGenres('');
        setValue('');
        setTracks([createTrackDraft()]);
        setCoverFile(null);
        setCoverPreview(null);
        setRemoveCover(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCoverFile(file);
            setRemoveCover(false);
            // Create preview URL
            const reader = new FileReader();
            reader.onloadend = () => {
                setCoverPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveCover = () => {
        setCoverFile(null);
        setCoverPreview(null);
        setRemoveCover(true);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const updateTrack = (key: number, field: keyof Track, fieldValue: string) => {
        setTracks(prev => prev.map(track => (track.key === key ? { ...track, [field]: fieldValue } : track)));
    };

    const addTrack = () => {
        setTracks(prev => [...prev, createTrackDraft()]);
    };

    const removeTrack = (key: number) => {
        setTracks(prev => {
            const remaining = prev.filter(track => track.key !== key);
            return remaining.length > 0 ? remaining : [createTrackDraft()];
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const trimmedTitle = title.trim();
        const trimmedArtist = artist.trim();

        if (!trimmedTitle || !trimmedArtist) {
            toastService.error(t('search.manualRequired'));
            return;
        }

        setIsSubmitting(true);

        try {
            const formData = new FormData();
            formData.append('title', trimmedTitle);
            formData.append('artist', trimmedArtist);
            formData.append('year', year.trim());
            formData.append('format', format);
            formData.append('label', label.trim());
            formData.append('catno', catno.trim());
            formData.append('genres', genres);
            formData.append('value', value.trim());

            const filledTracks = tracks
                .map(track => ({
                    position: track.position.trim(),
                    title: track.title.trim(),
                    duration: track.duration.trim(),
                    artist: track.artist?.trim() || '',
                }))
                .filter(track => track.position || track.title || track.duration || track.artist);
            formData.append('tracklist', JSON.stringify(filledTracks));

            if (coverFile) {
                formData.append('cover', coverFile);
            }
            if (isEditing && removeCover) {
                formData.append('removeCover', 'true');
            }

            if (isEditing && item) {
                const { item: updated } = await updateManualAlbum(item._id, formData);
                toastService.success(t('search.manualUpdateSuccess', { title: trimmedTitle }));
                onSaved?.(updated);
            } else {
                await addManualAlbum(formData);
                toastService.success(t('search.manualSuccess', { title: trimmedTitle }));
                resetForm();
            }
        } catch (err) {
            console.error('Error saving manual album:', err);
            // Covers the 413 the upload middleware returns for oversized files.
            if (isApiError(err) && err.serverMessage) {
                toastService.error(err.serverMessage);
            } else {
                toastService.error(isEditing ? t('search.manualUpdateError') : t('search.manualError'));
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className={isEditing ? '' : 'max-w-xl mx-auto'}>
            <div className="card bg-base-200 shadow-card">
                <div className="card-body">
                    <h3 className="card-title text-lg mb-4">
                        <Music className="w-5 h-5" />
                        {isEditing ? t('search.manualEditTitle') : t('search.manualTitle')}
                    </h3>

                    {/* Cover Image Upload */}
                    <div className="flex flex-col mb-4">
                        <label className="label w-full justify-between">
                            <span className="text-sm">{t('search.coverImage')}</span>
                            <span className="text-xs text-base-content/50">{t('search.optional')}</span>
                        </label>
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            {/* Preview or Placeholder */}
                            <div className="relative w-24 h-24 rounded-box overflow-hidden bg-base-300 flex items-center justify-center">
                                {coverPreview ? (
                                    <>
                                        <img
                                            src={coverPreview}
                                            alt="Cover preview"
                                            className="w-full h-full object-cover"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleRemoveCover}
                                            className="absolute top-1 right-1 btn btn-circle btn-xs btn-error"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </>
                                ) : (
                                    <Music className="w-8 h-8 text-base-content/50" />
                                )}
                            </div>

                            {/* Upload Button */}
                            <div className="flex-1 flex flex-col gap-1">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={handleFileChange}
                                    className="hidden"
                                    id="cover-upload"
                                />
                                <label
                                    htmlFor="cover-upload"
                                    className="btn btn-outline gap-2 cursor-pointer"
                                >
                                    <Upload className="w-4 h-4" />
                                    {coverPreview ? t('search.replaceCover') : t('search.uploadCover')}
                                </label>
                                <p className="text-xs text-base-content/50">
                                    {t('search.coverHint')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Album Title */}
                    <div className="flex flex-col">
                        <label className="label">
                            <span className="text-sm">{t('common.album')} *</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={t('search.albumPlaceholder')}
                            className="input w-full"
                            required
                        />
                    </div>

                    {/* Artist */}
                    <div className="flex flex-col">
                        <label className="label">
                            <span className="text-sm">{t('common.artist')} *</span>
                        </label>
                        <input
                            type="text"
                            value={artist}
                            onChange={(e) => setArtist(e.target.value)}
                            placeholder={t('search.artistPlaceholder')}
                            className="input w-full"
                            required
                        />
                    </div>

                    {/* Year + Format */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col">
                            <label className="label w-full justify-between">
                                <span className="text-sm">{t('common.year')}</span>
                                <span className="text-xs text-base-content/50">{t('search.optional')}</span>
                            </label>
                            <input
                                type="text"
                                value={year}
                                onChange={(e) => setYear(e.target.value)}
                                placeholder="2024"
                                className="input w-full"
                                maxLength={4}
                            />
                        </div>

                        <div className="flex flex-col">
                            <label className="label">
                                <span className="text-sm">{t('common.format')} *</span>
                            </label>
                            <select
                                value={format}
                                onChange={(e) => setFormat(e.target.value)}
                                className="select w-full"
                            >
                                {FORMATS.map((f) => (
                                    <option key={f} value={f}>
                                        {t(`formats.${f.toLowerCase()}`)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Label + Catalog number */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col">
                            <label className="label w-full justify-between">
                                <span className="text-sm">{t('album.label')}</span>
                                <span className="text-xs text-base-content/50">{t('search.optional')}</span>
                            </label>
                            <input
                                type="text"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                placeholder="Blue Note"
                                className="input w-full"
                            />
                        </div>

                        <div className="flex flex-col">
                            <label className="label w-full justify-between">
                                <span className="text-sm">{t('album.catalogNumber')}</span>
                                <span className="text-xs text-base-content/50">{t('search.optional')}</span>
                            </label>
                            <input
                                type="text"
                                value={catno}
                                onChange={(e) => setCatno(e.target.value)}
                                placeholder="BLP 1577"
                                className="input w-full"
                            />
                        </div>
                    </div>

                    {/* Genres + Value */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col">
                            <label className="label w-full justify-between">
                                <span className="text-sm">{t('album.genres')}</span>
                                <span className="text-xs text-base-content/50">{t('search.optional')}</span>
                            </label>
                            <input
                                type="text"
                                value={genres}
                                onChange={(e) => setGenres(e.target.value)}
                                placeholder={t('search.genresPlaceholder')}
                                className="input w-full"
                            />
                        </div>

                        <div className="flex flex-col">
                            <label className="label w-full justify-between">
                                <span className="text-sm">{t('search.valueUsd')}</span>
                                <span className="text-xs text-base-content/50">{t('search.optional')}</span>
                            </label>
                            <input
                                type="number"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                placeholder="0.00"
                                className="input w-full"
                                min={0}
                                step="0.01"
                            />
                        </div>
                    </div>

                    {/* Tracklist */}
                    <div className="flex flex-col mt-2">
                        <div className="flex items-center justify-between mb-1">
                            <label className="label p-0">
                                <span className="text-sm">{t('album.tracklist')}</span>
                            </label>
                            <button
                                type="button"
                                onClick={addTrack}
                                className="btn btn-ghost btn-xs gap-1"
                            >
                                <Plus className="w-3 h-3" />
                                {t('search.addTrack')}
                            </button>
                        </div>

                        <div className="flex flex-col gap-2">
                            {tracks.map((track) => (
                                <div key={track.key} className="flex items-start gap-2">
                                    <input
                                        type="text"
                                        value={track.position}
                                        onChange={(e) => updateTrack(track.key, 'position', e.target.value)}
                                        placeholder={t('search.trackPosition')}
                                        aria-label={t('search.trackPosition')}
                                        className="input input-sm w-16 shrink-0"
                                    />
                                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                                        <input
                                            type="text"
                                            value={track.title}
                                            onChange={(e) => updateTrack(track.key, 'title', e.target.value)}
                                            placeholder={t('search.trackTitle')}
                                            aria-label={t('search.trackTitle')}
                                            className="input input-sm w-full"
                                        />
                                        <input
                                            type="text"
                                            value={track.artist || ''}
                                            onChange={(e) => updateTrack(track.key, 'artist', e.target.value)}
                                            placeholder={t('search.trackArtist')}
                                            aria-label={t('search.trackArtist')}
                                            className="input input-sm w-full"
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        value={track.duration}
                                        onChange={(e) => updateTrack(track.key, 'duration', e.target.value)}
                                        placeholder={t('search.trackDuration')}
                                        aria-label={t('search.trackDuration')}
                                        className="input input-sm w-20 shrink-0"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeTrack(track.key)}
                                        className="btn btn-ghost btn-sm btn-square text-base-content/60 hover:text-error shrink-0"
                                        aria-label={t('search.removeTrack')}
                                        title={t('search.removeTrack')}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="card-actions justify-end mt-6">
                        {isEditing ? (
                            <>
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={onCancel}
                                    disabled={isSubmitting}
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={isSubmitting || !title.trim() || !artist.trim()}
                                >
                                    {isSubmitting ? (
                                        <span className="loading loading-spinner loading-sm"></span>
                                    ) : (
                                        t('common.save')
                                    )}
                                </button>
                            </>
                        ) : (
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={isSubmitting || !title.trim() || !artist.trim()}
                            >
                                {isSubmitting ? (
                                    <span className="loading loading-spinner loading-sm"></span>
                                ) : (
                                    t('common.add')
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </form>
    );
};

export default ManualAlbumForm;
