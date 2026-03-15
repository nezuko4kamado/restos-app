import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Link2, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { Product, ProductCompatibility as ProductCompatibilityType } from '@/types';
import { getProductCompatibility, saveProductCompatibility, deleteProductCompatibility } from '@/lib/storageExtensions';

interface ProductCompatibilityProps {
  product: Product;
  allProducts: Product[];
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function ProductCompatibility({
  product,
  allProducts,
  isOpen,
  onClose,
  onUpdate
}: ProductCompatibilityProps) {
  const [compatibilities, setCompatibilities] = useState<ProductCompatibilityType[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCompatibilities();
    }
  }, [isOpen, product.id]);

  const loadCompatibilities = async () => {
    try {
      setLoading(true);
      const data = await getProductCompatibility(product.id);
      setCompatibilities(data);
      
      // Set selected products
      const selected = new Set<string>();
      data.forEach(comp => {
        if (comp.product_id_1 === product.id) {
          selected.add(comp.product_id_2);
        } else {
          selected.add(comp.product_id_1);
        }
      });
      setSelectedProducts(selected);
    } catch (error) {
      console.error('Error loading compatibilities:', error);
      toast.error('Errore caricamento compatibilità');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleProduct = async (productId: string) => {
    try {
      const newSelected = new Set(selectedProducts);
      
      if (newSelected.has(productId)) {
        // Remove compatibility
        newSelected.delete(productId);
        
        // Find and delete the compatibility record
        const comp = compatibilities.find(c => 
          (c.product_id_1 === product.id && c.product_id_2 === productId) ||
          (c.product_id_2 === product.id && c.product_id_1 === productId)
        );
        
        if (comp) {
          await deleteProductCompatibility(comp.id);
          toast.success('Compatibilità rimossa');
        }
      } else {
        // Add compatibility
        newSelected.add(productId);
        await saveProductCompatibility(product.id, productId);
        toast.success('Compatibilità aggiunta');
      }
      
      setSelectedProducts(newSelected);
      await loadCompatibilities();
      onUpdate();
    } catch (error) {
      console.error('Error toggling compatibility:', error);
      toast.error('Errore modifica compatibilità');
    }
  };

  const filteredProducts = allProducts.filter(p => {
    if (p.id === product.id) return false;
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      p.code?.toLowerCase().includes(query) ||
      p.category?.toLowerCase().includes(query)
    );
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-blue-600" />
            Gestisci Compatibilità
          </DialogTitle>
          <DialogDescription>
            Seleziona i prodotti compatibili o simili a <strong>{product.name}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Cerca prodotti..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Selected Count */}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-gray-600">
            {selectedProducts.size} prodotti compatibili selezionati
          </span>
          {selectedProducts.size > 0 && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
              <Check className="h-3 w-3 mr-1" />
              {selectedProducts.size}
            </Badge>
          )}
        </div>

        {/* Products List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              Caricamento...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nessun prodotto trovato
            </div>
          ) : (
            filteredProducts.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md ${
                  selectedProducts.has(p.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleToggleProduct(p.id)}
              >
                <Checkbox
                  checked={selectedProducts.has(p.id)}
                  onCheckedChange={() => handleToggleProduct(p.id)}
                  className="pointer-events-none"
                />
                
                {p.image && (
                  <img
                    src={p.image}
                    alt={p.name}
                    className="w-12 h-12 object-cover rounded"
                  />
                )}
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {p.code && (
                      <Badge variant="outline" className="text-xs">
                        {p.code}
                      </Badge>
                    )}
                    {p.category && (
                      <Badge variant="secondary" className="text-xs">
                        {p.category}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="font-bold text-sm">€{(Number(p.price) || 0).toFixed(2)}</p>
                  {p.unit && (
                    <p className="text-xs text-gray-500">/{p.unit}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Chiudi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}