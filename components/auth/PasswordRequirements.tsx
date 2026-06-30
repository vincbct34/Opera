'use client';

import { Check, X } from '@deemlol/next-icons';

interface PasswordRequirement {
  met: boolean;
  text: string;
}

interface PasswordRequirementsProps {
  password: string;
  showRequirements?: boolean;
}

/**
 * PasswordRequirements component
 * Visual indicator of password complexity requirements.
 * Displays a list of rules and checks them off as the user types.
 *
 * @param password - The password string to evaluate
 * @param showRequirements - Whether to show the list (default: true)
 */
export default function PasswordRequirements({
  password,
  showRequirements = true,
}: PasswordRequirementsProps) {
  const requirements: PasswordRequirement[] = [
    {
      met: password.length >= 10,
      text: 'Au moins 10 caractères',
    },
    {
      met: /[a-z]/.test(password),
      text: 'Au moins une lettre minuscule (a-z)',
    },
    {
      met: /[A-Z]/.test(password),
      text: 'Au moins une lettre majuscule (A-Z)',
    },
    {
      met: /\d/.test(password),
      text: 'Au moins un chiffre (0-9)',
    },
    {
      met: /[@$!%*?&#^()_+=\-[\]{}|;:'",.<>?/~`]/.test(password),
      text: 'Au moins un caractère spécial (@$!%*?&#...)',
    },
    {
      met: password.length <= 128,
      text: 'Maximum 128 caractères',
    },
  ];

  if (!showRequirements) {
    return null;
  }

  return (
    <div className="mt-2 p-3 sm:p-4 bg-gray-50 border border-gray-200 rounded-sm">
      <p className="text-xs sm:text-sm font-poppins font-semibold text-gray-700 mb-2">
        Exigences du mot de passe :
      </p>
      <ul className="space-y-1">
        {requirements.map((req, index) => (
          <li key={index} className="flex items-start gap-2 text-xs sm:text-sm font-ibm">
            {req.met ? (
              <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
            ) : (
              <X className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
            )}
            <span className={req.met ? 'text-green-700' : 'text-gray-600'}>{req.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
