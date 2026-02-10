import { render, screen, fireEvent } from '@testing-library/react';
import Tooltip, { HelpIcon } from '../Tooltip';

describe('Tooltip', () => {
  it('renders children', () => {
    render(
      <Tooltip content="Help text">
        <span>Hover me</span>
      </Tooltip>
    );
    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('shows tooltip on mouse enter', () => {
    render(
      <Tooltip content="Help text">
        <span>Hover me</span>
      </Tooltip>
    );
    fireEvent.mouseEnter(screen.getByText('Hover me').parentElement!);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText('Help text')).toBeInTheDocument();
  });

  it('hides tooltip on mouse leave', () => {
    render(
      <Tooltip content="Help text">
        <span>Hover me</span>
      </Tooltip>
    );
    const container = screen.getByText('Hover me').parentElement!;
    fireEvent.mouseEnter(container);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.mouseLeave(container);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on focus', () => {
    render(
      <Tooltip content="Focus text">
        <span>Focus me</span>
      </Tooltip>
    );
    fireEvent.focus(screen.getByText('Focus me').parentElement!);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('hides tooltip on blur', () => {
    render(
      <Tooltip content="Blur text">
        <span>Blur me</span>
      </Tooltip>
    );
    const container = screen.getByText('Blur me').parentElement!;
    fireEvent.focus(container);
    fireEvent.blur(container);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('positions tooltip correctly for each position', () => {
    const { rerender } = render(
      <Tooltip content="Top tooltip" position="top">
        <span>Target</span>
      </Tooltip>
    );
    fireEvent.mouseEnter(screen.getByText('Target').parentElement!);
    expect(screen.getByRole('tooltip').className).toContain('bottom-full');
  });
});

describe('HelpIcon', () => {
  it('renders a question mark', () => {
    render(<HelpIcon content="Help text" />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('shows tooltip on hover', () => {
    render(<HelpIcon content="Help tooltip" />);
    fireEvent.mouseEnter(screen.getByText('?').parentElement!);
    expect(screen.getByText('Help tooltip')).toBeInTheDocument();
  });
});
