import { Suspense } from 'react';
import ForgotPasswordContent from '../forgot-password-content';
import LoadingSpinner from '@/components/LoadingSpinner';

export const metadata = {
  title: 'Forgot Password - Vizora',
  description: 'Reset your Vizora account password',
};

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ForgotPasswordContent />
    </Suspense>
  );
}
