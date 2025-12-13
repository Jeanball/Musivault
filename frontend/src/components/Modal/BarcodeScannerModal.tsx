import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, SwitchCamera } from 'lucide-react';

interface BarcodeScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScanSuccess: (decodedText: string) => void;
}

const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({ isOpen, onClose, onScanSuccess }) => {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
    const [selectedCameraIndex, setSelectedCameraIndex] = useState(0);

    useEffect(() => {
        if (isOpen) {
            Html5Qrcode.getCameras()
                .then((devices) => {
                    if (devices && devices.length > 0) {
                        setCameras(devices);
                        // Prefer the back camera if available
                        const backCameraIndex = devices.findIndex(d => d.label.toLowerCase().includes('back'));
                        setSelectedCameraIndex(backCameraIndex !== -1 ? backCameraIndex : 0);
                    } else {
                        setError('No cameras found on this device.');
                    }
                })
                .catch((err) => {
                    console.error('Error getting cameras:', err);
                    setError('Could not access cameras. Please ensure you have granted permission.');
                });
        }

        return () => {
            stopScanner();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && cameras.length > 0 && !isScanning) {
            startScanner(cameras[selectedCameraIndex].id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, cameras, selectedCameraIndex]);

    const startScanner = async (cameraId: string) => {
        if (scannerRef.current) {
            await stopScanner();
        }

        const html5QrCode = new Html5Qrcode("barcode-reader");
        scannerRef.current = html5QrCode;
        setError(null);

        try {
            await html5QrCode.start(
                cameraId,
                {
                    fps: 10,
                    qrbox: { width: 250, height: 150 },
                    aspectRatio: 1.0,
                },
                (decodedText) => {
                    onScanSuccess(decodedText);
                    stopScanner();
                    onClose();
                },
                () => {
                    // Ignore QR code not detected errors
                }
            );
            setIsScanning(true);
        } catch (err) {
            console.error('Error starting scanner:', err);
            setError('Failed to start scanner. Please check camera permissions.');
            setIsScanning(false);
        }
    };

    const stopScanner = async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
                scannerRef.current.clear();
            } catch (err) {
                // Ignore errors when stopping
            }
            scannerRef.current = null;
        }
        setIsScanning(false);
    };

    const handleSwitchCamera = async () => {
        if (cameras.length > 1) {
            await stopScanner();
            setSelectedCameraIndex((prev) => (prev + 1) % cameras.length);
        }
    };

    const handleClose = async () => {
        await stopScanner();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <dialog className="modal modal-open">
            <div className="modal-box w-11/12 max-w-lg p-0 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-base-200">
                    <div className="flex items-center gap-2">
                        <Camera className="w-5 h-5" />
                        <h3 className="font-bold text-lg">Scan Barcode</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        {cameras.length > 1 && (
                            <button
                                className="btn btn-ghost btn-sm btn-circle"
                                onClick={handleSwitchCamera}
                                title="Switch Camera"
                            >
                                <SwitchCamera className="w-5 h-5" />
                            </button>
                        )}
                        <button className="btn btn-ghost btn-sm btn-circle" onClick={handleClose}>
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Scanner Area */}
                <div className="relative bg-black" style={{ minHeight: '300px' }}>
                    <div id="barcode-reader" className="w-full"></div>
                    {!isScanning && !error && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="loading loading-spinner loading-lg text-primary"></span>
                        </div>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="p-4 bg-error/20 text-error text-center">
                        <p>{error}</p>
                    </div>
                )}

                {/* Instructions */}
                <div className="p-4 text-center text-sm text-gray-400">
                    Point your camera at the album's barcode.
                </div>
            </div>
            <form method="dialog" className="modal-backdrop">
                <button onClick={handleClose}>close</button>
            </form>
        </dialog>
    );
};

export default BarcodeScannerModal;
