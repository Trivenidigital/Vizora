import { vi } from 'vitest';
import React from 'react';

const mockNavigate = vi.fn();
const mockLocation = vi.fn().mockReturnValue({
  pathname: '/',
  search: '',
  hash: '',
  state: null
});
const mockParams = vi.fn().mockReturnValue({});
const mockSearchParams = vi.fn().mockReturnValue([new URLSearchParams(), vi.fn()]);

export const Link = ({ children, to, ...rest }: { children: React.ReactNode, to: string, [key: string]: any }) => 
  React.createElement('a', { href: to, ...rest }, children);

export const NavLink = ({ children, to, ...rest }: { children: React.ReactNode, to: string, [key: string]: any }) => 
  React.createElement('a', { href: to, ...rest }, children);

export const Navigate = ({ to }: { to: string }) => 
  React.createElement('div', { 'data-testid': 'navigate', to });

export const Outlet = () => 
  React.createElement('div', { 'data-testid': 'outlet' });

export const Routes = ({ children }: { children: React.ReactNode }) => 
  React.createElement('div', { 'data-testid': 'routes' }, children);

export const Route = () => 
  React.createElement('div', { 'data-testid': 'route' });

export const BrowserRouter = ({ children }: { children: React.ReactNode }) => 
  React.createElement('div', {}, children);

export const MemoryRouter = ({ children }: { children: React.ReactNode }) => 
  React.createElement('div', {}, children);

export const useNavigate = () => mockNavigate;
export const useLocation = () => mockLocation();
export const useParams = () => mockParams();
export const useSearchParams = () => mockSearchParams();

export const resetRouterMocks = () => {
  mockNavigate.mockClear();
  mockLocation.mockClear();
  mockParams.mockClear();
  mockSearchParams.mockClear();
};

export default {
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
  Link,
  NavLink,
  Navigate,
  Outlet,
  Routes,
  Route,
  BrowserRouter,
  MemoryRouter,
  resetRouterMocks
};