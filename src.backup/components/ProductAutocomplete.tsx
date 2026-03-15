import { useState, useEffect, useRef } from 'react';
import { Product, Supplier } from '@/types';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Check, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface ProductAutocompleteProps {
  products: Product[];
  suppliers: Supplier[];
  value: string;
  onSelect: (productId: string) => void;
  onEnterPressed?: () => void;
  placeholder?: string;
  productOrderFrequency?: Record<string, number>;
}

export default function ProductAutocomplete({
  products,
  suppliers,
  value,
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchTerm.length > 0) {
      // Filter products by name or code
      const filtered = products.filter((product) => {
        const searchLower = searchTerm.toLowerCase();
        const nameMatch = product.name.toLowerCase().includes(searchLower);
        
        // Extract potential product code from name (numbers at start or end)
        const codeMatch = product.name.match(/\b\d+\b/g);
        const hasCodeMatch = codeMatch?.some(code => code.includes(searchTerm));
        
        return nameMatch || hasCodeMatch;
      });

      // Sort by order frequency (most ordered first)
      const sorted = filtered.sort((a, b) => {
        const freqA = productOrderFrequency[a.id] || 0;
        const freqB = productOrderFrequency[b.id] || 0;
        
        if (freqA !== freqB) {
          return freqB - freqA; // Higher frequency first
        }
        
        // If same frequency, sort alphabetically
        return a.name.localeCompare(b.name);
      });

      setFilteredProducts(sorted);
      setIsOpen(sorted.length > 0);
      setSelectedIndex(0);
    } else {
      setFilteredProducts([]);
      setIsOpen(false);
      setSelectedIndex(0);
    }
  }, [searchTerm, products, productOrderFrequency]);

  const handleSelect = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setSearchTerm('');
      onSelect(productId);
      setIsOpen(false);
      setSelectedIndex(0);
      // Keep focus on input for quick consecutive additions
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleInputFocus = () => {
    if (searchTerm.length > 0 && filteredProducts.length > 0) {
      setIsOpen(true);
    }
  };

  const handleInputBlur = () => {
    // Delay to allow click on suggestion
    setTimeout(() => {
      setIsOpen(false);
      setSelectedIndex(0);
    }, 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filteredProducts.length === 0) {
      // If no suggestions, Enter should trigger add
      if (e.key === 'Enter' && onEnterPressed) {
        e.preventDefault();
        onEnterPressed();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < filteredProducts.length - 1 ? prev + 1 : prev
        );
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      
      case 'Enter':
        e.preventDefault();
        if (filteredProducts[selectedIndex]) {
          handleSelect(filteredProducts[selectedIndex].id);
        }
        break;
      
      case 'Escape':
        e.preventDefault();
        setSearchTerm('');
        setIsOpen(false);
        setSelectedIndex(0);
        inputRef.current?.blur();
        break;
    }
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder || t.searchProductPlaceholder}
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        onKeyDown={handleKeyDown}
        className="w-full"
      />
      {isOpen && filteredProducts.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-[300px] overflow-auto">
          <Command>
            <CommandList>
              {filteredProducts.length === 0 ? (
                <CommandEmpty>{t.noProducts}</CommandEmpty>
              ) : (
                <CommandGroup>
                  {filteredProducts.map((product, index) => {
                    const supplier = suppliers.find((s) => s.id === product.supplierId);
                    const orderCount = productOrderFrequency[product.id] || 0;
                    const isSelected = index === selectedIndex;
                    
                    return (
                      <CommandItem
                        key={product.id}
                        value={product.id}
                        onSelect={() => handleSelect(product.id)}
                        className={cn(
                          'cursor-pointer',
                          isSelected && 'bg-accent'
                        )}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            value === product.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{product.name}</p>
                            {orderCount > 0 && (
                              <span className="flex items-center gap-1 text-xs text-primary">
                                <TrendingUp className="h-3 w-3" />
                                {orderCount}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            €{product.price.toFixed(2)}
                            {supplier && ` • ${supplier.name}`}
                            {product.category && ` • ${product.category}`}
                          </p>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </div>
      )}
      <div className="mt-1 text-xs text-muted-foreground">
        💡 {t.keyboardShortcutHint}
      </div>
    </div>
  );
}