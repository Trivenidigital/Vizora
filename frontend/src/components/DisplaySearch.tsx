import React from 'react';
import {
  Box,
  TextField,
  Autocomplete,
  Chip,
  InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import { DisplayType, DisplayStatus } from '../types/display';

interface DisplaySearchProps {
  searchQuery: string;
  selectedTypes: DisplayType[];
  selectedStatuses: DisplayStatus[];
  onSearchChange: (query: string) => void;
  onTypesChange: (types: DisplayType[]) => void;
  onStatusesChange: (statuses: DisplayStatus[]) => void;
}

const DISPLAY_TYPES: DisplayType[] = ['LED', 'LCD', 'Projector'];
const DISPLAY_STATUSES: DisplayStatus[] = ['online', 'offline', 'maintenance'];

export const DisplaySearch: React.FC<DisplaySearchProps> = ({
  searchQuery,
  selectedTypes,
  selectedStatuses,
  onSearchChange,
  onTypesChange,
  onStatusesChange,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        width: '100%',
      }}
    >
      {/* Search Input */}
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
        }}
        data-testid="display-search-input"
      />

      {/* Type Filter */}
      <Autocomplete
        multiple
        options={DISPLAY_TYPES}
        value={selectedTypes}
        onChange={(_, newValue) => onTypesChange(newValue)}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Filter by type"
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <>
                  <InputAdornment position="start">
                    <FilterListIcon />
                  </InputAdornment>
                  {params.InputProps.startAdornment}
                </>
              ),
            }}
          />
        )}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              {...getTagProps({ index })}
              key={option}
              label={option}
              data-testid={`type-chip-${option.toLowerCase()}`}
            />
          ))
        }
      />

      {/* Status Filter */}
      <Autocomplete
        multiple
        options={DISPLAY_STATUSES}
        value={selectedStatuses}
        onChange={(_, newValue) => onStatusesChange(newValue)}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Filter by status"
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <>
                  <InputAdornment position="start">
                    <FilterListIcon />
                  </InputAdornment>
                  {params.InputProps.startAdornment}
                </>
              ),
            }}
          />
        )}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              {...getTagProps({ index })}
              key={option}
              label={option}
              data-testid={`status-chip-${option.toLowerCase()}`}
            />
          ))
        }
      />
    </Box>
  );
}; 