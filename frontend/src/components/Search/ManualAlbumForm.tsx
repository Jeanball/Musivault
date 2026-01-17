import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toastService } from '../../utils/toast';
import { Upload, X, Music } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const FORMATS = ['Vinyl', 'CD', 'Cassette'];

const ManualAlbumForm: React.FC = () => {
    const { t } = useTranslation();

    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState('');
    const [year, setYear] = useState('');
    const [format, setFormat] = useState(FORMATS[0]);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCoverFile(file);
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
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim() || !artist.trim()) {
            toastService.error(t('search.manualRequired'));
            return;
        }

        setIsSubmitting(true);

        try {
            const formData = new FormData();
            formData.append('title', title.trim());
            formData.append('artist', artist.trim());
            formData.append('year', year.trim());
            formData.append('format', format);
            if (coverFile) {
                formData.append('cover', coverFile);
            }

            await axios.post(`${API_BASE_URL}/api/collection/manual`, formData, {
                withCredentials: true,
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            toastService.success(t('search.manualSuccess', { title: title.trim() }));

            // Reset form
            setTitle('');
            setArtist('');
            setYear('');
            setFormat(FORMATS[0]);
            setCoverFile(null);
            setCoverPreview(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (err) {
            console.error('Error adding manual album:', err);
            if (axios.isAxiosError(err) && err.response?.data?.message) {
                toastService.error(err.response.data.message);
            } else {
                toastService.error(t('search.manualError'));
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="max-w-xl mx-auto">
            <div className="card bg-base-200 shadow-xl">
                <div className="card-body">
                    <h3 className="card-title text-lg mb-4">
                        <Music className="w-5 h-5" />
                        {t('search.manualTitle')}
                    </h3>

                    {/* Cover Image Upload */}
                    <div className="form-control mb-4">
                        <label className="label">
                            <span className="label-text">{t('search.coverImage')}</span>
                            <span className="label-text-alt text-gray-500">{t('search.optional')}</span>
                        </label>
                        <div className="flex items-center gap-4">
                            {/* Preview or Placeholder */}
                            <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-base-300 flex items-center justify-center">
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
                                    <Music className="w-8 h-8 text-gray-500" />
                                )}
                            </div>

                            {/* Upload Button */}
                            <div className="flex-1">
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
                                    className="btn btn-outline btn-sm gap-2 cursor-pointer"
                                >
                                    <Upload className="w-4 h-4" />
                                    {t('search.uploadCover')}
                                </label>
                                <p className="text-xs text-gray-500 mt-1">
                                    {t('search.coverHint')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Album Title */}
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">{t('common.album')} *</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={t('search.albumPlaceholder')}
                            className="input input-bordered w-full"
                            required
                        />
                    </div>

                    {/* Artist */}
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">{t('common.artist')} *</span>
                        </label>
                        <input
                            type="text"
                            value={artist}
                            onChange={(e) => setArtist(e.target.value)}
                            placeholder={t('search.artistPlaceholder')}
                            className="input input-bordered w-full"
                            required
                        />
                    </div>

                    {/* Year */}
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">{t('common.year')}</span>
                            <span className="label-text-alt text-gray-500">{t('search.optional')}</span>
                        </label>
                        <input
                            type="text"
                            value={year}
                            onChange={(e) => setYear(e.target.value)}
                            placeholder="2024"
                            className="input input-bordered w-full"
                            maxLength={4}
                        />
                    </div>

                    {/* Format */}
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">{t('common.format')} *</span>
                        </label>
                        <select
                            value={format}
                            onChange={(e) => setFormat(e.target.value)}
                            className="select select-bordered w-full"
                        >
                            {FORMATS.map((f) => (
                                <option key={f} value={f}>
                                    {t(`formats.${f.toLowerCase()}`)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Submit Button */}
                    <div className="card-actions justify-end mt-6">
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
                    </div>
                </div>
            </div>
        </form>
    );
};

export default ManualAlbumForm;
