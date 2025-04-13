import React, { useState } from 'react';
import { Search, Filter, Tag } from 'lucide-react';

// Filter bar props definition
interface ContentFilterBarProps {
  onFilterChange: (filter: string) => void;
  initialFilter?: string;
}

/**
 * Content Filter Bar Component
 * Provides search and filtering functionality for content lists
 */
const ContentFilterBar: React.FC<ContentFilterBarProps> = ({ 
  onFilterChange, 
  initialFilter = '' 
}) => {
  const [filter, setFilter] = useState(initialFilter);
  
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFilter = e.target.value;
    setFilter(newFilter);
    onFilterChange(newFilter);
  };
  
  const handleClear = () => {
    setFilter('');
    onFilterChange('');
  };
  
  return (
    <div className="content-filter-bar">
      <div className="search-container">
        <Search size={18} />
        <input
          type="text"
          placeholder="Search content..."
          value={filter}
          onChange={handleFilterChange}
          className="search-input"
        />
        {filter && (
          <button onClick={handleClear} className="clear-button">
            Clear
          </button>
        )}
      </div>
      
      <div className="filter-options">
        <button className="filter-button">
          <Filter size={16} />
          <span>Filters</span>
        </button>
        
        <div className="tag-selector">
          <Tag size={16} />
          <select>
            <option value="">All Tags</option>
            <option value="important">Important</option>
            <option value="promotional">Promotional</option>
            <option value="informational">Informational</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default ContentFilterBar; 