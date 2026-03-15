import { useState, useEffect } from 'react';
import { MultiPageInvoiceUpload } from './MultiPageInvoiceUpload';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, TrendingUp, Lock, Zap } from 'lucide-react';
import { SubscriptionService } from '@/lib/subscriptionService';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface InvoiceUploadWithLimitsProps {
  onFilesSelected: (files: File[]) => void;
  onConfirm: () => Promise<void>;
  isProcessing: boolean;
  disabled?: boolean;
}

export function InvoiceUploadWithLimits({
  onFilesSelected,
  onConfirm,
  isProcessing,
  disabled = false
}: InvoiceUploadWithLimitsProps) {
  const navigate = useNavigate();
  const [canUpload, setCanUpload] = useState(true);
  const [usageData, setUsageData] = useState<{
    current: number;
    limit: number;
    percentage: number;
  } | null>(null);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [checkingLimits, setCheckingLimits] = useState(true);

  useEffect(() => {
    checkUploadLimits();
  }, []);

  const checkUploadLimits = async () => {
    setCheckingLimits(true);
    const result = await SubscriptionService.canUploadInvoice();
    
    setCanUpload(result.allowed);
    setUsageData({
      current: result.current,
      limit: result.limit,
      percentage: result.percentage
    });
    
    if (!result.allowed && result.reason) {
      toast.error(result.reason);
    }
    
    setCheckingLimits(false);
  };

  const handleFilesSelected = (files: File[]) => {
    if (!canUpload) {
      setShowLimitDialog(true);
      return;
    }
    onFilesSelected(files);
  };

  const handleConfirm = async () => {
    if (!canUpload) {
      setShowLimitDialog(true);
      return;
    }

    try {
      // Execute the upload
      await onConfirm();
      
      // Increment counter after successful upload
      const incremented = await SubscriptionService.incrementInvoiceCount();
      
      if (incremented) {
        // Refresh limits
        await checkUploadLimits();
        
        // Show warning if approaching limit
        if (usageData) {
          SubscriptionService.showUsageWarning(
            usageData.current + 1,
            usageData.limit
          );
        }
      }
    } catch (error) {
      console.error('❌ Error during invoice upload:', error);
      throw error;
    }
  };

  const handleUpgrade = () => {
    setShowLimitDialog(false);
    navigate('/subscriptions');
  };

  const getUsageBadgeColor = () => {
    if (!usageData) return 'bg-gray-100 text-gray-700';
    return SubscriptionService.getUsageBadgeColor(usageData.percentage);
  };

  const formatLimit = (limit: number) => {
    return limit === -1 ? '∞' : limit.toString();
  };

  if (checkingLimits) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Usage Counter Card */}
      {usageData && (
        <Card className={`border-2 ${canUpload ? 'border-indigo-200 bg-indigo-50' : 'border-red-200 bg-red-50'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${canUpload ? 'bg-indigo-600' : 'bg-red-600'}`}>
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Fatture utilizzate questo mese
                  </p>
                  <p className="text-xs text-slate-600">
                    Il contatore si resetta automaticamente ogni mese
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge 
                  variant="outline" 
                  className={`text-lg font-bold px-4 py-2 ${getUsageBadgeColor()}`}
                >
                  {usageData.current} / {formatLimit(usageData.limit)}
                </Badge>
                {usageData.limit !== -1 && (
                  <p className="text-xs text-slate-500 mt-1">
                    {Math.round(usageData.percentage)}% utilizzato
                  </p>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {usageData.limit !== -1 && (
              <div className="mt-3">
                <div className="w-full bg-white rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      usageData.percentage < 50
                        ? 'bg-green-500'
                        : usageData.percentage < 80
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(usageData.percentage, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Warning Alert when approaching limit */}
      {usageData && usageData.percentage >= 80 && usageData.percentage < 100 && (
        <Alert className="border-yellow-300 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>Attenzione!</strong> Stai per raggiungere il limite mensile. 
            Considera di aggiornare il tuo piano per continuare senza interruzioni.
            <Button
              variant="link"
              className="text-yellow-700 underline p-0 h-auto ml-2"
              onClick={handleUpgrade}
            >
              Visualizza piani
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Limit Reached Alert */}
      {!canUpload && (
        <Alert className="border-red-300 bg-red-50">
          <Lock className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Limite raggiunto!</strong> Hai utilizzato tutte le {usageData?.limit} fatture 
            disponibili per questo mese. Aggiorna il tuo piano per continuare.
            <Button
              variant="default"
              size="sm"
              className="mt-2 bg-red-600 hover:bg-red-700"
              onClick={handleUpgrade}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Aggiorna Piano
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Upload Component */}
      <MultiPageInvoiceUpload
        onFilesSelected={handleFilesSelected}
        onConfirm={handleConfirm}
        isProcessing={isProcessing}
        disabled={disabled || !canUpload}
      />

      {/* Limit Reached Dialog */}
      <Dialog open={showLimitDialog} onOpenChange={setShowLimitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-red-600" />
              Limite Raggiunto
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-4">
              <p>
                Hai raggiunto il limite di <strong>{usageData?.limit} fatture</strong> per 
                il tuo piano corrente questo mese.
              </p>
              <p>
                Per continuare a caricare fatture, aggiorna il tuo piano di abbonamento:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li><strong>Basic:</strong> 50 fatture/mese</li>
                <li><strong>Pro:</strong> 200 fatture/mese</li>
                <li><strong>Premium:</strong> Fatture illimitate</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowLimitDialog(false)}
              className="flex-1"
            >
              Annulla
            </Button>
            <Button
              onClick={handleUpgrade}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Visualizza Piani
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}