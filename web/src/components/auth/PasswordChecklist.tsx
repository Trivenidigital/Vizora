'use client';

interface PasswordChecklistProps {
  password: string;
}

const requirements = [
  { label: '8+ characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number or special char', test: (p: string) => /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p) },
];

export default function PasswordChecklist({ password }: PasswordChecklistProps) {
  if (!password) return null;

  const allMet = requirements.every((r) => r.test(password));

  return (
    <div className="mt-2 space-y-1">
      {requirements.map((req) => {
        const met = req.test(password);
        return (
          <div
            key={req.label}
            className={`flex items-center gap-2 text-xs transition-colors duration-200 ${
              met ? 'text-[var(--success)]' : 'text-[var(--foreground-tertiary)]'
            }`}
          >
            <span
              className={`inline-flex items-center justify-center w-4 h-4 rounded-full transition-all duration-200 ${
                met
                  ? 'bg-[var(--success)] text-white scale-100'
                  : 'border border-[var(--border)] scale-90'
              }`}
            >
              {met && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5L4 7L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            {req.label}
          </div>
        );
      })}
      {allMet && (
        <p className="text-xs text-[var(--success)] font-medium mt-1">Strong password</p>
      )}
    </div>
  );
}
