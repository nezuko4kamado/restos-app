import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';
import { getCountries, CountryVATRates } from '@/lib/vatRates';
import { t } from '@/lib/i18n';

interface CountrySelectorProps {
  value: string;
  onChange: (country: string) => void;
}

export default function CountrySelector({ value, onChange }: CountrySelectorProps) {
  const [currentCountry, setCurrentCountry] = useState<string>(value || 'IT');
  const countries = getCountries();

  useEffect(() => {
    setCurrentCountry(value || 'IT');
  }, [value]);

  const handleCountryChange = (countryCode: string) => {
    setCurrentCountry(countryCode);
    onChange(countryCode);
  };

  const selectedCountry = countries.find((c) => c.code === currentCountry);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Globe className="h-4 w-4 mr-2" />
          {selectedCountry?.flag} {selectedCountry?.name}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {countries.map((country) => (
          <DropdownMenuItem
            key={country.code}
            onClick={() => handleCountryChange(country.code)}
            className={currentCountry === country.code ? 'bg-accent' : ''}
          >
            <span className="mr-2">{country.flag}</span>
            {country.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}