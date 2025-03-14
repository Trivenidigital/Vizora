import React from 'react';
import {
  TextField,
  InputAdornment,
  IconButton,
  Box,
  Autocomplete,
  Chip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { DisplayType, DisplayStatus } from '../types/display';

interface DisplaySearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTypes: DisplayType[];
  onTypesChange: (types: DisplayType[]) => void;
  selectedStatuses: DisplayStatus[];
  onStatusesChange: (statuses: DisplayStatus[]) => void;
}

const displayTypes: DisplayType[] = ['LED', 'LCD', 'Projector', 'Digital Signage'];
const displayStatuses: DisplayStatus[] = ['online', 'offline', 'maintenance'];

export const DisplaySearch: React.FC<DisplaySearchProps> = ({
  searchQuery,
  onSearchChange,
  selectedTypes,
  onTypesChange,
  selectedStatuses,
  onStatusesChange,
}) => {
  const handleClearSearch = () => {
    onSearchChange('');
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
      <TextField
        fullWidth
        placeholder="Search displays..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
          endAdornment: searchQuery && (
            <InputAdornment position="end">
              <IconButton size="small" onClick={handleClearSearch}>
                <ClearIcon />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      <Autocomplete
        multiple
        options={displayTypes}
        value={selectedTypes}
        onChange={(_, newValue) => onTypesChange(newValue)}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Filter by type"
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position="start">
                  <FilterIcon />
                </InputAdornment>
              ),
            }}
          />
        )}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              label={option}
              {...getTagProps({ index })}
              size="small"
              sx={{ m: 0.5 }}
              data-testid="type-chip"
            />
          ))
        }
        sx={{ minWidth: 200 }}
      />

      <Autocomplete
        multiple
        options={displayStatuses}
        value={selectedStatuses}
        onChange={(_, newValue) => onStatusesChange(newValue)}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Filter by status"
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position="start">
                  <FilterIcon />
                </InputAdornment>
              ),
            }}
          />
        )}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              label={option}
              {...getTagProps({ index })}
              size="small"
              sx={{ m: 0.5 }}
              data-testid="status-chip"
            />
          ))
        }
        sx={{ minWidth: 200 }}
      />
    </Box>
  );
}; 