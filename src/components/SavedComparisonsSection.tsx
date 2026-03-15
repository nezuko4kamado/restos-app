import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, RefreshCw, AlertCircle, TrendingDown, TrendingUp } from 'lucide-react';
import { getProductComparisons, deleteProductComparison, getProducts, getSuppliers, type ProductComparison } from '@/lib/storage';
import type { Product, Supplier } from '@/types';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/i18n';

interface ComparisonWithDetails extends ProductComparison {
  product1?: Product;
  product2?: Product;
  supplier1?: Supplier;
  supplier2?: Supplier;
  priceDifference?: number;
  percentageDifference?: number;
}

export function SavedComparisonsSection() {
  const { t } = useLanguage();
  const [comparisons, setComparisons] = useState<ComparisonWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadComparisons = async () => {
    try {
      setLoading(true);
      console.log('📊 [SAVED_COMPARISONS] Loading comparisons...');
      
      // Fetch comparisons, products, and suppliers
      const [comparisonsData, products, suppliers] = await Promise.all([
        getProductComparisons(),
        getProducts(),
        getSuppliers()
      ]);

      console.log('📊 [SAVED_COMPARISONS] Raw data fetched:', {
        comparisons: comparisonsData.length,
        products: products.length,
        suppliers: suppliers.length
      });

      // Enrich comparisons with product and supplier details
      const enrichedComparisons: ComparisonWithDetails[] = comparisonsData.map(comparison => {
        const product1 = products.find(p => p.id === comparison.product_id_1);
        const product2 = products.find(p => p.id === comparison.product_id_2);

        const supplier1 = product1 ? suppliers.find(s => s.id === product1.supplier_id) : undefined;
        const supplier2 = product2 ? suppliers.find(s => s.id === product2.supplier_id) : undefined;

        let priceDifference = 0;
        let percentageDifference = 0;

        if (product1 && product2) {
          priceDifference = product2.price - product1.price;
          percentageDifference = product1.price > 0 
            ? (priceDifference / product1.price) * 100 
            : 0;
        }

        return {
          ...comparison,
          product1,
          product2,
          supplier1,
          supplier2,
          priceDifference,
          percentageDifference
        };
      });

      console.log('✅ [SAVED_COMPARISONS] Enriched comparisons:', enrichedComparisons.length);
      setComparisons(enrichedComparisons);
    } catch (error) {
      console.error('❌ [SAVED_COMPARISONS] Error loading comparisons:', error);
      toast.error('Errore nel caricamento delle comparazioni');
    } finally {
      setLoading(false);
    }
  };

  // Load comparisons only once on mount
  useEffect(() => {
    loadComparisons();
  }, []);

  const handleDelete = async (comparisonId: string) => {
    try {
      setDeleting(comparisonId);
      console.log('🗑️ [DELETE] Deleting comparison:', comparisonId);
      
      const success = await deleteProductComparison(comparisonId);
      
      if (success) {
        console.log('✅ [DELETE] Comparison deleted successfully');
        toast.success('Comparazione eliminata con successo');
        
        // Remove from local state
        setComparisons(prev => prev.filter(c => c.id !== comparisonId));
      } else {
        toast.error('Errore nell\'eliminazione della comparazione');
      }
    } catch (error) {
      console.error('❌ [DELETE] Error deleting comparison:', error);
      toast.error('Errore nell\'eliminazione della comparazione');
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="text-slate-600">Caricamento comparazioni...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span>{t('savedComparisons')}</span>
            <Badge variant="secondary">{comparisons.length}</Badge>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={loadComparisons}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {comparisons.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 mb-2">{t('noSavedComparisons')}</p>
            <p className="text-sm text-slate-500">
              {t('goToProductsToCompare')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {comparisons.map((comparison) => {
              const { product1, product2, supplier1, supplier2, priceDifference, percentageDifference } = comparison;
              
              // Skip if products not found
              if (!product1 || !product2) {
                return (
                  <div
                    key={comparison.id}
                    className="p-4 border-2 border-red-200 rounded-lg bg-red-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertCircle className="h-5 w-5" />
                        <span className="text-sm font-medium">
                          Prodotti non trovati (potrebbero essere stati eliminati)
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(comparison.id)}
                        disabled={deleting === comparison.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-100"
                      >
                        <Trash2 className={`h-4 w-4 ${deleting === comparison.id ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                  </div>
                );
              }

              const isCheaper = priceDifference! < 0;
              const isMoreExpensive = priceDifference! > 0;

              return (
                <div
                  key={comparison.id}
                  className="p-5 border-2 border-slate-200 rounded-lg hover:border-indigo-300 transition-all hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-4">
                      {/* Products Comparison */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Product 1 */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">Prodotto 1</Badge>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-lg">{product1.name}</p>
                            <p className="text-sm text-slate-600">
                              {supplier1?.name || 'Fornitore sconosciuto'}
                            </p>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-slate-900">
                              {formatPrice(product1.price)}
                            </span>
                            <span className="text-sm text-slate-500">
                              / {product1.unit || 'unità'}
                            </span>
                          </div>
                        </div>

                        {/* Product 2 */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">Prodotto 2</Badge>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-lg">{product2.name}</p>
                            <p className="text-sm text-slate-600">
                              {supplier2?.name || 'Fornitore sconosciuto'}
                            </p>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-slate-900">
                              {formatPrice(product2.price)}
                            </span>
                            <span className="text-sm text-slate-500">
                              / {product2.unit || 'unità'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Price Difference */}
                      <div className="pt-3 border-t border-slate-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-slate-600">Differenza:</span>
                            <div className="flex items-center gap-2">
                              {isCheaper && (
                                <>
                                  <TrendingDown className="h-5 w-5 text-green-600" />
                                  <span className="text-lg font-bold text-green-600">
                                    {formatPrice(Math.abs(priceDifference!))}
                                  </span>
                                  <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100">
                                    -{Math.abs(Number(percentageDifference) || 0).toFixed(1)}%
                                  </Badge>
                                </>
                              )}
                              {isMoreExpensive && (
                                <>
                                  <TrendingUp className="h-5 w-5 text-red-600" />
                                  <span className="text-lg font-bold text-red-600">
                                    +{formatPrice(priceDifference!)}
                                  </span>
                                  <Badge variant="default" className="bg-red-100 text-red-700 hover:bg-red-100">
                                    +{(Number(percentageDifference) || 0).toFixed(1)}%
                                  </Badge>
                                </>
                              )}
                              {!isCheaper && !isMoreExpensive && (
                                <span className="text-lg font-bold text-slate-600">
                                  Stesso prezzo
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-slate-500">
                            {t('savedOn')} {formatDate(comparison.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Delete Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(comparison.id)}
                      disabled={deleting === comparison.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                      title="Elimina comparazione"
                    >
                      <Trash2 className={`h-4 w-4 ${deleting === comparison.id ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}