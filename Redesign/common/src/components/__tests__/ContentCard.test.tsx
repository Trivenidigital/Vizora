import { render, screen, fireEvent } from '@testing-library/react';
import { ContentCard } from '../ContentCard';

describe('ContentCard', () => {
  const defaultProps = {
    id: 'test-123',
    title: 'Test Content',
    type: 'image' as const,
    thumbnail: 'https://example.com/thumbnail.jpg',
    description: 'This is a test description',
  };

  it('renders content card with all required information', () => {
    render(<ContentCard {...defaultProps} />);

    expect(screen.getByText('Test Content')).toBeInTheDocument();
    expect(screen.getByText('image')).toBeInTheDocument();
    expect(screen.getByText('This is a test description')).toBeInTheDocument();
  });

  it('handles click correctly', () => {
    const onClick = jest.fn();
    render(<ContentCard {...defaultProps} onClick={onClick} />);

    const card = screen.getByText('Test Content').closest('.content-card');
    if (card) fireEvent.click(card);

    expect(onClick).toHaveBeenCalledWith('test-123');
  });

  it('truncates long descriptions', () => {
    const longDescription = 'A'.repeat(150);
    render(<ContentCard {...defaultProps} description={longDescription} />);
    
    expect(screen.getByText('A'.repeat(100) + '...')).toBeInTheDocument();
  });

  it('displays content type icon correctly when thumbnail is missing', () => {
    render(<ContentCard {...defaultProps} thumbnail={undefined} />);
    
    const iconContainer = document.querySelector('.content-type-icon-container');
    expect(iconContainer).toBeInTheDocument();
  });
}); 