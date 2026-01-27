# VIZORA - FRONTEND SPECIFICATIONS
## UI/UX Guidelines & Component Library

**Version:** 2.0  
**Last Updated:** January 26, 2026  
**Document:** 4 of 5  
**Status:** Ready for Implementation

---

## TABLE OF CONTENTS

1. [Design System](#1-design-system)
2. [Component Library](#2-component-library)
3. [Page Specifications](#3-page-specifications)
4. [Responsive Design](#4-responsive-design)
5. [Accessibility](#5-accessibility)

---

## 1. DESIGN SYSTEM

### 1.1 Color Palette

```css
:root {
  /* Primary - Blue */
  --primary-50: #eff6ff;
  --primary-100: #dbeafe;
  --primary-500: #3b82f6;
  --primary-600: #2563eb;
  --primary-700: #1d4ed8;
  
  /* Neutral - Gray */
  --neutral-50: #fafafa;
  --neutral-100: #f5f5f5;
  --neutral-200: #e5e5e5;
  --neutral-500: #737373;
  --neutral-800: #262626;
  --neutral-900: #171717;
  
  /* Success - Green */
  --success-50: #f0fdf4;
  --success-500: #22c55e;
  --success-600: #16a34a;
  
  /* Warning - Yellow */
  --warning-50: #fffbeb;
  --warning-500: #f59e0b;
  --warning-600: #d97706;
  
  /* Error - Red */
  --error-50: #fef2f2;
  --error-500: #ef4444;
  --error-600: #dc2626;
}
```

### 1.2 Typography

```typescript
// tailwind.config.js
module.exports = {
  theme: {
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'monospace'],
    },
    fontSize: {
      xs: ['0.75rem', { lineHeight: '1rem' }],
      sm: ['0.875rem', { lineHeight: '1.25rem' }],
      base: ['1rem', { lineHeight: '1.5rem' }],
      lg: ['1.125rem', { lineHeight: '1.75rem' }],
      xl: ['1.25rem', { lineHeight: '1.75rem' }],
      '2xl': ['1.5rem', { lineHeight: '2rem' }],
      '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
      '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
    },
  },
}
```

### 1.3 Spacing & Layout

```typescript
const spacing = {
  0: '0px',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
};
```

### 1.4 Shadows & Effects

```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);

--radius-sm: 0.375rem;  /* 6px */
--radius-md: 0.5rem;    /* 8px */
--radius-lg: 0.75rem;   /* 12px */
--radius-xl: 1rem;      /* 16px */
```

---

## 2. COMPONENT LIBRARY

### 2.1 Button Component

```typescript
// components/ui/button.tsx
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary-600 text-white hover:bg-primary-700',
        secondary: 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300',
        outline: 'border border-neutral-300 bg-transparent hover:bg-neutral-100',
        ghost: 'hover:bg-neutral-100',
        destructive: 'bg-error-600 text-white hover:bg-error-700',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-10 px-4',
        lg: 'h-11 px-8 text-lg',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, ...props }, ref) => {
    return (
      <button
        className={buttonVariants({ variant, size, className })}
        ref={ref}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading && (
          <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

export { Button, buttonVariants };
```

### 2.2 Card Component

```typescript
// components/ui/card.tsx
import { HTMLAttributes, forwardRef } from 'react';

const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={`rounded-lg border border-neutral-200 bg-white shadow-sm ${className}`}
      {...props}
    />
  )
);

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={`flex flex-col space-y-1.5 p-6 ${className}`}
      {...props}
    />
  )
);

const CardTitle = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={`text-2xl font-semibold leading-none tracking-tight ${className}`}
      {...props}
    />
  )
);

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={`p-6 pt-0 ${className}`} {...props} />
  )
);

export { Card, CardHeader, CardTitle, CardContent };
```

### 2.3 Input Component

```typescript
// components/ui/input.tsx
import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="text-sm font-medium text-neutral-700">
            {label}
            {props.required && <span className="text-error-500 ml-1">*</span>}
          </label>
        )}
        <input
          className={`
            flex h-10 w-full rounded-md border px-3 py-2 text-sm
            ${error ? 'border-error-500' : 'border-neutral-300'}
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
            disabled:cursor-not-allowed disabled:opacity-50
            ${className}
          `}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="text-sm text-error-600">{error}</p>
        )}
      </div>
    );
  }
);

export { Input };
```

### 2.4 Modal Component

```typescript
// components/ui/modal.tsx
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title className="text-lg font-medium">
                    {title}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="rounded-md p-1 hover:bg-neutral-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-2">{children}</div>

                {footer && (
                  <div className="mt-6 flex justify-end gap-3">
                    {footer}
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
```

---

## 3. PAGE SPECIFICATIONS

### 3.1 Dashboard Layout

```typescript
// app/(dashboard)/layout.tsx
import { Sidebar } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-neutral-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### 3.2 Device List Page

```typescript
// app/(dashboard)/devices/page.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Monitor, Circle } from 'lucide-react';
import { PairingModal } from '@/components/devices/pairing-modal';

export default function DevicesPage() {
  const [isPairingOpen, setIsPairingOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const res = await fetch('/api/devices', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Devices</h1>
          <p className="text-neutral-600 mt-1">
            Manage your display devices
          </p>
        </div>
        <Button onClick={() => setIsPairingOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Pair Device
        </Button>
      </div>

      {/* Device Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data?.data.devices.map((device) => (
          <Card key={device.id} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-50 rounded-lg">
                  <Monitor className="h-6 w-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900">
                    {device.nickname}
                  </h3>
                  <p className="text-sm text-neutral-600">
                    {device.location}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Circle
                  className={`h-3 w-3 ${
                    device.status === 'online'
                      ? 'fill-success-500 text-success-500'
                      : 'fill-neutral-400 text-neutral-400'
                  }`}
                />
                <span className="text-sm text-neutral-600 capitalize">
                  {device.status}
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Current Playlist</span>
                <span className="font-medium">
                  {device.currentPlaylist?.name || 'None'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Last Heartbeat</span>
                <span className="font-medium">
                  {new Date(device.lastHeartbeat).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Pairing Modal */}
      <PairingModal
        isOpen={isPairingOpen}
        onClose={() => setIsPairingOpen(false)}
      />
    </div>
  );
}
```

### 3.3 Playlist Builder

```typescript
// app/(dashboard)/playlists/[id]/edit/page.tsx
'use client';

import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useState } from 'react';
import { PlaylistItem } from '@/components/playlists/playlist-item';
import { ContentPicker } from '@/components/playlists/content-picker';
import { Button } from '@/components/ui/button';

export default function PlaylistEditPage({ params }: { params: { id: string } }) {
  const [items, setItems] = useState([]);

  function handleDragEnd(event) {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  return (
    <div className="grid grid-cols-12 gap-6 h-full">
      {/* Content Library */}
      <div className="col-span-3 bg-white rounded-lg border p-4">
        <h3 className="font-semibold mb-4">Content Library</h3>
        <ContentPicker onSelect={(content) => {
          setItems([...items, {
            id: content.id,
            contentId: content.id,
            duration: 10,
            transition: 'fade',
          }]);
        }} />
      </div>

      {/* Playlist Timeline */}
      <div className="col-span-9 bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Playlist Builder</h2>
          <Button>Save Playlist</Button>
        </div>

        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map(i => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {items.map((item) => (
                <PlaylistItem
                  key={item.id}
                  item={item}
                  onUpdate={(updated) => {
                    setItems(items.map(i => 
                      i.id === item.id ? updated : i
                    ));
                  }}
                  onRemove={() => {
                    setItems(items.filter(i => i.id !== item.id));
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {items.length === 0 && (
          <div className="text-center py-12 text-neutral-500">
            Drag content from the library to build your playlist
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 4. RESPONSIVE DESIGN

### 4.1 Breakpoints

```typescript
const breakpoints = {
  sm: '640px',   // Mobile landscape
  md: '768px',   // Tablet
  lg: '1024px',  // Desktop
  xl: '1280px',  // Large desktop
  '2xl': '1536px', // Extra large
};
```

### 4.2 Mobile-First Approach

```typescript
// Example: Responsive grid
<div className="
  grid 
  grid-cols-1      /* Mobile: 1 column */
  md:grid-cols-2   /* Tablet: 2 columns */
  lg:grid-cols-3   /* Desktop: 3 columns */
  xl:grid-cols-4   /* Large: 4 columns */
  gap-6
">
  {items.map(item => <Card key={item.id} />)}
</div>
```

---

## 5. ACCESSIBILITY

### 5.1 WCAG 2.1 AA Compliance

**Requirements:**
- ✅ Color contrast ratio ≥ 4.5:1 for text
- ✅ Color contrast ratio ≥ 3:1 for UI components
- ✅ Keyboard navigation for all interactive elements
- ✅ Focus indicators visible and clear
- ✅ Alt text for all images
- ✅ ARIA labels for icon buttons
- ✅ Semantic HTML5 elements

### 5.2 Implementation Examples

```typescript
// Accessible button with icon
<button
  aria-label="Delete device"
  className="p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
>
  <Trash2 className="h-5 w-5" />
</button>

// Accessible form input
<div>
  <label htmlFor="device-name" className="block text-sm font-medium">
    Device Name
  </label>
  <input
    id="device-name"
    type="text"
    aria-required="true"
    aria-invalid={!!error}
    aria-describedby={error ? "device-name-error" : undefined}
  />
  {error && (
    <p id="device-name-error" className="text-sm text-error-600" role="alert">
      {error}
    </p>
  )}
</div>

// Accessible modal
<Dialog
  open={isOpen}
  onClose={onClose}
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
>
  <Dialog.Title id="modal-title">
    Confirm Action
  </Dialog.Title>
  <Dialog.Description id="modal-description">
    Are you sure you want to proceed?
  </Dialog.Description>
</Dialog>
```

---

**Document End**
