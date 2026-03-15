import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, X, RotateCw, Check, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface CameraCaptureProps {
  onCapture: (files: File[]) => void;
  onClose: () => void;
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImages, setCapturedImages] = useState<{ blob: Blob; preview: string }[]>([]);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [facingMode]);

  const startCamera = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Starting camera with facingMode:', facingMode);
      
      // Stop existing stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      console.log('Camera stream obtained:', mediaStream.getTracks().length, 'tracks');

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Wait for video to be ready
        await videoRef.current.play();
      }
      setIsLoading(false);
      toast.success('📸 Fotocamera attivata! Inizia a scattare foto');
    } catch (err) {
      console.error('Error accessing camera:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
        setError('Permessi fotocamera negati. Abilita i permessi nelle impostazioni del browser.');
      } else if (errorMessage.includes('not supported')) {
        setError('Fotocamera non supportata su questo dispositivo/browser. Usa "Carica File" invece.');
      } else {
        setError('Impossibile accedere alla fotocamera. Prova a usare "Carica File".');
      }
      
      setIsLoading(false);
      toast.error('Errore fotocamera. Usa "Carica File" per continuare.', { duration: 5000 });
      
      // Auto-close after 3 seconds if camera fails
      setTimeout(() => {
        onClose();
      }, 3000);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('Camera track stopped:', track.kind);
      });
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    canvas.toBlob((blob) => {
      if (!blob) return;

      const preview = URL.createObjectURL(blob);
      setCapturedImages(prev => [...prev, { blob, preview }]);
      
      // Show success feedback
      toast.success(`📸 Foto ${capturedImages.length + 1} scattata!`, {
        duration: 2000,
      });

      // Flash effect
      const flashDiv = document.createElement('div');
      flashDiv.className = 'fixed inset-0 bg-white pointer-events-none z-[60] animate-flash';
      document.body.appendChild(flashDiv);
      setTimeout(() => flashDiv.remove(), 200);
    }, 'image/jpeg', 0.95);
  };

  const removeImage = (index: number) => {
    setCapturedImages(prev => {
      const newImages = prev.filter((_, i) => i !== index);
      URL.revokeObjectURL(prev[index].preview);
      return newImages;
    });
    toast.success('Foto rimossa');
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    toast.info('Cambio fotocamera...');
  };

  const handleFinish = async () => {
    if (capturedImages.length === 0) {
      toast.error('Scatta almeno una foto prima di confermare');
      return;
    }

    // Convert blobs to files
    const files = await Promise.all(
      capturedImages.map(async (img, index) => {
        return new File(
          [img.blob],
          `photo_${Date.now()}_${index + 1}.jpg`,
          { type: 'image/jpeg' }
        );
      })
    );

    onCapture(files);
    stopCamera();
    onClose();
  };

  const handleCancel = () => {
    // Clean up object URLs
    capturedImages.forEach(img => URL.revokeObjectURL(img.preview));
    stopCamera();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Video Preview */}
      <div className="relative w-full h-full">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p>Caricamento fotocamera...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-center text-white p-6 max-w-md">
              <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
              <p className="text-lg mb-2 font-semibold">Errore Fotocamera</p>
              <p className="text-sm mb-4 text-gray-300">{error}</p>
              <p className="text-xs mb-4 text-gray-400">
                Usa il pulsante "Carica File" per selezionare le foto dalla galleria.
              </p>
              <Button onClick={handleCancel} variant="outline" className="text-black">
                Chiudi
              </Button>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* Hidden canvas for capturing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/50 to-transparent">
          <div className="flex justify-between items-center">
            <Button
              onClick={handleCancel}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
            >
              <X className="h-6 w-6" />
            </Button>
            <div className="text-white font-semibold">
              {capturedImages.length} {capturedImages.length === 1 ? 'foto' : 'foto'}
            </div>
            <Button
              onClick={switchCamera}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              disabled={isLoading || !!error}
            >
              <RotateCw className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Captured Images Preview (Bottom) */}
        {capturedImages.length > 0 && (
          <div className="absolute bottom-32 left-0 right-0 px-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {capturedImages.map((img, index) => (
                <div key={index} className="relative flex-shrink-0">
                  <img
                    src={img.preview}
                    alt={`Foto ${index + 1}`}
                    className="w-16 h-16 object-cover rounded-lg border-2 border-white"
                  />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs text-center py-0.5 rounded-b-lg">
                    {index + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/70 to-transparent">
          <div className="flex items-center justify-center gap-4">
            {/* Capture Button */}
            <Button
              onClick={capturePhoto}
              disabled={isLoading || !!error}
              size="lg"
              className="h-20 w-20 rounded-full bg-white hover:bg-gray-200 text-black shadow-lg"
            >
              <Camera className="h-10 w-10" />
            </Button>

            {/* Finish Button (only show when photos captured) */}
            {capturedImages.length > 0 && (
              <Button
                onClick={handleFinish}
                size="lg"
                className="h-16 px-8 bg-green-600 hover:bg-green-700 text-white shadow-lg gap-2"
              >
                <Check className="h-6 w-6" />
                Fine ({capturedImages.length})
              </Button>
            )}
          </div>

          {/* Instructions */}
          <div className="text-center mt-4 text-white text-sm">
            {capturedImages.length === 0 ? (
              <p>📸 Scatta la prima foto della fattura</p>
            ) : (
              <p>📸 Continua a scattare o premi "Fine" quando hai finito</p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes flash {
          0% { opacity: 0; }
          50% { opacity: 0.8; }
          100% { opacity: 0; }
        }
        .animate-flash {
          animation: flash 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}