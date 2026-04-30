import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Languages } from 'lucide-react';
import { getAvailableLanguages, useLanguage, Language } from '@/lib/i18n';

interface LanguageSelectorProps {
  onLanguageChange?: () => void;
}

export default function LanguageSelector({ onLanguageChange }: LanguageSelectorProps) {
  const { language: currentLang, setLanguage } = useLanguage();
  const languages = getAvailableLanguages();

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    if (onLanguageChange) {
      onLanguageChange();
    }
  };

  const currentLanguage = languages.find((l) => l.code === currentLang);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Languages className="h-4 w-4 mr-2" />
          {currentLanguage?.flag} {currentLanguage?.name}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={currentLang === lang.code ? 'bg-accent' : ''}
          >
            <span className="mr-2">{lang.flag}</span>
            {lang.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}