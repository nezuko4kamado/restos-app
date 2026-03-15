import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, TrendingUp, Clock, FileText } from 'lucide-react';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useLoading } from '@/contexts/LoadingContext';

const UnifiedLoadingDialog = () => {
  const { loadingState, resetOCRState } = useLoading();
  const [displayProgress, setDisplayProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [autoCloseCountdown, setAutoCloseCountdown] = useState(2);

  const isOpen = loadingState.isOCRProcessing;
  const { currentState, productsFound, supplierName } = loadingState;

  // Elapsed time counter and progress calculation
  useEffect(() => {
    if (!isOpen) {
      console.log('🧹 [UnifiedLoadingDialog] Cleaning up');
      setDisplayProgress(0);
      setElapsedTime(0);
      setAutoCloseCountdown(2);
      return;
    }

    console.log('🔵 [UnifiedLoadingDialog] State update:', { isOpen, currentState });

    const startTime = Date.now();
    const timeInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedTime(elapsed);
      
      // Auto-update progress based on elapsed time
      if (currentState !== 'completed') {
        const timeProgress = Math.min((elapsed / 120) * 100, 95);
        setDisplayProgress(timeProgress);
      } else {
        setDisplayProgress(100);
      }
    }, 500);

    return () => {
      clearInterval(timeInterval);
    };
  }, [isOpen, currentState]);

  // Auto-close countdown
  useEffect(() => {
    if (currentState === 'completed' && isOpen) {
      const countdownInterval = setInterval(() => {
        setAutoCloseCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            resetOCRState();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(countdownInterval);
    }
  }, [currentState, isOpen, resetOCRState]);

  // Memoized computed values
  const progressPercentage = useMemo(() => Math.min(100, Math.max(0, displayProgress)), [displayProgress]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open && currentState !== 'extracting' && currentState !== 'analyzing') {
      resetOCRState();
    }
  }, [currentState, resetOCRState]);

  // Get message based on state
  const getStateMessage = useCallback(() => {
    switch (currentState) {
      case 'extracting':
        return 'Analizzando immagine...';
      case 'analyzing':
        return 'Estraendo dati prodotti...';
      case 'saving':
        return 'Salvando prodotti...';
      case 'completed':
        return 'Analisi completata!';
      default:
        return 'Processando...';
    }
  }, [currentState]);

  const isCompleted = currentState === 'completed';
  const isProcessing = !isCompleted;

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="sm:max-w-lg border-0 bg-white shadow-2xl rounded-2xl p-0 overflow-hidden"
        aria-describedby="unified-loading-description"
        onPointerDownOutside={(e) => {
          if (currentState === 'extracting' || currentState === 'analyzing') {
            e.preventDefault();
          }
        }}
      >
        <VisuallyHidden>
          <DialogTitle>Procesando factura</DialogTitle>
        </VisuallyHidden>
        
        <div className="p-6 space-y-4">
          {/* Success Header */}
          {isCompleted && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-green-900 mb-1">
                    Fattura importata con successo!
                  </h3>
                  <p className="text-sm text-green-700">
                    {productsFound} prodotti elaborati
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Processing Header */}
          {isProcessing && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-blue-900 mb-1">
                    Analisi in corso...
                  </h3>
                  <p className="text-sm text-blue-700">
                    {getStateMessage()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* New Products Card */}
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Nuovi
                </span>
              </div>
              <div className="text-3xl font-bold text-green-600">
                {productsFound}
              </div>
            </div>

            {/* Time Card */}
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Tempo
                </span>
              </div>
              <div className="text-3xl font-bold text-blue-600">
                {elapsedTime}s
              </div>
            </div>
          </div>

          {/* Supplier Info */}
          {supplierName && (
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-gray-600" />
                <div className="flex-1">
                  <span className="text-sm font-semibold text-gray-900">
                    Fornitore: <span className="text-green-700">{supplierName}</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* AI Analysis Status */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                {isCompleted ? (
                  <CheckCircle2 className="w-6 h-6 text-white" />
                ) : (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                )}
              </div>
              <div className="flex-1">
                <h4 className="text-base font-bold text-white mb-0.5">
                  Analisi fattura con AI
                </h4>
                <p className="text-sm text-blue-100">
                  {isCompleted ? 'Analisi completata!' : getStateMessage()}
                </p>
              </div>
            </div>
          </div>

          {/* Progress Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-blue-600">
                {productsFound} prodotti trovati
              </span>
              <span className="text-2xl font-bold text-blue-600">
                {progressPercentage.toFixed(0)}%
              </span>
            </div>
            <Progress 
              value={progressPercentage} 
              className="h-3 bg-gray-100"
            />
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex gap-4">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              </div>
            </div>
          </div>

          {/* Auto-close Message */}
          {isCompleted && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-900">
                  Chiusura automatica in {autoCloseCountdown} secondi...
                </span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UnifiedLoadingDialog;