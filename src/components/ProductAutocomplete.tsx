import { useState, useEffect, useRef, useCallback } from 'react';
import { Product, Supplier } from '@/types';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Check, TrendingUp, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';
import { useDebounce } from '@/hooks/useDebounce'; // ← Aggiungi questo hook

interface ProductAutocompleteProps {
  products: Product[];
  suppliers: Supplier[];
  onSelect: (productId: string) => void;
  onEnterPressed?: () => void;
  placeholder?: string;
  productOrderFrequency?: Record<string, number>;
}

export default function ProductAutocomplete({
  products,
  suppliers,
  onSelect,
  onEnterPressed,
  placeholder,
  productOrderFrequency = {},
}: ProductAutocompleteProps) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 200);

  // Filter con memoizzazione
  const filterProducts = useCallback((term: string) => {
    if (term.length === 0) return [];
    
    const searchLower = term.toLowerCase();
    const filtered = products.filter((product) => {
      const nameMatch = product.name.toLowerCase().includes(searchLower);
      const codeMatch = product.name.match(/\b\d+\b/g)?.some(code => 
        code.includes(searchTerm)
      );
      return nameMatch || codeMatch;
    });

    // Sort by frequency + name
    return filtered.sort((a, b) => {
      const freqA = productOrderFrequency[a.id] || 0;
      const freqB = productOrderFrequency[b.id] || 0;
      return freqB - freqA || a.name.localeCompare(b.name);
    });
  }, [products, productOrderFrequency, searchTerm]);

  useEffect(() => {
    const results = filterProducts(debouncedSearchTerm);
    setFilteredProducts(results);
    setIsOpen(results.length > 0 && isFocused);
    setSelectedIndex(0);
  }, [debouncedSearchTerm, filterProducts, isFocused]);

  const handleSelect = useCallback((productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setSearchTerm('');
      onSelect(productId);
      setIsOpen(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [products, onSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filteredProducts.length === 0) {
      if (e.key === 'Enter' && onEnterPressed) {
        e.preventDefault();
        onEnterPressed();
      }
      return;
    }

    // Keyboard navigation...
    // (stesso codice, ma con useCallback)
  }, [isOpen, filteredProducts, selectedIndex, handleSelect, onEnterPressed]);

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder || t.searchProductPlaceholder}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          className="pl-10"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      </div>

      {/* Dropdown... stesso di prima, ma più performante */}
      
      <div className="mt-1 text-xs text-muted-foreground">
        💡 {t('keyboardShortcutHint')}
      </div>
    </div>
  );
}
