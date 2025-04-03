import { ReactNode } from 'react';

export const BrowserRouter = ({ children }: { children: ReactNode }) => {
  return <>{children}</>;
};

export const Link = ({ to, children, ...props }: { to: string; children: ReactNode; [key: string]: any }) => {
  return <a href={to} {...props}>{children}</a>;
};

export const NavLink = ({ to, children, ...props }: { to: string; children: ReactNode; [key: string]: any }) => {
  return <a href={to} {...props}>{children}</a>;
};

export const Navigate = ({ to }: { to: string }) => {
  return <div>Navigating to {to}</div>;
};

export const useNavigate = () => {
  return (path: string) => {
    console.log(`Navigating to ${path}`);
  };
};

export const useLocation = () => {
  return {
    pathname: '/',
    search: '',
    hash: '',
    state: null,
    key: 'default'
  };
};

export const useParams = () => {
  return {};
};

export const Outlet = () => {
  return <div>Outlet</div>;
};

export const Routes = ({ children }: { children: ReactNode }) => {
  return <>{children}</>;
};

export const Route = ({ children }: { children: ReactNode }) => {
  return <>{children}</>;
}; 