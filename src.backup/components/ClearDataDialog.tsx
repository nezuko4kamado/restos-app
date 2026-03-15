import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';
import { useTranslations, type Language } from '@/lib/i18n';

interface ClearDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  language: Language;
}

export function ClearDataDialog({ open, onOpenChange, onConfirm, language }: ClearDataDialogProps) {
  const t = useTranslations(language);

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-red-500 via-orange-500 to-red-600 flex items-center justify-center shadow-2xl animate-pulse">
              {/* Outer glow effect */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-red-400 to-orange-400 blur-xl opacity-60 animate-pulse"></div>
              
              {/* Inner shadow for depth */}
              <div className="absolute inset-1 rounded-full bg-gradient-to-br from-red-600 to-orange-700 shadow-inner"></div>
              
              {/* Icon with 3D effect */}
              <AlertTriangle className="h-7 w-7 text-white relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] animate-bounce" 
                style={{ 
                  filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.5))',
                  animation: 'bounce 2s infinite'
                }} 
              />
              
              {/* Highlight for 3D effect */}
              <div className="absolute top-2 left-3 w-4 h-4 rounded-full bg-white opacity-30 blur-sm"></div>
            </div>
            <AlertDialogTitle className="text-xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
              {t.clearDataDialogTitle}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-slate-700 leading-relaxed">
            {t.clearDataDialogMessage}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel className="border-2 border-slate-300 hover:bg-slate-50">
            {t.no}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white shadow-lg"
          >
            {t.yes}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}