export interface PasswordRequirements {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

export type PasswordStrength = 'weak' | 'medium' | 'strong';

export interface PasswordValidationResult {
  isValid: boolean;
  requirements: PasswordRequirements;
  strength: PasswordStrength;
  score: number;
}

/**
 * Validates a password against security requirements
 * @param password - The password to validate
 * @returns PasswordValidationResult object with validation details
 */
export function validatePassword(password: string): PasswordValidationResult {
  const requirements: PasswordRequirements = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  };

  // Calculate score (0-5)
  const score = Object.values(requirements).filter(Boolean).length;

  // Determine strength
  let strength: PasswordStrength;
  if (score <= 2) {
    strength = 'weak';
  } else if (score <= 4) {
    strength = 'medium';
  } else {
    strength = 'strong';
  }

  // Password is valid if all requirements are met
  const isValid = Object.values(requirements).every(Boolean);

  return {
    isValid,
    requirements,
    strength,
    score,
  };
}

/**
 * Gets the password strength level
 * @param password - The password to evaluate
 * @returns PasswordStrength level (weak, medium, strong)
 */
export function getPasswordStrength(password: string): PasswordStrength {
  return validatePassword(password).strength;
}

/**
 * Gets a user-friendly message for password strength
 * @param strength - The password strength level
 * @returns A descriptive message
 */
export function getPasswordStrengthMessage(strength: PasswordStrength): string {
  switch (strength) {
    case 'weak':
      return 'Password debole - Aggiungi più caratteri e varietà';
    case 'medium':
      return 'Password media - Quasi sicura!';
    case 'strong':
      return 'Password forte - Ottima scelta!';
  }
}

/**
 * Gets the color for password strength indicator
 * @param strength - The password strength level
 * @returns Tailwind color class
 */
export function getPasswordStrengthColor(strength: PasswordStrength): string {
  switch (strength) {
    case 'weak':
      return 'bg-red-500';
    case 'medium':
      return 'bg-yellow-500';
    case 'strong':
      return 'bg-green-500';
  }
}