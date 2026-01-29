import { Suspense } from 'react';
import RegisterContent from '../register-content';
import LoadingSpinner from '@/components/LoadingSpinner';

export const metadata = {
  title: 'Register - Vizora',
  description: 'Create a new Vizora account',
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <RegisterContent />
    </Suspense>
  );
}
