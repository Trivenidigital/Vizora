import { render, screen } from '@testing-library/react';
import HomePage from '../page';

jest.mock('next/link', () => {
  return function MockLink({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  };
});

describe('HomePage', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockRejectedValue(new Error('geo-pricing unavailable'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('presents the operational SMB homepage positioning', () => {
    render(<HomePage />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Digital signage your team can actually run.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Schedule once. Runs everywhere.')).toBeInTheDocument();
    expect(screen.getByText('Simple pricing. No enterprise sales process.')).toBeInTheDocument();
    expect(screen.getAllByText('$6/screen')).toHaveLength(2);
    expect(screen.getByText('Urban Eats')).toBeInTheDocument();
  });

  it('removes old AI-first and neon command-center messaging', () => {
    render(<HomePage />);

    expect(screen.queryByText(/AI-powered/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/command center/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Intelligence Engine/i)).not.toBeInTheDocument();
  });
});
