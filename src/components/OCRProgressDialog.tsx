import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CheckCircle2, X } from "lucide-react";
import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";

interface OCRProgressDialogProps {
  isOpen: boolean;
  phase: 1 | 2 | 3;
  progress: number;
  currentZone?: string;
  estimatedTime?: number;
  onClose?: () => void;
}

export function OCRProgressDialog({
  isOpen,
  phase,
  progress,
  currentZone,
  estimatedTime,
  onClose
}: OCRProgressDialogProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [displayPhase, setDisplayPhase] = useState(phase);

  // Smooth progress animation
  useEffect(() => {
    if (!isOpen) return;
    
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
  }, [progress, isOpen]);

  // Smooth phase transition
  useEffect(() => {
    if (phase !== displayPhase) {
      setDisplayPhase(phase);
    }
  }, [phase, displayPhase]);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      setDisplayProgress(0);
      setDisplayPhase(1);
    }
  }, [isOpen]);

  const phaseNames = {
    1: 'Analisi Rapida',
    2: 'Estrazione OCR',
    3: 'Strutturazione Dati'
  };
  
  const zoneNames: Record<string, string> = {
    header: 'Intestazione',
    table: 'Tabella Prodotti',
    totals: 'Totali',
    'table-top': 'Prodotti (parte alta)',
    'table-bottom': 'Totali parziali'
  };

  const phaseDescriptions = {
    1: 'Analizzando layout e zone della fattura...',
    2: 'Estraendo testo dalle zone rilevanti...',
    3: 'Strutturando i dati estratti...'
  };

  const isComplete = phase === 3 && displayProgress >= 95;
  const roundedProgress = Math.round(displayProgress);

  const getPhaseIcon = (currentPhase: number) => {
    if (currentPhase < phase) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (currentPhase === phase) return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    return <span className="w-4 h-4 rounded-full border-2 border-muted"></span>;
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Elaborazione Fattura
          </DialogTitle>
          <DialogDescription>
            {phaseDescriptions[phase]}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>Fase {phase}/3: {phaseNames[phase]}</span>
              <span className="text-muted-foreground">{roundedProgress}%</span>
            </div>
            
            <Progress value={displayProgress} className="h-2" />
            
            {currentZone && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse"></span>
                Elaborazione: {zoneNames[currentZone] || currentZone}
              </p>
            )}
            
            {estimatedTime !== undefined && estimatedTime > 0 && (
              <p className="text-xs text-muted-foreground">
                Tempo stimato rimanente: ~{Math.round(estimatedTime)}s
              </p>
            )}
          </div>
          
          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium">Processo in 3 fasi:</p>
            <ul className="space-y-1 ml-4">
              <li className={phase >= 1 ? "text-foreground flex items-center gap-2" : ""}>
                {getPhaseIcon(1)} Analisi layout e cache
              </li>
              <li className={phase >= 2 ? "text-foreground flex items-center gap-2" : ""}>
                {getPhaseIcon(2)} OCR parallelo su zone
              </li>
              <li className={phase >= 3 ? "text-foreground flex items-center gap-2" : ""}>
                {getPhaseIcon(3)} Strutturazione con AI
              </li>
            </ul>
          </div>

          {/* Auto-close button when complete */}
          {isComplete && (
            <div className="flex justify-end pt-2">
              <Button 
                onClick={onClose} 
                size="sm" 
                className="bg-green-500 hover:bg-green-600"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Completato!
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
