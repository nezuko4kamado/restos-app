import { 
  AlertDialog, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

interface ModernDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
}

export function ModernDeleteDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText
}: ModernDeleteDialogProps) {
  const { t } = useLanguage();

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md rounded-3xl border-none shadow-2xl bg-white p-0 overflow-hidden">
        {/* Header with gradient background and large icon */}
        <div className="bg-gradient-to-br from-red-500 via-orange-500 to-red-600 p-8 text-center relative overflow-hidden">
          {/* Animated background circles */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-white/10 rounded-full translate-x-1/2 translate-y-1/2"></div>
          
          {/* Icon */}
          <div className="relative inline-flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-xl mb-4 animate-pulse">
            <AlertTriangle className="h-10 w-10 text-red-600" />
          </div>
          
          {/* Title */}
          <AlertDialogHeader className="relative">
            <AlertDialogTitle className="text-2xl font-bold text-white mb-2">
              {title || t('confirmDelete')}
            </AlertDialogTitle>
          </AlertDialogHeader>
        </div>

        {/* Description */}
        <div className="p-6">
          <AlertDialogDescription className="text-center text-base text-slate-700 leading-relaxed whitespace-pre-line">
            {description}
          </AlertDialogDescription>
        </div>

        {/* Footer with modern buttons */}
        <AlertDialogFooter className="p-6 pt-0 flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:flex-1 h-12 rounded-xl border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50 font-semibold text-slate-700 transition-all hover:scale-105 active:scale-95"
          >
            {cancelText || t('cancel')}
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="w-full sm:flex-1 h-12 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
          >
            {confirmText || t('delete')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}