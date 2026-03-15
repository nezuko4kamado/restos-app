import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Eye, UserPlus } from 'lucide-react';

/**
 * A sticky banner shown at the top of the app when the user is in Demo Mode.
 * Encourages them to register for a full account.
 */
export default function DemoBanner() {
  const { isDemoMode, exitDemoMode } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  if (!isDemoMode) return null;

  const handleRegister = () => {
    exitDemoMode();
    navigate('/login');
  };

  return (
    <div className="sticky top-0 z-50 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-md">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Eye className="h-4 w-4 flex-shrink-0" />
        <span>{t('demoBannerText')}</span>
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={handleRegister}
        className="bg-white text-orange-600 hover:bg-orange-50 font-semibold text-xs px-3 py-1 h-auto flex-shrink-0"
      >
        <UserPlus className="h-3.5 w-3.5 mr-1" />
        {t('registerButton')}
      </Button>
    </div>
  );
}