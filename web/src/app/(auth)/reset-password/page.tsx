import { Suspense } from 'react';
import ResetPasswordContent from '../reset-password-content';
import LoadingSpinner from '@/components/LoadingSpinner';

export const metadata = {
  title: 'Reset Password - Vizora',
  description: 'Create a new password for your Vizora account',
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
