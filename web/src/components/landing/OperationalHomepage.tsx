'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  FileImage,
  FolderOpen,
  MapPin,
  Menu,
  Monitor,
  Play,
  ShoppingBag,
  Store,
  Utensils,
  X,
} from 'lucide-react';

const navItems = [
  { label: 'Product', href: '#product' },
  { label: 'Solutions', href: '#deployments' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Customers', href: '#customers' },
  { label: 'Resources', href: '#resources' },
];

const customerCards = [
  {
    name: 'Urban Eats',
    quote: 'We replaced expensive signage software in a single afternoon.',
    detail: '18 restaurant screens',
  },
  {
    name: 'James Park',
    quote: 'Our managers update screens themselves now.',
    detail: 'Regional operations manager',
  },
  {
    name: 'Local Grocery Chain',
    quote: 'Simple enough for store staff. Reliable enough for every location.',
    detail: '7 neighborhood stores',
  },
];

const pillars = [
  {
    title: 'Create',
    description: 'Upload menus, promotions, videos, and templates in minutes.',
    icon: FileImage,
  },
  {
    title: 'Schedule',
    description: 'Set playlists by location, screen, daypart, or campaign.',
    icon: CalendarDays,
  },
  {
    title: 'Manage',
    description: 'See every display, status, and update from one clear dashboard.',
    icon: Monitor,
  },
];

const deployments = [
  {
    title: 'Restaurant menu boards',
    location: 'Ember & Brew - Downtown',
    icon: Utensils,
    image: '/templates/thumbnails/restaurant/03-coffee-shop.png',
    status: 'Lunch playlist live',
  },
  {
    title: 'Grocery promotions',
    location: 'Green Basket Market',
    icon: Store,
    image: '/templates/thumbnails/restaurant/01-daily-specials.png',
    status: 'Weekend offers scheduled',
  },
  {
    title: 'Retail signage',
    location: 'Northline Outfitters',
    icon: ShoppingBag,
    image: '/templates/thumbnails/restaurant/05-happy-hour.png',
    status: 'Window display online',
  },
  {
    title: 'Lobby displays',
    location: 'Harbor Dental Group',
    icon: MapPin,
    image: '/templates/thumbnails/restaurant/12-order-status.png',
    status: 'Waiting room loop ready',
  },
];

const scheduleRows = [
  { time: '7:00 AM', name: 'Breakfast Menu', screens: 'Kitchen + counter', color: '#DBEAFE' },
  { time: '11:30 AM', name: 'Lunch Specials', screens: 'All restaurant screens', color: '#DCFCE7' },
  { time: '3:00 PM', name: 'Afternoon Promo', screens: 'Front window', color: '#FEF3C7' },
  { time: '6:00 PM', name: 'Dinner Menu', screens: 'Dining room', color: '#E0E7FF' },
];

const contentTiles = [
  { name: 'Lunch Specials', type: 'Menu', image: '/templates/thumbnails/restaurant/01-daily-specials.png' },
  { name: 'Coffee Board', type: 'Template', image: '/templates/thumbnails/restaurant/03-coffee-shop.png' },
  { name: 'Pizza Night', type: 'Promo', image: '/templates/thumbnails/restaurant/04-pizza-menu.png' },
];

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

function DashboardPreview() {
  return (
    <div className="vh-dashboard-shell" aria-label="Vizora dashboard preview">
      <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-[#111827]">Operations overview</div>
          <div className="text-xs text-[#6B7280]">Today - 24 screens across 6 locations</div>
        </div>
        <div className="rounded-full bg-[#EFF6FF] px-3 py-1 text-xs font-medium text-[#1D4ED8]">
          22 online
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[190px_1fr]">
        <aside className="hidden border-r border-[#E5E7EB] bg-[#F9FAFB] p-4 lg:block">
          <div className="mb-4 text-xs font-semibold text-[#6B7280]">Locations</div>
          {['Downtown Cafe', 'Green Basket', 'Northline Retail', 'Harbor Dental'].map((location, index) => (
            <div
              key={location}
              className={`mb-2 rounded-[10px] px-3 py-2 text-sm ${
                index === 0 ? 'bg-white text-[#111827] shadow-sm' : 'text-[#4B5563]'
              }`}
            >
              {location}
            </div>
          ))}
        </aside>

        <div className="p-4 sm:p-5">
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Online', '22', '91% uptime'],
              ['Playlists', '14', '3 updated today'],
              ['Scheduled', '38', 'next change 11:30'],
              ['Alerts', '2', 'needs review'],
            ].map(([label, value, detail]) => (
              <div key={label} className="rounded-[14px] border border-[#E5E7EB] bg-white p-3">
                <div className="text-xs text-[#6B7280]">{label}</div>
                <div className="mt-1 text-2xl font-semibold text-[#111827]">{value}</div>
                <div className="mt-1 text-xs text-[#4B5563]">{detail}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_230px]">
            <div className="rounded-[16px] border border-[#E5E7EB] bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-[#111827]">Active playlists</div>
                  <div className="text-xs text-[#6B7280]">Real schedules, devices, and locations</div>
                </div>
                <CalendarDays size={18} className="text-[#2563EB]" />
              </div>
              <div className="space-y-3">
                {scheduleRows.map((row) => (
                  <div key={row.name} className="flex items-center gap-3 rounded-[12px] bg-[#F9FAFB] p-3">
                    <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-[10px] text-xs font-semibold text-[#111827]" style={{ background: row.color }}>
                      {row.time}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-[#111827]">{row.name}</div>
                      <div className="truncate text-xs text-[#6B7280]">{row.screens}</div>
                    </div>
                    <ChevronRight size={16} className="text-[#9CA3AF]" />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[16px] border border-[#E5E7EB] bg-white p-4">
              <div className="mb-3 text-sm font-semibold text-[#111827]">Screen previews</div>
              <div className="space-y-3">
                {contentTiles.map((tile) => (
                  <div key={tile.name} className="overflow-hidden rounded-[12px] border border-[#E5E7EB]">
                    <img src={tile.image} alt="" className="h-20 w-full object-cover" />
                    <div className="p-2">
                      <div className="truncate text-xs font-semibold text-[#111827]">{tile.name}</div>
                      <div className="text-xs text-[#6B7280]">{tile.type}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SchedulingPreview() {
  return (
    <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-[#111827]">Downtown Cafe schedule</div>
          <div className="text-xs text-[#6B7280]">Tuesday, May 13</div>
        </div>
        <button className="rounded-[10px] border border-[#E5E7EB] px-3 py-2 text-xs font-medium text-[#111827]">
          Week
        </button>
      </div>
      <div className="grid grid-cols-[64px_1fr] gap-3">
        <div className="space-y-5 pt-2 text-xs text-[#6B7280]">
          {['7 AM', '10 AM', '1 PM', '4 PM', '7 PM'].map((time) => (
            <div key={time}>{time}</div>
          ))}
        </div>
        <div className="relative min-h-[300px] rounded-[16px] border border-[#E5E7EB] bg-[#F9FAFB] p-3">
          {scheduleRows.map((row, index) => (
            <div
              key={row.name}
              className="mb-3 rounded-[14px] border border-white bg-white p-3 shadow-sm"
              style={{ borderLeft: `6px solid ${['#2563EB', '#16A34A', '#D97706', '#1E3A8A'][index]}` }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[#111827]">{row.name}</div>
                  <div className="text-xs text-[#6B7280]">{row.time} - {row.screens}</div>
                </div>
                <Clock3 size={16} className="shrink-0 text-[#9CA3AF]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OperationalHomepage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main id="main-content" className="vh-home min-h-screen bg-[#F7F8FA] text-[#111827]">
      <nav className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="Vizora home">
            <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#111827] text-white">
              <Monitor size={18} />
            </span>
            <span className="text-lg font-semibold text-[#111827]">Vizora</span>
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => scrollToId(item.href.slice(1))}
                className="text-sm font-medium text-[#4B5563] transition-colors hover:text-[#111827]"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Link href="/login" className="rounded-[12px] px-4 py-2 text-sm font-semibold text-[#111827] transition-colors hover:bg-[#F3F4F6]">
              Login
            </Link>
            <Link href="/register" className="vh-primary-button">
              Start Free
            </Link>
          </div>

          <button
            type="button"
            aria-label="Toggle menu"
            className="rounded-[10px] border border-[#E5E7EB] p-2 text-[#111827] md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-[#E5E7EB] bg-white px-5 py-4 md:hidden">
            <div className="flex flex-col gap-3">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    scrollToId(item.href.slice(1));
                    setMenuOpen(false);
                  }}
                  className="text-left text-sm font-medium text-[#4B5563]"
                >
                  {item.label}
                </button>
              ))}
              <div className="mt-2 flex gap-3">
                <Link href="/login" className="rounded-[12px] border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#111827]">
                  Login
                </Link>
                <Link href="/register" className="vh-primary-button">
                  Start Free
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      <section className="px-5 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto grid max-w-[1280px] items-center gap-12 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="max-w-[620px]">
            <p className="mb-5 text-sm font-semibold text-[#2563EB]">
              Trusted by restaurants, retail stores, and growing businesses.
            </p>
            <h1 className="text-5xl font-bold leading-none text-[#111827] sm:text-6xl lg:text-[64px]">
              Digital signage your team can actually run.
            </h1>
            <p className="mt-6 text-xl leading-8 text-[#4B5563]">
              Create, schedule, and manage every screen from one simple dashboard - without enterprise pricing or IT complexity.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="vh-primary-button justify-center px-6 py-3">
                Start Free <ArrowRight size={17} />
              </Link>
              <a href="mailto:sales@vizora.cloud" className="vh-secondary-button justify-center px-6 py-3">
                Book Demo <Play size={16} />
              </a>
            </div>
            <div className="mt-7 grid grid-cols-1 gap-3 text-sm text-[#4B5563] sm:grid-cols-3">
              {['Setup in minutes', '$6/screen', 'No contracts'].map((proof) => (
                <div key={proof} className="flex items-center gap-2">
                  <Check size={16} className="text-[#16A34A]" />
                  {proof}
                </div>
              ))}
            </div>
          </div>
          <DashboardPreview />
        </div>
      </section>

      <section id="customers" className="border-y border-[#E5E7EB] bg-white px-5 py-14 sm:px-6">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold text-[#2563EB]">Customer proof</p>
              <h2 className="mt-2 text-3xl font-semibold text-[#111827] sm:text-[40px]">
                Built for teams who run the floor.
              </h2>
            </div>
            <p className="max-w-md text-base leading-7 text-[#4B5563]">
              Clear workflows for operators, managers, and owners who need screens updated without waiting on IT.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {customerCards.map((card) => (
              <article key={card.name} className="vh-card p-6">
                <p className="text-lg font-semibold text-[#111827]">{card.name}</p>
                <p className="mt-5 text-xl leading-8 text-[#111827]">&ldquo;{card.quote}&rdquo;</p>
                <p className="mt-6 text-sm text-[#6B7280]">{card.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="product" className="px-5 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto max-w-[1280px]">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="text-sm font-semibold text-[#2563EB]">How Vizora works</p>
            <h2 className="mt-3 text-3xl font-semibold text-[#111827] sm:text-[40px]">
              Create. Schedule. Manage.
            </h2>
            <p className="mt-4 text-lg leading-8 text-[#4B5563]">
              Three practical workflows cover the daily signage jobs your team already has.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {pillars.map((pillar) => (
              <article key={pillar.title} className="vh-card p-7">
                <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#EFF6FF] text-[#2563EB]">
                  <pillar.icon size={21} />
                </div>
                <h3 className="text-2xl font-semibold text-[#111827]">{pillar.title}</h3>
                <p className="mt-3 text-base leading-7 text-[#4B5563]">{pillar.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="deployments" className="bg-white px-5 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-10 max-w-2xl">
            <p className="text-sm font-semibold text-[#2563EB]">Real-world deployments</p>
            <h2 className="mt-3 text-3xl font-semibold text-[#111827] sm:text-[40px]">
              Screens that look at home in your business.
            </h2>
            <p className="mt-4 text-lg leading-8 text-[#4B5563]">
              Menu boards, retail promotions, lobby displays, and waiting room screens all run from the same simple workflow.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {deployments.map((deployment) => (
              <article key={deployment.title} className="overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-[#F7F8FA] shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
                <div className="vh-deployment-photo">
                  <div className="vh-display-frame">
                    <img src={deployment.image} alt="" />
                  </div>
                </div>
                <div className="p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#2563EB]">
                    <deployment.icon size={16} />
                    {deployment.title}
                  </div>
                  <p className="text-base font-semibold text-[#111827]">{deployment.location}</p>
                  <p className="mt-2 text-sm text-[#4B5563]">{deployment.status}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto grid max-w-[1280px] gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <SchedulingPreview />
          <div>
            <p className="text-sm font-semibold text-[#2563EB]">Product simplicity</p>
            <h2 className="mt-3 text-3xl font-semibold text-[#111827] sm:text-[40px]">
              Schedule once. Runs everywhere.
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#4B5563]">
              Build the week once, assign it to the right screens, and let each location stay current without manual back-and-forth.
            </p>
            <ul className="mt-7 space-y-4">
              {[
                'Drag-and-drop scheduling',
                'Centralized content management',
                'Real-time updates',
                'Multi-location support',
                'Offline playback reliability',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-base font-medium text-[#111827]">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#DCFCE7] text-[#16A34A]">
                    <Check size={15} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-white px-5 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto max-w-[980px] text-center">
          <p className="text-sm font-semibold text-[#2563EB]">Pricing</p>
          <h2 className="mt-3 text-3xl font-semibold text-[#111827] sm:text-[40px]">
            Simple pricing. No enterprise sales process.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-[#4B5563]">
            Start small, add screens as you grow, and keep your monthly signage bill predictable.
          </p>

          <div className="mx-auto mt-10 max-w-[520px] rounded-[20px] border border-[#D1D5DB] bg-[#F7F8FA] p-6 text-left shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
              <div>
                <p className="text-sm font-semibold text-[#2563EB]">Professional</p>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-5xl font-bold text-[#111827]">$6/screen</span>
                  <span className="pb-2 text-sm text-[#4B5563]">per month</span>
                </div>
              </div>
              <div className="rounded-[12px] bg-white px-3 py-2 text-sm font-semibold text-[#111827] shadow-sm">
                Monthly billing
              </div>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {['No contracts', 'Cancel anytime', 'All core workflows', 'Unlimited users'].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-[#4B5563]">
                  <Check size={16} className="text-[#16A34A]" />
                  {item}
                </div>
              ))}
            </div>
            <Link href="/register" className="vh-primary-button mt-7 w-full justify-center py-3">
              Start Free <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      <section id="resources" className="px-5 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto max-w-[980px] rounded-[20px] bg-[#111827] px-6 py-12 text-center text-white shadow-[0_10px_30px_rgba(0,0,0,0.06)] sm:px-10">
          <BarChart3 className="mx-auto mb-5 text-[#93C5FD]" size={34} />
          <h2 className="text-3xl font-semibold sm:text-[40px]">Run every screen from one place.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-[#D1D5DB]">
            Give your team a signage system that feels clear on day one and dependable at every location.
          </p>
          <Link href="/register" className="mt-8 inline-flex items-center justify-center gap-2 rounded-[12px] bg-white px-6 py-3 text-sm font-semibold text-[#111827] transition-transform hover:-translate-y-0.5">
            Start Free <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-[#E5E7EB] bg-white px-5 py-8 sm:px-6">
        <div className="mx-auto flex max-w-[1280px] flex-col justify-between gap-4 text-sm text-[#6B7280] md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#111827] text-white">
              <Monitor size={16} />
            </span>
            <span className="font-semibold text-[#111827]">Vizora</span>
          </div>
          <div className="flex flex-wrap gap-5">
            <Link href="/privacy" className="hover:text-[#111827]">Privacy</Link>
            <Link href="/terms" className="hover:text-[#111827]">Terms</Link>
            <Link href="/sla" className="hover:text-[#111827]">SLA</Link>
            <a href="mailto:support@vizora.cloud" className="hover:text-[#111827]">Support</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
