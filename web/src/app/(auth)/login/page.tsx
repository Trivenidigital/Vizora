import { Suspense } from 'react';
import LoginContent from '../login-content';
import LoadingSpinner from '@/components/LoadingSpinner';

export const metadata = {
  title: 'Login - Vizora',
  description: 'Login to your Vizora account',
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <LoginContent />
    </Suspense>
  );
}
