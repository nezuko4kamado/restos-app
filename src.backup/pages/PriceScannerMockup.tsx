import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Scan, TrendingDown, Check, X, ArrowLeft, Link2, ShoppingCart, AlertCircle, Award, Loader2, Database, Globe, DollarSign, MapPin, Calendar, Zap, Settings as SettingsIcon } from 'lucide-react';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';
import { getProductComparison, type ProductComparison, type CashAndCarryProduct } from '@/data/products';
import { fetchProductByEAN, type OpenFoodFactsProduct } from '@/services/openFoodFactsApi';
import { getCachedProduct, cacheProduct } from '@/services/supabaseCache';
import { getSettings } from '@/lib/storage';
import type { Settings } from '@/types';
import { 
  fetchPricesFromCountry, 
  getBestPrice, 
  formatTimestamp, 
  calculateSavings,
  detectUserCountry,
  getCountryName,
  getCountryFlag,
  type PriceAPIPrice 
} from '@/services/priceApi';

interface PriceScannerMockupProps {
  settings?: Settings;
}

type PermissionStatus = 'checking' | 'granted' | 'denied' | 'permanently_denied' | 'unknown';

export default function PriceScannerMockup({ settings: propSettings }: PriceScannerMockupProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [step, setStep] = useState<'scan' | 'identified' | 'comparison' | 'match'>('scan');
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [comparison, setComparison] = useState<ProductComparison | null>(null);
  const [openFoodProduct, setOpenFoodProduct] = useState<OpenFoodFactsProduct | null>(null);
  const [livePrices, setLivePrices] = useState<PriceAPIPrice[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [productSource, setProductSource] = useState<'local' | 'cache' | 'price_api' | 'api' | null>(null);
  const [error, setError] = useState<string>('');
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('checking');

  // Detect OS for platform-specific instructions
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);
  }, []);

  // CRITICAL FIX: Load country from props or settings on mount AND when props change
  useEffect(() => {
    loadCountryFromSettings();
  }, [propSettings]); // Re-run when propSettings changes

  useEffect(() => {
    checkPermission();

    return () => {
      if (isScanning) {
        stopScanning();
      }
    };
  }, []);

  // CRITICAL FIX: Add visibility change listener to reload settings when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        console.log('📱 Price Scanner: Page became visible, reloading country...');
        await loadCountryFromSettings();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const loadCountryFromSettings = async () => {
    try {
      // CRITICAL FIX: Prioritize propSettings, then load from Supabase
      let countryCode: string;
      
      if (propSettings?.country) {
        countryCode = propSettings.country;
        console.log('📱 Price Scanner: Using country from props:', countryCode);
      } else {
        const settings = await getSettings();
        countryCode = settings.country || detectUserCountry();
        console.log('📱 Price Scanner: Loaded country from Supabase:', countryCode);
      }
      
      setSelectedCountry(countryCode);
      console.log('📍 Price Scanner: Final selected country:', countryCode);
      console.log('🌍 Price Scanner: Country name:', getCountryName(countryCode));
    } catch (error) {
      console.error('❌ Price Scanner: Error loading country from settings:', error);
      const fallback = detectUserCountry();
      setSelectedCountry(fallback);
      console.log('⚠️ Price Scanner: Using fallback country:', fallback);
    }
  };

  const checkPermission = async () => {
    setPermissionStatus('checking');
    try {
      const status = await BarcodeScanner.checkPermission({ force: false });
      console.log('📷 Camera permission status:', status);
      
      if (status.granted) {
        setPermissionStatus('granted');
        setError('');
      } else if (status.denied) {
        // Check if permanently denied by trying to request again
        const requestStatus = await BarcodeScanner.checkPermission({ force: false });
        if (requestStatus.denied && !requestStatus.asked) {
          // Permission was denied before and user was never asked = permanently denied
          setPermissionStatus('permanently_denied');
          setError(t.permissionPermanentlyDenied);
        } else {
          setPermissionStatus('denied');
          setError(t.cameraPermissionDenied);
        }
      } else if (status.neverAsked) {
        setPermissionStatus('denied');
        setError('');
      } else {
        setPermissionStatus('unknown');
        setError(t.errorCheckingPermission);
      }
    } catch (err) {
      console.error('Error checking camera permission:', err);
      setPermissionStatus('unknown');
      setError(t.errorCheckingPermission);
    }
  };

  const requestPermission = async () => {
    try {
      setPermissionStatus('checking');
      const status = await BarcodeScanner.checkPermission({ force: true });
      console.log('📷 Camera permission request result:', status);
      
      if (status.granted) {
        setPermissionStatus('granted');
        setError('');
      } else if (status.denied) {
        // If denied after asking, it might be permanently denied
        setPermissionStatus('permanently_denied');
        setError(t.permissionPermanentlyDenied);
      } else {
        setPermissionStatus('denied');
        setError(t.cameraPermissionDeniedSettings);
      }
    } catch (err) {
      console.error('Error requesting camera permission:', err);
      setPermissionStatus('unknown');
      setError(t.errorRequestingPermission);
    }
  };

  const openAppSettings = () => {
    // Try to open app settings (works on some platforms)
    if (isIOS) {
      window.open('app-settings:', '_system');
    } else {
      // Android - try to open app settings
      window.open('intent://settings#Intent;scheme=android-app;package=com.yourapp.name;end', '_system');
    }
  };

  const searchProduct = async (ean: string) => {
    setIsLoading(true);
    setError('');
    setComparison(null);
    setOpenFoodProduct(null);
    setLivePrices([]);
    setProductSource(null);

    try {
      console.log('🔍 Searching for product with EAN:', ean);
      console.log('🌍 Selected country:', selectedCountry, getCountryName(selectedCountry));

      // 1. Check local database first
      const localComparison = getProductComparison(ean, 'Tutti');
      if (localComparison) {
        console.log('✅ Product found in local database');
        setComparison(localComparison);
        setProductSource('local');
        setStep('comparison');
        setIsLoading(false);
        return;
      }

      // 2. Check Supabase cache
      const cachedProduct = await getCachedProduct(ean);
      if (cachedProduct) {
        console.log('✅ Product found in Supabase cache');
        setOpenFoodProduct(cachedProduct);
        setProductSource('cache');
        setStep('identified');
        setIsLoading(false);
        return;
      }

      // 3. Try Price API first (for live prices)
      const prices = await fetchPricesFromCountry(ean, selectedCountry);
      if (prices && prices.length > 0) {
        console.log(`✅ Found ${prices.length} prices from Price API for ${getCountryName(selectedCountry)}`);
        setLivePrices(prices);
        setProductSource('price_api');
        setStep('match');
        setIsLoading(false);
        return;
      }

      // 4. Fallback to Open Food Facts API
      const apiProduct = await fetchProductByEAN(ean);
      if (apiProduct) {
        console.log('✅ Product found in Open Food Facts API');
        setOpenFoodProduct(apiProduct);
        setProductSource('api');
        
        // Cache the product in Supabase for future use
        await cacheProduct(apiProduct);
        console.log('💾 Product cached in Supabase');
        
        setStep('identified');
      } else {
        console.log('❌ Product not found in any source');
        setError(`${t.productFound}. ${t.code}: ${ean}`);
      }
    } catch (err) {
      console.error('Error searching product:', err);
      setError(t.errorSearchingProduct);
    } finally {
      setIsLoading(false);
    }
  };

  const startScanning = async () => {
    if (permissionStatus !== 'granted') {
      await requestPermission();
      return;
    }

    try {
      setIsScanning(true);
      document.body.classList.add('scanner-active');
      
      const result = await BarcodeScanner.startScan();
      
      if (result.hasContent) {
        console.log('Scanned barcode:', result.content);
        await searchProduct(result.content);
      }
    } catch (err) {
      console.error('Error starting scanner:', err);
      setError(t.errorStartingScanner);
    } finally {
      setIsScanning(false);
      document.body.classList.remove('scanner-active');
      await BarcodeScanner.stopScan();
    }
  };

  const stopScanning = async () => {
    try {
      await BarcodeScanner.stopScan();
      setIsScanning(false);
      document.body.classList.remove('scanner-active');
    } catch (err) {
      console.error('Error stopping scanner:', err);
    }
  };

  const resetScanner = () => {
    setStep('scan');
    setComparison(null);
    setOpenFoodProduct(null);
    setLivePrices([]);
    setError('');
    setProductSource(null);
  };

  const getSupplierColor = (supplier: string) => {
    const colors: { [key: string]: string } = {
      'Metro': 'bg-blue-600',
      'Makro': 'bg-orange-600',
      'Transgourmet': 'bg-green-600',
    };
    return colors[supplier] || 'bg-gray-600';
  };

  const renderSourceBadge = () => {
    if (!productSource) return null;

    const sourceConfig = {
      local: { icon: Database, label: t.localDatabase, color: 'bg-purple-100 text-purple-700 border-purple-300' },
      cache: { icon: Zap, label: t.supabaseCache, color: 'bg-blue-100 text-blue-700 border-blue-300' },
      price_api: { icon: Globe, label: t.priceAPILive, color: 'bg-green-100 text-green-700 border-green-300' },
      api: { icon: Globe, label: t.openFoodFactsAPI, color: 'bg-orange-100 text-orange-700 border-orange-300' },
    };

    const config = sourceConfig[productSource];
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} border flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const renderMultiSupplierComparison = (products: CashAndCarryProduct[], bestPrice: CashAndCarryProduct) => {
    return (
      <div className="space-y-3">
        {products.map((product, index) => {
          const isBest = product.supplier === bestPrice.supplier;
          const savings = product.price - bestPrice.price;
          
          return (
            <Card 
              key={index} 
              className={`p-4 transition-all ${
                isBest 
                  ? 'border-2 border-green-500 bg-green-50 shadow-lg' 
                  : 'border border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={`${getSupplierColor(product.supplier)} text-white`}>
                      {product.supplier}
                    </Badge>
                    {isBest && (
                      <Badge className="bg-green-600 text-white flex items-center gap-1">
                        <Award className="h-3 w-3" />
                        Miglior Prezzo
                      </Badge>
                    )}
                  </div>
                  
                  <p className="font-medium text-gray-900 mb-1">{product.name}</p>
                  
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900">
                      €{product.price.toFixed(2)}
                    </span>
                    <span className="text-sm text-gray-600">
                      / {product.unit}
                    </span>
                  </div>

                  {!isBest && savings > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-sm text-red-600">
                      <TrendingDown className="h-4 w-4" />
                      <span>+€{savings.toFixed(2)} rispetto al migliore</span>
                    </div>
                  )}
                </div>

                {isBest && (
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                      <Check className="h-6 w-6 text-white" />
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderLivePricesProduct = () => {
    if (!livePrices || livePrices.length === 0) return null;

    const bestPrice = getBestPrice(livePrices);
    if (!bestPrice) return null;

    return (
      <>
        <Card className="p-6 border-green-200 bg-green-50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
              <Check className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-green-700 font-medium">
                {t.livePricesFound}
              </p>
              <p className="text-xs text-green-600">
                {livePrices.length} {livePrices.length === 1 ? 'prezzo trovato' : 'prezzi trovati'} in {getCountryName(selectedCountry)}
              </p>
            </div>
            {renderSourceBadge()}
          </div>
        </Card>

        <Card className="p-6 border-2 border-blue-300">
          <div className="flex gap-4 mb-4">
            {bestPrice.product_image_url ? (
              <div className="w-32 h-32 bg-white rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border">
                <img 
                  src={bestPrice.product_image_url} 
                  alt={bestPrice.product_name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="flex items-center justify-center w-full h-full"><svg class="h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg></div>';
                  }}
                />
              </div>
            ) : (
              <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="h-16 w-16 text-gray-400" />
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-2">{bestPrice.product_name}</h3>
              {bestPrice.product_brand && (
                <p className="text-sm text-gray-600 mb-1">Marca: {bestPrice.product_brand}</p>
              )}
              {bestPrice.product_quantity && (
                <p className="text-sm text-gray-600 mb-1">Formato: {bestPrice.product_quantity}</p>
              )}
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-800">
                  <strong>{t.source}</strong> {t.priceAPILive}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-2 border-green-300 bg-gradient-to-br from-green-50 to-emerald-50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
              <Award className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-green-700 font-medium">Miglior Prezzo</p>
              <p className="text-2xl font-bold text-green-900">
                {bestPrice.price} {bestPrice.price_currency}
              </p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-700">
              <ShoppingCart className="h-4 w-4 text-green-600" />
              <span className="font-medium">Negozio:</span>
              <span>{bestPrice.location_name}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <MapPin className="h-4 w-4 text-green-600" />
              <span className="font-medium">Indirizzo:</span>
              <span className="text-xs">{bestPrice.location_address_city}, {bestPrice.location_address_country}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <Calendar className="h-4 w-4 text-green-600" />
              <span className="font-medium">Ultimo aggiornamento:</span>
              <span className="text-xs">{formatTimestamp(bestPrice.date)}</span>
            </div>
          </div>

          {bestPrice.product_url && (
            <Button
              variant="outline"
              className="w-full mt-4 border-green-600 text-green-700 hover:bg-green-50"
              onClick={() => window.open(bestPrice.product_url, '_blank')}
            >
              <Link2 className="h-4 w-4 mr-2" />
              Vedi su Open Prices
            </Button>
          )}
        </Card>

        {livePrices.length > 1 && (
          <Card className="p-6">
            <h4 className="font-bold text-lg mb-4">Altri Prezzi Disponibili</h4>
            <div className="space-y-3">
              {livePrices
                .filter(p => p.id !== bestPrice.id)
                .map((price, index) => {
                  const savings = calculateSavings(price.price, bestPrice.price, price.price_currency);
                  
                  return (
                    <div key={index} className="p-4 border rounded-lg bg-gray-50">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{price.location_name}</p>
                          <p className="text-xs text-gray-600 mt-1">
                            {price.location_address_city}, {price.location_address_country}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-gray-900">
                            {price.price} {price.price_currency}
                          </p>
                          {savings && (
                            <p className="text-xs text-red-600 mt-1">
                              +{savings}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                        <Calendar className="h-3 w-3" />
                        <span>{formatTimestamp(price.date)}</span>
                      </div>
                      {price.product_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full mt-2 text-xs"
                          onClick={() => window.open(price.product_url, '_blank')}
                        >
                          <Link2 className="h-3 w-3 mr-1" />
                          Dettagli
                        </Button>
                      )}
                    </div>
                  );
                })}
            </div>
          </Card>
        )}

        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex gap-3">
            <DollarSign className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Prezzi in tempo reale</p>
              <p className="text-blue-800">
                I prezzi mostrati sono stati segnalati da utenti reali e potrebbero variare. 
                Verifica sempre il prezzo finale in negozio.
              </p>
            </div>
          </div>
        </Card>

        <Button 
          onClick={resetScanner} 
          className="w-full bg-blue-600 hover:bg-blue-700"
          size="lg"
        >
          <Scan className="h-5 w-5 mr-2" />
          {t.newScan}
        </Button>
      </>
    );
  };

  const renderOpenFoodFactsProduct = () => {
    if (!openFoodProduct) return null;

    return (
      <>
        <Card className="p-6 border-green-200 bg-green-50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
              <Check className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-green-700 font-medium">
                {t.productIdentified}
              </p>
              <p className="text-xs text-green-600">Codice: {openFoodProduct.ean}</p>
            </div>
            {renderSourceBadge()}
          </div>
        </Card>

        <Card className="p-6 border-2 border-blue-300">
          <div className="flex gap-4">
            {openFoodProduct.imageUrl ? (
              <div className="w-32 h-32 bg-white rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border">
                <img 
                  src={openFoodProduct.imageUrl} 
                  alt={openFoodProduct.productName}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="flex items-center justify-center w-full h-full"><svg class="h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg></div>';
                  }}
                />
              </div>
            ) : (
              <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="h-16 w-16 text-gray-400" />
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-2">{openFoodProduct.productName}</h3>
              {openFoodProduct.brand && (
                <p className="text-sm text-gray-600 mb-1">Marca: {openFoodProduct.brand}</p>
              )}
              {openFoodProduct.quantity && (
                <p className="text-sm text-gray-600 mb-1">Formato: {openFoodProduct.quantity}</p>
              )}
              {openFoodProduct.category && (
                <p className="text-sm text-gray-600 mb-2">Categoria: {openFoodProduct.category}</p>
              )}
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-800">
                  <strong>{t.source}</strong> {productSource === 'api' ? t.openFoodFactsAPI : productSource === 'cache' ? t.supabaseCache : t.localDatabase}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-900">
              <p className="font-medium mb-1">Nessun prezzo disponibile</p>
              <p className="text-yellow-800">
                Questo prodotto è stato trovato in Open Food Facts ma non abbiamo prezzi live disponibili per {getCountryName(selectedCountry)}. 
                Prova a cambiare paese nelle Impostazioni o confrontalo manualmente con i tuoi fornitori.
              </p>
            </div>
          </div>
        </Card>

        <Button 
          onClick={resetScanner} 
          className="w-full bg-blue-600 hover:bg-blue-700"
          size="lg"
        >
          <Scan className="h-5 w-5 mr-2" />
          {t.newScan}
        </Button>
      </>
    );
  };

  const renderPermissionDeniedCard = () => {
    if (permissionStatus !== 'permanently_denied') return null;

    return (
      <Card className="p-6 bg-orange-50 border-2 border-orange-300">
        <div className="flex gap-3 mb-4">
          <AlertCircle className="h-6 w-6 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-lg text-orange-900 mb-2">
              {t.permissionPermanentlyDenied}
            </h3>
            <p className="text-sm text-orange-800 mb-4">
              {isIOS ? t.settingsInstructionsIOS : t.settingsInstructionsAndroid}
            </p>
            
            <div className="bg-white rounded-lg p-4 mb-4 border border-orange-200">
              <p className="text-xs text-gray-600 mb-2 font-medium">
                {isIOS ? 'iOS' : 'Android'} - {t.goToSettings}:
              </p>
              <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside">
                {isIOS ? (
                  <>
                    <li>Apri l'app <strong>Impostazioni</strong></li>
                    <li>Scorri verso il basso e trova <strong>RESTO</strong></li>
                    <li>Tocca <strong>Fotocamera</strong></li>
                    <li>Attiva il permesso</li>
                  </>
                ) : (
                  <>
                    <li>Apri l'app <strong>Impostazioni</strong></li>
                    <li>Vai su <strong>App</strong> o <strong>Gestione applicazioni</strong></li>
                    <li>Trova e tocca <strong>RESTO</strong></li>
                    <li>Tocca <strong>Autorizzazioni</strong></li>
                    <li>Tocca <strong>Fotocamera</strong> e seleziona <strong>Consenti</strong></li>
                  </>
                )}
              </ol>
            </div>

            <Button
              onClick={openAppSettings}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white"
              size="lg"
            >
              <SettingsIcon className="h-5 w-5 mr-2" />
              {t.goToSettings}
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 max-w-md">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {t.back}
            </Button>
            <h1 className="text-xl font-bold">{t.livePriceScanner}</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6 max-w-md space-y-4">
        {/* Permission Permanently Denied Card */}
        {renderPermissionDeniedCard()}

        {/* Error Message */}
        {error && permissionStatus !== 'permanently_denied' && (
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">{error}</p>
                {permissionStatus === 'denied' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={requestPermission}
                    className="mt-3 border-red-600 text-red-700 hover:bg-red-50"
                  >
                    {t.requestPermission}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Loading State */}
        {isLoading && (
          <Card className="p-8">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
              <p className="text-gray-600 font-medium">Ricerca prodotto in corso...</p>
              <p className="text-sm text-gray-500 text-center">
                Stiamo cercando il prodotto nel database locale, cache Supabase, Price API e Open Food Facts
              </p>
            </div>
          </Card>
        )}

        {/* Checking Permission State */}
        {permissionStatus === 'checking' && !isLoading && (
          <Card className="p-8">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
              <p className="text-gray-600 font-medium">{t.checkingPermission}</p>
            </div>
          </Card>
        )}

        {/* Scan Step */}
        {step === 'scan' && !isLoading && permissionStatus !== 'checking' && (
          <Card className="p-8">
            <div className="text-center space-y-6">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mx-auto flex items-center justify-center">
                <Camera className="h-12 w-12 text-white" />
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {t.livePriceScanner}
                </h2>
                <p className="text-gray-600">
                  {t.scanBarcodeDescription}
                </p>
              </div>

              <Button
                onClick={startScanning}
                disabled={isScanning || permissionStatus !== 'granted'}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg py-6"
                size="lg"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="h-6 w-6 mr-2 animate-spin" />
                    Scansione in corso...
                  </>
                ) : (
                  <>
                    <Scan className="h-6 w-6 mr-2" />
                    {t.startScanner}
                  </>
                )}
              </Button>

              {permissionStatus !== 'granted' && permissionStatus !== 'permanently_denied' && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>{t.permissionRequired}</strong> {t.permissionRequiredDescription}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={requestPermission}
                    className="mt-3 w-full border-yellow-600 text-yellow-700 hover:bg-yellow-50"
                  >
                    {t.grantPermission}
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4 pt-6 border-t">
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full mx-auto flex items-center justify-center mb-2">
                    <Database className="h-6 w-6 text-blue-600" />
                  </div>
                  <p className="text-xs text-gray-600">{t.localDatabase}</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full mx-auto flex items-center justify-center mb-2">
                    <Globe className="h-6 w-6 text-green-600" />
                  </div>
                  <p className="text-xs text-gray-600">Price API</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-orange-100 rounded-full mx-auto flex items-center justify-center mb-2">
                    <ShoppingCart className="h-6 w-6 text-orange-600" />
                  </div>
                  <p className="text-xs text-gray-600">Open Food Facts</p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Comparison Step (Local Database) */}
        {step === 'comparison' && comparison && (
          <>
            <Card className="p-6 border-green-200 bg-green-50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                  <Check className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-green-700 font-medium">
                    {t.productFound}
                  </p>
                  <p className="text-xs text-green-600">Codice: {comparison.ean}</p>
                </div>
                {renderSourceBadge()}
              </div>
            </Card>

            <Card className="p-6 border-2 border-blue-300">
              <h3 className="font-bold text-xl mb-4">{comparison.productName}</h3>
              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <p><strong>Categoria:</strong> {comparison.category}</p>
                <p><strong>Formato:</strong> {comparison.format}</p>
              </div>
            </Card>

            <Card className="p-6">
              <h4 className="font-bold text-lg mb-4">Confronto Prezzi Cash & Carry</h4>
              {renderMultiSupplierComparison(comparison.products, comparison.bestPrice)}
            </Card>

            <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                  <Award className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-green-700 font-medium">Risparmio Massimo</p>
                  <p className="text-2xl font-bold text-green-900">
                    €{comparison.maxSavings.toFixed(2)}
                  </p>
                </div>
              </div>
              <p className="text-sm text-green-800">
                Scegliendo {comparison.bestPrice.supplier} invece del prezzo più alto
              </p>
            </Card>

            <Button 
              onClick={resetScanner} 
              className="w-full bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              <Scan className="h-5 w-5 mr-2" />
              {t.newScan}
            </Button>
          </>
        )}

        {/* Match Step (Price API Live Prices) */}
        {step === 'match' && renderLivePricesProduct()}

        {/* Identified Step (Open Food Facts) */}
        {step === 'identified' && renderOpenFoodFactsProduct()}
      </div>

      <style>{`
        body.scanner-active {
          background: transparent !important;
        }
        body.scanner-active .scanner-ui {
          background: transparent !important;
        }
      `}</style>
    </div>
  );
}