import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, X, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

const CameraCaptureOverlay: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().then(() => setReady(true)).catch(() => setReady(true));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Camera non disponibile');
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const handleClose = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    onClose();
  }, [onClose]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
      streamRef.current?.getTracks().forEach(t => t.stop());
      onCapture(file);
    }, 'image/jpeg', 0.92);
  }, [onCapture]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.95)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {error ? (
        <div className="text-white text-center p-8 space-y-4">
          <p className="text-red-400 font-semibold">⚠️ {error}</p>
          <p className="text-sm text-slate-300">La fotocamera non è accessibile. Usa il pulsante Galleria.</p>
          <Button variant="outline" onClick={handleClose} className="text-white border-white">
            Chiudi
          </Button>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: '100%', maxWidth: 480, borderRadius: 12, background: '#000' }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <div style={{ display: 'flex', gap: 24, marginTop: 24, alignItems: 'center' }}>
            <button
              onClick={handleClose}
              style={{
                background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
                width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X className="h-6 w-6 text-white" />
            </button>
            <button
              onClick={handleCapture}
              disabled={!ready}
              style={{
                background: ready ? '#fff' : '#888', border: '4px solid rgba(255,255,255,0.5)',
                borderRadius: '50%', width: 72, height: 72,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: ready ? 'pointer' : 'not-allowed',
              }}
            >
              <Circle className="h-8 w-8 text-slate-800" />
            </button>
          </div>
          {!ready && !error && (
            <p className="text-slate-400 text-sm mt-4">Avvio fotocamera…</p>
          )}
        </>
      )}
    </div>
  );
};

// Hook riutilizzabile per aprire la camera
export function useCameraCapture(onFile: (file: File) => void) {
  const [open, setOpen] = useState(false);

  const openCamera = useCallback(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      // fallback: trigger input capture
      return false;
    }
    setOpen(true);
    return true;
  }, []);

  const handleCapture = useCallback((file: File) => {
    setOpen(false);
    onFile(file);
  }, [onFile]);

  const handleClose = useCallback(() => setOpen(false), []);

  const overlay = open ? (
    <CameraCaptureOverlay onCapture={handleCapture} onClose={handleClose} />
  ) : null;

  return { openCamera, overlay, isCameraOpen: open };
}

export default CameraCaptureOverlay;