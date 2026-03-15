import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { X, FileText, Zap } from 'lucide-react';

interface InvoiceLoadingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  progress: number;
  status: string;
  currentFile?: string;
  totalFiles?: number;
  currentFileIndex?: number;
  isDone?: boolean; // New optional prop for precise completion control
}

export function InvoiceLoadingDialog({
  isOpen,
  onClose,
  progress,
  status,
  currentFile,
  totalFiles = 1,
  currentFileIndex = 1,
  isDone = false
}: InvoiceLoadingDialogProps) {
  const [displayProgress, setDisplayProgress] = useState(0);

  // Optimized useEffect - only depends on progress, uses function inside setDisplayProgress
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayProgress(prev => {
        const diff = progress - prev;
        if (Math.abs(diff) < 1) {
          return progress;
        }
        return prev + diff * 0.3;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [progress]); // Only progress in dependencies - optimization applied

  // Debug logging
  useEffect(() => {
    if (isOpen) {
      console.log('🔵 [InvoiceLoadingDialog] State update:', {
        progress,
        displayProgress,
        status,
        currentFile,
        isOpen
      });
    }
  }, [isOpen, progress, displayProgress, status, currentFile]);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      console.log('🧹 [InvoiceLoadingDialog] Cleaning up');
      setDisplayProgress(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const roundedProgress = Math.round(displayProgress);
  
  // Use isDone prop for completion control, fallback to progress-based logic
  const isCompleted = isDone || (roundedProgress >= 100);

  // Safe status check with null/undefined protection
  const safeStatus = status || '';
  const hasError = safeStatus.toLowerCase().includes('error');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Procesando Factura
            {totalFiles > 1 && (
              <span className="text-sm text-muted-foreground">
                ({currentFileIndex}/{totalFiles})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Current file info */}
          {currentFile && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Archivo:</span> {currentFile}
            </div>
          )}
          
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progreso</span>
              <span className="font-medium">{roundedProgress}%</span>
            </div>
            <Progress 
              value={displayProgress} 
              className="w-full h-2"
            />
          </div>
          
          {/* Status */}
          <div className="flex items-center gap-2 text-sm">
            {!isCompleted && <Zap className="h-4 w-4 animate-pulse text-blue-500" />}
            <span className={isCompleted ? "text-green-600 font-medium" : "text-muted-foreground"}>
              {safeStatus || 'Iniciando procesamiento...'}
            </span>
          </div>
          
          {/* Processing stages indicator */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className={`text-center p-2 rounded ${roundedProgress >= 25 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
              Preparando
            </div>
            <div className={`text-center p-2 rounded ${roundedProgress >= 50 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
              OCR
            </div>
            <div className={`text-center p-2 rounded ${roundedProgress >= 75 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
              Procesando
            </div>
            <div className={`text-center p-2 rounded ${roundedProgress >= 100 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              Completo
            </div>
          </div>
          
          {/* Close button - only show when completed or if there's an error */}
          {(isCompleted || hasError) && (
            <div className="flex justify-end pt-2">
              <Button onClick={onClose} size="sm">
                <X className="h-4 w-4 mr-2" />
                Cerrar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}