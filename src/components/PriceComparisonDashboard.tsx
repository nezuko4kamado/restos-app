import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingDown, 
  TrendingUp, 
  Search, 
  Filter, 
  Download,
  ArrowUpDown,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PriceComparisonService, type PriceComparisonResult, type SupplierRecommendation } from '@/lib/priceComparison';
import { formatPrice, getCurrencySymbol } from '@/lib/currency';
import { getSettings } from '@/lib/storage';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/i18n';
import { SavedComparisonsSection } from '@/components/SavedComparisonsSection';

interface PriceComparisonDashboardProps {
  products?: unknown[];
  suppliers?: unknown[];
}

interface SupplierComparisonData {
  supplier_name: string;
  product_count: number;
  average_price: number;
  total_value: number;
  is_whitelisted: boolean;
}

export function PriceComparisonDashboard({ 
  products = [], 
  suppliers = [] 
}: PriceComparisonDashboardProps) {
  const { t } = useLanguage();
  const [currency, setCurrency] = useState('EUR');
  const [comparisons, setComparisons] = useState<PriceComparisonResult[]>([]);
  const [recommendations, setRecommendations] = useState<SupplierRecommendation[]>([]);
  const [supplierComparison, setSupplierComparison] = useState<SupplierComparisonData[]>([]);
  const [potentialSavings, setPotentialSavings] = useState({ total_savings: 0, savings_by_switching: 0, number_of_products: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [minDifference, setMinDifference] = useState('5');
  const [sortBy, setSortBy] = useState<'savings' | 'difference' | 'name'>('savings');

  // Load currency from settings
  useEffect(() => {
    const loadCurrency = async () => {
      try {
        const settings = await getSettings();
        setCurrency(settings.defaultCurrency || 'EUR');
      } catch (error) {
        console.error('Error loading currency:', error);
      }
    };
    loadCurrency();
  }, []);

  useEffect(() => {
    loadData();
  }, [minDifference]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [
        priceComparisons,
        supplierRecommendations,
        supplierStats,
        savings
      ] = await Promise.all([
        PriceComparisonService.getProductsWithPriceDifferences(parseInt(minDifference), 50),
        PriceComparisonService.getRecommendedSwitches(10, 20),
        PriceComparisonService.getSupplierComparison(),
        PriceComparisonService.calculatePotentialSavings()
      ]);

      setComparisons(priceComparisons);
      setRecommendations(supplierRecommendations);
      setSupplierComparison(supplierStats as SupplierComparisonData[]);
      setPotentialSavings(savings);
    } catch (error) {
      console.error('Error loading price comparison data:', error);
      toast.error(t('priceComparison.errorLoadingData'));
    } finally {
      setLoading(false);
    }
  };

  const filteredComparisons = comparisons.filter(comp => {
    const matchesSearch = comp.product_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSupplier = selectedSupplier === 'all' || 
      comp.suppliers.some(s => s.supplier_name === selectedSupplier);
    return matchesSearch && matchesSupplier;
  });

  const sortedComparisons = [...filteredComparisons].sort((a, b) => {
    switch (sortBy) {
      case 'savings':
        return b.potential_savings - a.potential_savings;
      case 'difference':
        return b.price_difference - a.price_difference;
      case 'name':
        return a.product_name.localeCompare(b.product_name);
      default:
        return 0;
    }
  });

  const formatCurrency = (amount: number) => {
    return formatPrice(amount, currency);
  };

  const getBestSupplier = (comparison: PriceComparisonResult) => {
    return comparison.suppliers.find(s => s.price === comparison.best_price);
  };

  const getWorstSupplier = (comparison: PriceComparisonResult) => {
    return comparison.suppliers.find(s => s.price === comparison.worst_price);
  };

  const calculateSavingsPercent = (comparison: PriceComparisonResult) => {
    return ((Number(comparison.price_difference) || 0) / (Number(comparison.worst_price) || 1) * 100).toFixed(1);
  };

  // Prepare chart data for supplier comparison
  const supplierChartData = supplierComparison.map(s => ({
    name: s.supplier_name.length > 15 ? s.supplier_name.substring(0, 15) + '...' : s.supplier_name,
    [t('priceComparison.totalValue')]: s.total_value,
    [t('priceComparison.averagePrice')]: s.average_price,
    [t('priceComparison.numProducts')]: s.product_count
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-slate-600">{t('priceComparison.loadingComparison')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">{t('priceComparison.potentialSavings')}</p>
                <p className="text-3xl font-bold text-green-600">
                  {formatCurrency(potentialSavings.total_savings)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {t('priceComparison.onProducts', { count: potentialSavings.number_of_products })}
                </p>
              </div>
              <span className="text-5xl font-bold text-green-600 opacity-50">{getCurrencySymbol(currency)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">{t('priceComparison.comparedProducts')}</p>
                <p className="text-3xl font-bold text-blue-600">{comparisons.length}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {t('priceComparison.withDifferences', { percent: minDifference })}
                </p>
              </div>
              <TrendingDown className="h-12 w-12 text-blue-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">{t('priceComparison.analyzedSuppliers')}</p>
                <p className="text-3xl font-bold text-purple-600">{supplierComparison.length}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {t('priceComparison.inWhitelist', { count: supplierComparison.filter(s => s.is_whitelisted).length })}
                </p>
              </div>
              <CheckCircle2 className="h-12 w-12 text-purple-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="saved" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="saved">{t('savedComparisons')}</TabsTrigger>
          <TabsTrigger value="comparison">{t('priceComparison.priceComparison')}</TabsTrigger>
          <TabsTrigger value="recommendations">{t('priceComparison.recommendations')}</TabsTrigger>
          <TabsTrigger value="suppliers">{t('priceComparison.suppliersAnalysis')}</TabsTrigger>
        </TabsList>

        {/* Saved Comparisons Tab - NEW */}
        <TabsContent value="saved" className="space-y-4">
          <SavedComparisonsSection />
        </TabsContent>

        {/* Price Comparison Tab */}
        <TabsContent value="comparison" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <Label className="text-sm mb-2 block">{t('priceComparison.searchProduct')}</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder={t('priceComparison.productNamePlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-sm mb-2 block">{t('priceComparison.supplier')}</Label>
                  <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('priceComparison.allSuppliers')}</SelectItem>
                      {supplierComparison.map(s => (
                        <SelectItem key={s.supplier_name} value={s.supplier_name}>
                          {s.supplier_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm mb-2 block">{t('priceComparison.minDifference')}</Label>
                  <Select value={minDifference} onValueChange={setMinDifference}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">≥ 5%</SelectItem>
                      <SelectItem value="10">≥ 10%</SelectItem>
                      <SelectItem value="15">≥ 15%</SelectItem>
                      <SelectItem value="20">≥ 20%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortBy('savings')}
                  className={sortBy === 'savings' ? 'bg-indigo-50 border-indigo-300' : ''}
                >
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  {t('priceComparison.sortBySavings')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortBy('difference')}
                  className={sortBy === 'difference' ? 'bg-indigo-50 border-indigo-300' : ''}
                >
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  {t('priceComparison.sortByDifference')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortBy('name')}
                  className={sortBy === 'name' ? 'bg-indigo-50 border-indigo-300' : ''}
                >
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  {t('priceComparison.sortByName')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Comparison Table */}
          <div className="space-y-3">
            {sortedComparisons.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600">
                    {t('priceComparison.noProductsFound', { percent: minDifference })}
                  </p>
                </CardContent>
              </Card>
            ) : (
              sortedComparisons.map((comparison) => {
                const bestSupplier = getBestSupplier(comparison);
                const worstSupplier = getWorstSupplier(comparison);
                const savingsPercent = calculateSavingsPercent(comparison);

                return (
                  <Card key={comparison.product_id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-slate-800 mb-3">
                            {comparison.product_name}
                          </h3>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Best Price */}
                            <div className="p-3 bg-green-50 border-2 border-green-200 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-slate-600">{t('priceComparison.bestPrice')}</span>
                                <Badge className="bg-green-600 hover:bg-green-700">
                                  <TrendingDown className="h-3 w-3 mr-1" />
                                  {t('priceComparison.cheapest')}
                                </Badge>
                              </div>
                              <p className="text-2xl font-bold text-green-600">
                                {formatCurrency(comparison.best_price)}
                              </p>
                              <p className="text-sm text-slate-600 mt-1">
                                {bestSupplier?.supplier_name}
                              </p>
                            </div>

                            {/* Worst Price */}
                            <div className="p-3 bg-red-50 border-2 border-red-200 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-slate-600">{t('priceComparison.maxPrice')}</span>
                                <Badge variant="destructive">
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                  {t('priceComparison.mostExpensive')}
                                </Badge>
                              </div>
                              <p className="text-2xl font-bold text-red-600">
                                {formatCurrency(comparison.worst_price)}
                              </p>
                              <p className="text-sm text-slate-600 mt-1">
                                {worstSupplier?.supplier_name}
                              </p>
                            </div>
                          </div>

                          {/* All Suppliers */}
                          <div className="mt-4">
                            <p className="text-sm font-medium text-slate-600 mb-2">
                              {t('priceComparison.allSuppliersCount', { count: comparison.suppliers.length })}:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {comparison.suppliers
                                .sort((a, b) => a.price - b.price)
                                .map((supplier, idx) => (
                                  <div
                                    key={idx}
                                    className={`px-3 py-2 rounded-lg border-2 ${
                                      supplier.price === comparison.best_price
                                        ? 'bg-green-50 border-green-300'
                                        : supplier.price === comparison.worst_price
                                        ? 'bg-red-50 border-red-300'
                                        : 'bg-slate-50 border-slate-200'
                                    }`}
                                  >
                                    <p className="text-xs text-slate-600">{supplier.supplier_name}</p>
                                    <p className="text-sm font-bold">
                                      {formatCurrency(supplier.price)}
                                    </p>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>

                        {/* Savings Info */}
                        <div className="md:w-48 flex flex-col justify-center items-center p-4 bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-lg">
                          <p className="text-sm text-slate-600 mb-2">{t('priceComparison.potentialSavingsAmount')}</p>
                          <p className="text-3xl font-bold text-indigo-600 mb-1">
                            {formatCurrency(comparison.potential_savings)}
                          </p>
                          <Badge className="bg-indigo-600 hover:bg-indigo-700">
                            {savingsPercent}%
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-green-600" />
                {t('priceComparison.supplierSwitchSuggestions')}
              </CardTitle>
              <p className="text-sm text-slate-600">
                {t('priceComparison.saveBySwitching')}
              </p>
            </CardHeader>
            <CardContent>
              {recommendations.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <p className="text-slate-600">
                    {t('priceComparison.alreadyBestSuppliers')}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="p-4 border-2 border-slate-200 rounded-lg hover:border-indigo-300 transition-colors"
                    >
                      <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-800 mb-2">{rec.product_name}</h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="p-3 bg-red-50 border border-red-200 rounded">
                              <p className="text-xs text-slate-600 mb-1">{t('priceComparison.currentSupplier')}</p>
                              <p className="font-semibold text-slate-800">{rec.current_supplier}</p>
                              <p className="text-lg font-bold text-red-600">
                                {formatCurrency(rec.current_price)}
                              </p>
                            </div>

                            <div className="p-3 bg-green-50 border border-green-200 rounded">
                              <p className="text-xs text-slate-600 mb-1">{t('priceComparison.recommendedSupplier')}</p>
                              <p className="font-semibold text-slate-800">{rec.recommended_supplier}</p>
                              <p className="text-lg font-bold text-green-600">
                                {formatCurrency(rec.recommended_price)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="md:w-40 flex flex-col justify-center items-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg">
                          <p className="text-xs text-slate-600 mb-1">{t('priceComparison.savings')}</p>
                          <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(rec.savings)}
                          </p>
                          <Badge className="bg-green-600 hover:bg-green-700 mt-2">
                            -{(Number(rec.savings_percent) || 0).toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Total Annual Savings */}
                  <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-600 mb-1">{t('priceComparison.totalAnnualSavings')}</p>
                          <p className="text-3xl font-bold text-green-600">
                            {formatCurrency(recommendations.reduce((sum, rec) => sum + rec.savings, 0))}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {t('priceComparison.bySwitchingProducts', { count: recommendations.length })}
                          </p>
                        </div>
                        <span className="text-6xl font-bold text-green-600 opacity-50">{getCurrencySymbol(currency)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Suppliers Analysis Tab */}
        <TabsContent value="suppliers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('priceComparison.suppliersAnalysisTitle')}</CardTitle>
              <p className="text-sm text-slate-600">
                {t('priceComparison.statisticalComparison')}
              </p>
            </CardHeader>
            <CardContent>
              {/* Chart */}
              <div className="mb-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={supplierChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0' }}
                    />
                    <Legend />
                    <Bar dataKey={t('priceComparison.totalValue')} fill="#6366f1" />
                    <Bar dataKey={t('priceComparison.averagePrice')} fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Supplier Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {supplierComparison.map((supplier, idx) => (
                  <Card key={idx} className="border-2">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-bold text-slate-800">{supplier.supplier_name}</h4>
                        {supplier.is_whitelisted && (
                          <Badge className="bg-purple-600 hover:bg-purple-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {t('priceComparison.whitelist')}
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">{t('priceComparison.productsCount')}</span>
                          <span className="font-semibold">{supplier.product_count}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">{t('priceComparison.averagePriceLabel')}</span>
                          <span className="font-semibold">{formatCurrency(supplier.average_price)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">{t('priceComparison.totalValueLabel')}</span>
                          <span className="font-semibold text-indigo-600">
                            {formatCurrency(supplier.total_value)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}