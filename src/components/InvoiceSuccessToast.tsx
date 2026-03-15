import { CheckCircle2, TrendingUp, RefreshCw, Minus, Clock, Building2 } from 'lucide-react';

interface InvoiceSuccessToastProps {
  successCount: number;
  updatedCount: number;
  skippedCount: number;
  supplierName: string;
  duration: number; // in seconds
  totalPages?: number;
}

export function InvoiceSuccessToast({
  successCount,
  updatedCount,
  skippedCount,
  supplierName,
  duration,
  totalPages
}: InvoiceSuccessToastProps) {
  const totalProducts = successCount + updatedCount + skippedCount;

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-2 border-green-200 dark:border-green-800 p-4 shadow-lg">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-2 h-2 bg-green-400 rounded-full animate-ping opacity-75" />
        <div className="absolute top-1/3 right-1/4 w-2 h-2 bg-emerald-400 rounded-full animate-ping opacity-75" style={{ animationDelay: '0.5s' }} />
        <div className="absolute bottom-1/4 left-1/3 w-2 h-2 bg-green-400 rounded-full animate-ping opacity-75" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            <div className="absolute inset-0 bg-green-500 rounded-full blur-lg opacity-50 animate-pulse" />
          </div>
          <div>
            <h4 className="font-bold text-green-800 dark:text-green-200 text-lg">
              Fattura importata con successo!
            </h4>
            <p className="text-sm text-green-700 dark:text-green-300">
              {totalProducts} prodotti elaborati{totalPages && totalPages > 1 ? ` da ${totalPages} pagine` : ''}
            </p>
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 gap-2">
          {successCount > 0 && (
            <div className="flex items-center gap-2 bg-white/50 dark:bg-slate-900/50 rounded-lg p-2">
              <div className="bg-green-100 dark:bg-green-900 p-1.5 rounded-full">
                <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400">Nuovi</p>
                <p className="font-bold text-green-700 dark:text-green-300">{successCount}</p>
              </div>
            </div>
          )}

          {updatedCount > 0 && (
            <div className="flex items-center gap-2 bg-white/50 dark:bg-slate-900/50 rounded-lg p-2">
              <div className="bg-blue-100 dark:bg-blue-900 p-1.5 rounded-full">
                <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400">Aggiornati</p>
                <p className="font-bold text-blue-700 dark:text-blue-300">{updatedCount}</p>
              </div>
            </div>
          )}

          {skippedCount > 0 && (
            <div className="flex items-center gap-2 bg-white/50 dark:bg-slate-900/50 rounded-lg p-2">
              <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-full">
                <Minus className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400">Invariati</p>
                <p className="font-bold text-slate-700 dark:text-slate-300">{skippedCount}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 bg-white/50 dark:bg-slate-900/50 rounded-lg p-2">
            <div className="bg-indigo-100 dark:bg-indigo-900 p-1.5 rounded-full">
              <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400">Tempo</p>
              <p className="font-bold text-indigo-700 dark:text-indigo-300">{(Number(duration) || 0).toFixed(1)}s</p>
            </div>
          </div>
        </div>

        {/* Supplier info */}
        <div className="flex items-center gap-2 pt-2 border-t border-green-200 dark:border-green-800">
          <Building2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <p className="text-sm text-green-700 dark:text-green-300">
            Fornitore: <span className="font-semibold">{supplierName}</span>
          </p>
        </div>
      </div>
    </div>
  );
}