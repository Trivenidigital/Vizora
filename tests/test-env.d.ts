/// <reference types="vitest" />
/// <reference types="@testing-library/jest-dom" />
import React from 'react';

declare module 'react-router-dom' {
  export * from 'react-router-dom';
}

declare module 'react-hot-toast' {
  export default {
    success: (message: string) => void;
    error: (message: string) => void;
  };
}

declare module '@/contexts/AuthContext' {
  export const AuthProvider: React.FC<{ children: React.ReactNode }>;
}

declare module '@/pages/displays/DisplayList' {
  const DisplayList: React.FC;
  export default DisplayList;
}

declare module '@/services/displays' {
  const displayService: {
    getDisplays: () => Promise<any[]>;
    unpairDisplay: (id: string) => Promise<void>;
  };
  export default displayService;
}

declare module '@/components/PushContentDialog' {
  const PushContentDialog: React.FC<{
    isOpen: boolean;
    onClose: () => void;
  }>;
  export default PushContentDialog;
} 