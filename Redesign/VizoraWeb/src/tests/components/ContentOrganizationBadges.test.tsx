import React from 'react';
import { render, screen } from '@testing-library/react';
import { ContentOrganizationBadges } from '../../components/ui/ContentOrganizationBadges';

describe('ContentOrganizationBadges', () => {
  it('renders folder badge when folder is provided', () => {
    render(<ContentOrganizationBadges folder="Folder 1" />);
    const folderBadge = screen.getByText('Folder 1');
    expect(folderBadge).toBeInTheDocument();
    expect(folderBadge).toHaveClass('folder-badge');
  });

  it('renders tag badges when tags are provided', () => {
    const tags = [
      { id: '1', name: 'Tag 1', color: '#FF0000' },
      { id: '2', name: 'Tag 2', color: '#00FF00' }
    ];
    render(<ContentOrganizationBadges tags={tags} />);
    
    const tag1Badge = screen.getByText('Tag 1');
    const tag2Badge = screen.getByText('Tag 2');
    
    expect(tag1Badge).toBeInTheDocument();
    expect(tag2Badge).toBeInTheDocument();
    expect(tag1Badge).toHaveStyle({ backgroundColor: '#FF0000' });
    expect(tag2Badge).toHaveStyle({ backgroundColor: '#00FF00' });
  });

  it('renders nothing when neither folder nor tags are provided', () => {
    const { container } = render(<ContentOrganizationBadges />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders folder badge with correct styling', () => {
    render(<ContentOrganizationBadges folder="Folder 1" />);
    const folderBadge = screen.getByText('Folder 1');
    
    expect(folderBadge).toHaveClass('folder-badge');
    expect(folderBadge).toHaveStyle({
      backgroundColor: '#f3f4f6',
      color: '#374151'
    });
  });

  it('renders tag badges with correct styling', () => {
    const tags = [
      { id: '1', name: 'Tag 1', color: '#FF0000' },
      { id: '2', name: 'Tag 2', color: '#00FF00' }
    ];
    render(<ContentOrganizationBadges tags={tags} />);
    
    const tag1Badge = screen.getByText('Tag 1');
    const tag2Badge = screen.getByText('Tag 2');
    
    expect(tag1Badge).toHaveStyle({
      backgroundColor: '#FF0000',
      color: '#ffffff'
    });
    expect(tag2Badge).toHaveStyle({
      backgroundColor: '#00FF00',
      color: '#ffffff'
    });
  });
}); 