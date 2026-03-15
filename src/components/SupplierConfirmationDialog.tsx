import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { AlertCircle, Check, Edit2, Building2, ChevronDown } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Supplier } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SupplierConfirmationDialogProps {
  isOpen: boolean;
  detectedSupplierName: string;
  existingSuppliers: Supplier[];
  onConfirm: (supplierId: string, supplierName: string, isNewSupplier: boolean) => void;
  onCancel: () => void;
}

export function SupplierConfirmationDialog({
  isOpen,
  detectedSupplierName,
  existingSuppliers,
  onConfirm,
  onCancel,
}: SupplierConfirmationDialogProps) {
  const [mode, setMode] = useState<'confirm' | 'edit' | 'select'>('confirm');
  const [editedName, setEditedName] = useState(detectedSupplierName);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setMode('confirm');
      setEditedName(detectedSupplierName);
      setSelectedSupplierId('');
    }
  }, [isOpen, detectedSupplierName]);

  // Check if detected name matches an existing supplier
  const matchedSupplier = existingSuppliers.find(
    s => s.name.toLowerCase().trim() === detectedSupplierName.toLowerCase().trim()
  );

  const handleConfirm = () => {
    if (matchedSupplier) {
      // Exact match found - use existing supplier
      onConfirm(matchedSupplier.id, matchedSupplier.name, false);
    } else {
      // No match - create new supplier with detected name
      onConfirm('', detectedSupplierName, true);
    }
  };

  const handleEdit = () => {
    if (!editedName.trim()) {
      return;
    }
    
    // Check if edited name matches an existing supplier
    const matchedByEdit = existingSuppliers.find(
      s => s.name.toLowerCase().trim() === editedName.toLowerCase().trim()
    );
    
    if (matchedByEdit) {
      onConfirm(matchedByEdit.id, matchedByEdit.name, false);
    } else {
      onConfirm('', editedName, true);
    }
  };

  const handleSelectExisting = () => {
    if (!selectedSupplierId) {
      return;
    }
    
    const supplier = existingSuppliers.find(s => s.id === selectedSupplierId);
    if (supplier) {
      onConfirm(supplier.id, supplier.name, false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Building2 className="h-6 w-6 text-indigo-600" />
            Conferma Nome Fornitore
          </DialogTitle>
          <DialogDescription>
            L'OCR ha rilevato il seguente nome fornitore. Conferma o correggi se necessario.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Detected Supplier Card */}
          <Card className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <Label className="text-xs text-slate-600 mb-1">Nome Rilevato dall'OCR</Label>
                <p className="text-xl font-bold text-slate-800 mt-1">{detectedSupplierName}</p>
                
                {matchedSupplier && (
                  <Alert className="mt-3 bg-green-50 border-green-200">
                    <Check className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-sm text-green-700">
                      ✓ Trovata corrispondenza esatta con fornitore esistente
                    </AlertDescription>
                  </Alert>
                )}
                
                {!matchedSupplier && (
                  <Alert className="mt-3 bg-yellow-50 border-yellow-200">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-sm text-yellow-700">
                      ⚠️ Nessuna corrispondenza trovata. Verrà creato un nuovo fornitore.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </Card>

          {/* Action Buttons */}
          {mode === 'confirm' && (
            <div className="space-y-3">
              <Button
                onClick={handleConfirm}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 h-12 text-base"
              >
                <Check className="h-5 w-5 mr-2" />
                Conferma Nome Corretto
              </Button>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => setMode('edit')}
                  variant="outline"
                  className="h-12 border-2 border-indigo-200 hover:bg-indigo-50"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Modifica Nome
                </Button>

                <Button
                  onClick={() => setMode('select')}
                  variant="outline"
                  className="h-12 border-2 border-purple-200 hover:bg-purple-50"
                >
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Seleziona Esistente
                </Button>
              </div>

              <Button
                onClick={onCancel}
                variant="ghost"
                className="w-full"
              >
                Annulla
              </Button>
            </div>
          )}

          {/* Edit Mode */}
          {mode === 'edit' && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold mb-2">Modifica Nome Fornitore</Label>
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Inserisci il nome corretto del fornitore"
                  className="h-12 text-base mt-2"
                  autoFocus
                />
                <p className="text-xs text-slate-500 mt-2">
                  💡 Suggerimento: Inserisci il nome esatto come appare sulla fattura
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleEdit}
                  disabled={!editedName.trim()}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 h-12"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Conferma Modifica
                </Button>
                <Button
                  onClick={() => {
                    setMode('confirm');
                    setEditedName(detectedSupplierName);
                  }}
                  variant="outline"
                  className="h-12"
                >
                  Annulla
                </Button>
              </div>
            </div>
          )}

          {/* Select Existing Mode */}
          {mode === 'select' && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold mb-2">Seleziona Fornitore Esistente</Label>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger className="h-12 text-base mt-2">
                    <SelectValue placeholder="Scegli un fornitore dalla lista" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {existingSuppliers.length === 0 ? (
                      <div className="p-4 text-center text-slate-500 text-sm">
                        Nessun fornitore esistente
                      </div>
                    ) : (
                      existingSuppliers
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((supplier) => (
                          <SelectItem 
                            key={supplier.id} 
                            value={supplier.id}
                            className="cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-slate-400" />
                              <span className="font-medium">{supplier.name}</span>
                            </div>
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-2">
                  💡 Suggerimento: Seleziona se l'OCR ha sbagliato a riconoscere il nome
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleSelectExisting}
                  disabled={!selectedSupplierId}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 h-12"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Usa Fornitore Selezionato
                </Button>
                <Button
                  onClick={() => {
                    setMode('confirm');
                    setSelectedSupplierId('');
                  }}
                  variant="outline"
                  className="h-12"
                >
                  Annulla
                </Button>
              </div>
            </div>
          )}

          {/* Info Card */}
          <Card className="p-3 bg-blue-50 border-blue-200">
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-700">
                <p className="font-semibold mb-1">Perché confermare il nome?</p>
                <p>
                  Il sistema OCR può occasionalmente confondere il nome del fornitore con altri elementi 
                  della fattura (come numeri di fattura o date). Confermare il nome garantisce che la 
                  fattura sia associata al fornitore corretto.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}