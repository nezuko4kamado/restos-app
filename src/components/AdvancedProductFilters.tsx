import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Filter, X, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Supplier, SearchFilter } from '@/types';
import { getSearchFilters, saveSearchFilter, deleteSearchFilter } from '@/lib/storageExtensions';

interface AdvancedProductFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedSupplier: string;
  setSelectedSupplier: (id: string) => void;
  selectedVAT: string;
  setSelectedVAT: (vat: string) => void;
  suppliers: Supplier[];
  onReset: () => void;
  resultsCount: number;
}

export function AdvancedProductFilters({
  searchQuery,
  setSearchQuery,
  selectedSupplier,
  setSelectedSupplier,
  selectedVAT,
  setSelectedVAT,
  suppliers,
  onReset,
  resultsCount
}: AdvancedProductFiltersProps) {
  const [savedFilters, setSavedFilters] = useState<SearchFilter[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [filterName, setFilterName] = useState('');

  useEffect(() => {
    loadSavedFilters();
  }, []);

  const loadSavedFilters = async () => {
    try {
      const filters = await getSearchFilters();
      setSavedFilters(filters);
    } catch (error) {
      console.error('Error loading saved filters:', error);
    }
  };

  const handleSaveFilter = async () => {
    if (!filterName.trim()) {
      toast.error('Inserisci un nome per il filtro');
      return;
    }

    try {
      await saveSearchFilter(filterName, {
        searchQuery,
        supplierId: selectedSupplier,
        vatRate: selectedVAT ? parseFloat(selectedVAT) : undefined
      });
      
      toast.success(`Filtro "${filterName}" salvato`);
      setFilterName('');
      setShowSaveDialog(false);
      loadSavedFilters();
    } catch (error) {
      console.error('Error saving filter:', error);
      toast.error('Errore salvataggio filtro');
    }
  };

  const handleLoadFilter = (filter: SearchFilter) => {
    setSearchQuery(filter.filter_data.searchQuery || '');
    setSelectedSupplier(filter.filter_data.supplierId || '');
    setSelectedVAT(filter.filter_data.vatRate?.toString() || '');
    toast.success(`Filtro "${filter.filter_name}" caricato`);
  };

  const handleDeleteFilter = async (filterId: string, filterName: string) => {
    if (confirm(`Eliminare il filtro "${filterName}"?`)) {
      try {
        await deleteSearchFilter(filterId);
        toast.success('Filtro eliminato');
        loadSavedFilters();
      } catch (error) {
        console.error('Error deleting filter:', error);
        toast.error('Errore eliminazione filtro');
      }
    }
  };

  const hasActiveFilters = searchQuery || selectedSupplier || selectedVAT;

  return (
    <Card className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Filter className="h-5 w-5 text-blue-600" />
          Filtri Avanzati
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-2">
              {resultsCount} risultati
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Query */}
        <div>
          <Label className="text-sm font-medium">Nome Prodotto</Label>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca per nome..."
            className="mt-1.5"
          />
        </div>

        {/* Supplier Filter */}
        <div>
          <Label className="text-sm font-medium">Fornitore</Label>
          <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Tutti i fornitori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i fornitori</SelectItem>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={!hasActiveFilters}
            className="flex-1"
          >
            <X className="h-4 w-4 mr-1" />
            Azzera
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowSaveDialog(!showSaveDialog)}
            disabled={!hasActiveFilters}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            <Save className="h-4 w-4 mr-1" />
            Salva
          </Button>
        </div>

        {/* Save Filter Dialog */}
        {showSaveDialog && (
          <div className="p-3 border-2 border-blue-300 rounded-lg bg-white dark:bg-slate-800 space-y-2">
            <Label className="text-sm">Nome Filtro</Label>
            <Input
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Es: Prodotti Metro"
              onKeyPress={(e) => e.key === 'Enter' && handleSaveFilter()}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveFilter} className="flex-1">
                Salva
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowSaveDialog(false);
                  setFilterName('');
                }}
                className="flex-1"
              >
                Annulla
              </Button>
            </div>
          </div>
        )}

        {/* Saved Filters */}
        {savedFilters.length > 0 && (
          <div className="pt-2 border-t">
            <Label className="text-sm font-medium mb-2 block">Filtri Salvati</Label>
            <div className="space-y-2">
              {savedFilters.map((filter) => (
                <div
                  key={filter.id}
                  className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded border hover:border-blue-400 transition-colors"
                >
                  <button
                    onClick={() => handleLoadFilter(filter)}
                    className="flex-1 text-left text-sm font-medium hover:text-blue-600 transition-colors"
                  >
                    {filter.filter_name}
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteFilter(filter.id, filter.filter_name)}
                    className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}