import { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import {
  validatePassword,
  getPasswordStrengthMessage,
  getPasswordStrengthColor,
  type PasswordValidationResult,
} from '@/utils/passwordValidation';

interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
}

export function PasswordStrengthIndicator({
  password,
  showRequirements = true,
}: PasswordStrengthIndicatorProps) {
  const validation: PasswordValidationResult = useMemo(
    () => validatePassword(password),
    [password]
  );

  const { requirements, strength, score } = validation;
  const strengthColor = getPasswordStrengthColor(strength);
  const strengthMessage = getPasswordStrengthMessage(strength);
  const progressValue = (score / 5) * 100;

  if (!password) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Strength Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 font-medium">Forza Password:</span>
          <span
            className={`font-semibold ${
              strength === 'weak'
                ? 'text-red-600'
                : strength === 'medium'
                ? 'text-yellow-600'
                : 'text-green-600'
            }`}
          >
            {strengthMessage}
          </span>
        </div>
        <div className="relative">
          <Progress value={progressValue} className="h-2" />
          <div
            className={`absolute top-0 left-0 h-2 rounded-full transition-all duration-300 ${strengthColor}`}
            style={{ width: `${progressValue}%` }}
          />
        </div>
      </div>

      {/* Requirements List */}
      {showRequirements && (
        <div className="space-y-2 pt-2 border-t border-gray-200">
          <p className="text-sm font-medium text-gray-700">Requisiti password:</p>
          <div className="space-y-1.5">
            <RequirementItem
              met={requirements.minLength}
              text="Minimo 8 caratteri"
            />
            <RequirementItem
              met={requirements.hasUppercase}
              text="Almeno una lettera maiuscola (A-Z)"
            />
            <RequirementItem
              met={requirements.hasLowercase}
              text="Almeno una lettera minuscola (a-z)"
            />
            <RequirementItem met={requirements.hasNumber} text="Almeno un numero (0-9)" />
            <RequirementItem
              met={requirements.hasSpecialChar}
              text="Almeno un carattere speciale (!@#$%^&*)"
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface RequirementItemProps {
  met: boolean;
  text: string;
}

function RequirementItem({ met, text }: RequirementItemProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {met ? (
        <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
      ) : (
        <X className="h-4 w-4 text-red-500 flex-shrink-0" />
      )}
      <span className={met ? 'text-green-700' : 'text-gray-600'}>{text}</span>
    </div>
  );
}