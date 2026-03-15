import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TrendingDown, TrendingUp, Link2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { SimilarProductMatch } from '@/lib/productSimilarity';
import type { Supplier } from '@/types';
import { formatPrice } from '@/lib/currency';
import { saveProductCompatibility } from '@/lib/storageExtensions';

interface SimilarProductsSuggestionsProps {
  isOpen: boolean;
  onClose: () => void;
  matches: SimilarProductMatch[];
  suppliers: Supplier[];
  currency: string;
  onCompatibilitiesCreated: () => void;
}

export function SimilarProductsSuggestions({
  isOpen,
  onClose,
  matches,
  suppliers,
  currency,
  onCompatibilitiesCreated
}: SimilarProductsSuggestionsProps) {
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  // Generate unique key for each match
  const getMatchKey = (match: SimilarProductMatch) => 
    `${match.newProduct.id}-${match.existingProduct.id}`;

  // Toggle selection
  const toggleMatch = (match: SimilarProductMatch) => {
    const key = getMatchKey(match);
    setSelectedMatches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Select all matches
  const selectAll = () => {
    const allKeys = matches.map(getMatchKey);
    setSelectedMatches(new Set(allKeys));
  };

  // Deselect all matches
  const deselectAll = () => {
    setSelectedMatches(new Set());
  };

  // Get supplier name by ID
  const getSupplierName = (supplierId?: string) => {
    if (!supplierId) return 'Sconosciuto';
    return suppliers.find(s => s.id === supplierId)?.name || 'Sconosciuto';
  };

  // Create selected compatibilities
  const handleConfirm = async () => {
    if (selectedMatches.size === 0) {
      toast.error('Seleziona almeno una compatibilità da creare');
      return;
    }

    setIsCreating(true);
    const loadingToast = toast.loading(`Creazione di ${selectedMatches.size} compatibilità...`);

    try {
      let successCount = 0;
      let failCount = 0;

      for (const match of matches) {
        const key = getMatchKey(match);
        if (selectedMatches.has(key)) {
          try {
            await saveProductCompatibility(
              match.newProduct.id,
              match.existingProduct.id
            );
            successCount++;
          } catch (error) {
            console.error('Error creating compatibility:', error);
            failCount++;
          }
        }
      }

      if (successCount > 0) {
        toast.success(
          `✅ ${successCount} compatibilità create con successo!${failCount > 0 ? ` (${failCount} fallite)` : ''}`,
          { id: loadingToast, duration: 4000 }
        );
        onCompatibilitiesCreated();
        onClose();
      } else {
        toast.error('Errore nella creazione delle compatibilità', { id: loadingToast });
      }
    } catch (error) {
      console.error('Error in handleConfirm:', error);
      toast.error('Errore nella creazione delle compatibilità', { id: loadingToast });
    } finally {
      setIsCreating(false);
    }
  };

  // Skip all suggestions
  const handleSkip = () => {
    toast.info('Suggerimenti ignorati. Puoi sempre aggiungere compatibilità manualmente.');
    onClose();
  };

  if (matches.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-blue-600" />
            Prodotti Simili Trovati
          </DialogTitle>
          <DialogDescription>
            Abbiamo trovato {matches.length} possibili compatibilità tra i nuovi prodotti e quelli esistenti.
            Seleziona quali vuoi collegare per confrontare i prezzi.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between py-2 border-b">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {selectedMatches.size} di {matches.length} selezionati
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              disabled={selectedMatches.size === matches.length}
            >
              Seleziona tutti
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deselectAll}
              disabled={selectedMatches.size === 0}
            >
              Deseleziona tutti
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {matches.map((match) => {
              const key = getMatchKey(match);
              const isSelected = selectedMatches.has(key);
              const isCheaper = match.savings > 0;
              const newSupplier = getSupplierName(match.newProduct.supplier_id);
              const existingSupplier = getSupplierName(match.existingProduct.supplier_id);

              return (
                <div
                  key={key}
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                  onClick={() => toggleMatch(match)}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleMatch(match)}
                      className="mt-1"
                    />
                    
                    <div className="flex-1 space-y-2">
                      {/* Similarity Badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          Similarità: {match.similarity}%
                        </Badge>
                        {isCheaper && (
                          <Badge className="bg-green-600 text-white text-xs">
                            <TrendingDown className="h-3 w-3 mr-1" />
                            RISPARMIO {Math.abs(match.savingsPercent)}%
                          </Badge>
                        )}
                        {!isCheaper && match.savings < 0 && (
                          <Badge variant="destructive" className="text-xs">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Più caro {Math.abs(match.savingsPercent)}%
                          </Badge>
                        )}
                      </div>

                      {/* Product Comparison */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* New Product */}
                        <div className="space-y-1">
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            NUOVO PRODOTTO
                          </div>
                          <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                            {match.newProduct.name}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            Fornitore: {newSupplier}
                          </div>
                          <div className={`font-bold text-sm ${isCheaper ? 'text-green-600' : 'text-blue-600'}`}>
                            {formatPrice(match.newProduct.price, currency)}
                          </div>
                        </div>

                        {/* Existing Product */}
                        <div className="space-y-1">
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            PRODOTTO ESISTENTE
                          </div>
                          <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                            {match.existingProduct.name}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            Fornitore: {existingSupplier}
                          </div>
                          <div className={`font-bold text-sm ${!isCheaper ? 'text-green-600' : 'text-slate-600'}`}>
                            {formatPrice(match.existingProduct.price, currency)}
                          </div>
                        </div>
                      </div>

                      {/* Savings Info */}
                      {isCheaper && (
                        <div className="text-xs text-green-700 dark:text-green-400 font-medium bg-green-50 dark:bg-green-950 p-2 rounded">
                          💰 Risparmi {formatPrice(match.savings, currency)} scegliendo il nuovo prodotto
                        </div>
                      )}
                      {!isCheaper && match.savings < 0 && (
                        <div className="text-xs text-red-700 dark:text-red-400 font-medium bg-red-50 dark:bg-red-950 p-2 rounded">
                          ⚠️ Il nuovo prodotto costa {formatPrice(Math.abs(match.savings), currency)} in più
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={isCreating}
            className="w-full sm:w-auto"
          >
            Salta tutti
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isCreating}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
          >
            <Link2 className="h-4 w-4 mr-2" />
            {isCreating 
              ? 'Creazione...' 
              : selectedMatches.size > 0 
                ? `Conferma ${selectedMatches.size} selezionati` 
                : 'Conferma (seleziona almeno 1)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}