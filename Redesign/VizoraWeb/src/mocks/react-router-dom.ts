import { vi } from 'vitest';
import { ReactNode } from 'react';

export const useNavigate = vi.fn();
export const useLocation = vi.fn(() => ({
  pathname: '/',
  search: '',
  hash: '',
  state: null,
  key: 'default'
}));
export const useParams = vi.fn(() => ({}));
export const useSearchParams = vi.fn(() => [new URLSearchParams(), vi.fn()]);
export const useOutlet = vi.fn();
export const useOutletContext = vi.fn();
export const useResolvedPath = vi.fn((to) => to);
export const useHref = vi.fn((to) => to);
export const useMatch = vi.fn();
export const useBlocker = vi.fn();
export const useRevalidator = vi.fn(() => ({
  revalidate: vi.fn(),
  state: 'idle'
}));

export const Link = ({ to, children }: { to: string; children: ReactNode }): JSX.Element => (
  <a href={to}>{children}</a>
);

export const NavLink = ({ to, children }: { to: string; children: ReactNode }): JSX.Element => (
  <a href={to}>{children}</a>
);

export const Outlet = (): JSX.Element => <div>Outlet</div>;

export const Routes = ({ children }: { children: ReactNode }): JSX.Element => (
  <div>{children}</div>
);

export const Route = ({ path, element }: { path: string; element: ReactNode }): JSX.Element => (
  <div>{element}</div>
);

export const Navigate = ({ to }: { to: string }): JSX.Element => (
  <div>Navigating to {to}</div>
);

export const useNavigationType = vi.fn(() => 'POP');
export const useNavigation = vi.fn(() => ({
  state: 'idle',
  location: null,
  formData: null,
  formAction: null,
  formMethod: null
}));

export const createBrowserRouter = vi.fn();
export const createHashRouter = vi.fn();
export const createMemoryRouter = vi.fn();
export const RouterProvider = vi.fn();

export const BrowserRouter = ({ children }: { children: ReactNode }): JSX.Element => (
  <div>{children}</div>
); 