import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Package, Trash2, ArrowRight } from 'lucide-react';
import type { Supplier, Product } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';

interface DeleteSupplierDialogProps {
  supplier: Supplier;
  products: Product[];
  suppliers: Supplier[];
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (supplierId: string, newSupplierId: string | null, deleteProducts: boolean) => void;
}

export default function DeleteSupplierDialog({
  supplier,
  products,
  suppliers,
  isOpen,
  onClose,
  onConfirm
}: DeleteSupplierDialogProps) {
  const { t } = useLanguage();
  const [action, setAction] = useState<'reassign' | 'delete'>('reassign');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

  const handleConfirm = () => {
    if (action === 'reassign' && !selectedSupplierId) {
      return;
    }

    const deleteProducts = action === 'delete';
    const newSupplierId = action === 'reassign' ? selectedSupplierId : null;

    // Additional confirmation for deleting products
    if (deleteProducts) {
      const confirmed = confirm(
        `⚠️ ${t.warning}: ${products.length} ${t.products?.toLowerCase()} ${t.together} "${supplier.name}".`
      );
      if (!confirmed) {
        return;
      }
    }

    onConfirm(supplier.id, newSupplierId, deleteProducts);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            {t.deleteSupplier}
          </DialogTitle>
          <DialogDescription className="text-base">
            {t.supplier} <strong>{supplier.name}</strong> - <strong>{products.length}</strong> {t.products?.toLowerCase()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Products List */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Package className="h-4 w-4 text-blue-600" />
              {t.products} ({products.length})
            </div>
            
            <div className="max-h-48 overflow-y-auto space-y-2 border-2 border-slate-200 rounded-xl p-3 bg-slate-50">
              {products.map((product) => (
                <div key={product.id} className="flex justify-between items-center p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-sm font-medium text-slate-800">{product.name}</span>
                  <span className="text-sm font-bold text-blue-600">€{product.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Selection */}
          <div className="space-y-4">
            <Label className="text-base font-semibold text-slate-800">
              {t.actions}?
            </Label>

            <RadioGroup value={action} onValueChange={(value) => setAction(value as 'reassign' | 'delete')}>
              {/* Reassign Option */}
              <div className="space-y-3">
                <div className="flex items-center space-x-3 p-4 border-2 border-indigo-200 rounded-xl bg-indigo-50 hover:bg-indigo-100 transition-colors cursor-pointer">
                  <RadioGroupItem value="reassign" id="reassign" />
                  <Label htmlFor="reassign" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-indigo-600" />
                      <span className="font-semibold text-slate-800">{t.selectExistingSupplier}</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">
                      {t.products}
                    </p>
                  </Label>
                </div>

                {action === 'reassign' && (
                  <div className="ml-7 space-y-2">
                    <Label className="text-sm font-medium text-slate-700">
                      {t.selectSupplier}
                    </Label>
                    <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                      <SelectTrigger className="border-2 focus:border-indigo-500 rounded-xl">
                        <SelectValue placeholder={t.selectSupplierPlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.length === 0 ? (
                          <div className="p-4 text-center text-sm text-slate-500">
                            {t.noSuppliers}
                          </div>
                        ) : (
                          suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Delete Option */}
              <div className="flex items-center space-x-3 p-4 border-2 border-red-200 rounded-xl bg-red-50 hover:bg-red-100 transition-colors cursor-pointer">
                <RadioGroupItem value="delete" id="delete" />
                <Label htmlFor="delete" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4 text-red-600" />
                    <span className="font-semibold text-slate-800">{t.deleteProduct}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    ⚠️ {t.cannotBeUndone}
                  </p>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Warning Alert */}
          {action === 'delete' && (
            <Alert className="border-2 border-red-300 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-sm text-red-800">
                <strong>{t.warning}:</strong> {products.length} {t.products?.toLowerCase()}. {t.cannotBeUndone}
              </AlertDescription>
            </Alert>
          )}

          {action === 'reassign' && suppliers.length === 0 && (
            <Alert className="border-2 border-orange-300 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-sm text-orange-800">
                <strong>{t.warning}:</strong> {t.noSuppliers}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="border-2 hover:border-slate-400"
          >
            {t.cancel}
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={action === 'reassign' && !selectedSupplierId}
            className={`${
              action === 'delete' 
                ? 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700' 
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
            } shadow-lg hover:scale-105 transition-all`}
          >
            {action === 'delete' ? (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                {t.deleteSupplier}
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4 mr-2" />
                {t.saveChanges}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}