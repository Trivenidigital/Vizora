import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { server } from './mocks/server';
import type { ReactNode } from 'react';

// Import ConnectionManager mocks
import { mockSocket, mockWebSocketClient } from '@vizora/common';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/' }),
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  Navigate: ({ to }: { to: string }) => <div>Navigating to {to}</div>,
  useParams: () => ({}),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => {
  const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => 'mock-toast-id'),
    dismiss: vi.fn(),
    promise: vi.fn(),
    custom: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn()
  };
  return {
    default: mockToast,
    ...mockToast,
    Toaster: () => null
  };
});

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    })),
  },
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn(),
  parseISO: vi.fn(),
  isBefore: vi.fn(),
  isAfter: vi.fn(),
  addDays: vi.fn(),
  subDays: vi.fn(),
}));

// Mock @tanstack/react-query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  QueryClientProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// Mock react-dropzone
vi.mock('react-dropzone', () => ({
  useDropzone: () => ({
    getRootProps: vi.fn(),
    getInputProps: vi.fn(),
    isDragActive: false,
  }),
}));

// Mock react-datepicker
vi.mock('react-datepicker', () => ({
  default: ({ children, ...props }: { children?: ReactNode; [key: string]: any }) => (
    <input type="text" {...props}>{children}</input>
  ),
}));

// Mock react-select
vi.mock('react-select', () => ({
  default: ({ options, onChange, value }: { 
    options: Array<{ value: string; label: string }>;
    onChange: (option: { value: string; label: string }) => void;
    value?: { value: string; label: string };
  }) => (
    <select onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
      const option = options.find(opt => opt.value === e.target.value);
      if (option) onChange(option);
    }}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

// Mock react-toastify
vi.mock('react-toastify', () => ({
  ToastContainer: () => null,
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock react-icons/fi
vi.mock('react-icons/fi', () => ({
  FiPlus: () => 'Plus Icon',
  FiEdit2: () => 'Edit Icon',
  FiTrash2: () => 'Delete Icon',
  FiSettings: () => 'Settings Icon',
  FiLogOut: () => 'Logout Icon',
  FiUser: () => 'User Icon',
  FiBell: () => 'Bell Icon',
  FiSearch: () => 'Search Icon',
  FiFilter: () => 'Filter Icon',
  FiDownload: () => 'Download Icon',
  FiUpload: () => 'Upload Icon',
  FiRefreshCw: () => 'Refresh Icon',
  FiCheck: () => 'Check Icon',
  FiX: () => 'X Icon',
  FiAlertCircle: () => 'Alert Icon',
  FiInfo: () => 'Info Icon',
  FiClock: () => 'Clock Icon',
  FiCalendar: () => 'Calendar Icon',
  FiUsers: () => 'Users Icon',
  FiMonitor: () => 'Monitor Icon',
  FiFilm: () => 'Film Icon',
  FiImage: () => 'Image Icon',
  FiType: () => 'Type Icon',
  FiCode: () => 'Code Icon',
  FiBarChart2: () => 'Chart Icon',
  FiPieChart: () => 'Pie Chart Icon',
  FiTrendingUp: () => 'Trending Up Icon',
  FiTrendingDown: () => 'Trending Down Icon',
  FiActivity: () => 'Activity Icon',
  FiTarget: () => 'Target Icon',
}));

// Mock ConnectionManager
vi.mock('@vizora/common', () => ({
  useConnectionState: vi.fn(() => ({
    isConnected: true,
    isReconnecting: false,
  })),
  VizoraSocketClient: vi.fn().mockImplementation(() => mockWebSocketClient),
}));

// Mock TokenManager
vi.mock('@vizora/common', () => ({
  TokenManager: {
    getToken: vi.fn(() => 'mock-token'),
    setToken: vi.fn(),
    removeToken: vi.fn(),
    refreshToken: vi.fn(),
  },
}));

// Setup MSW
beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.sessionStorage = sessionStorageMock as any;

// Mock window.matchMedia
window.matchMedia = vi.fn().mockImplementation(query => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

// Mock window.URL
window.URL.createObjectURL = vi.fn();
window.URL.revokeObjectURL = vi.fn();

// Mock window.fetch
global.fetch = vi.fn(); 