import React, { useState } from 'react';
import { testConnectivity, logConnectivityResults } from '../../utils/connectivityTest';
import {
  Box,
  Button,
  Paper,
  Typography,
  Divider,
  CircularProgress,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  NetworkCheck as NetworkIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

const ConnectivityTest: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const runTest = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const testResults = await testConnectivity();
      setResults(testResults);
      
      // Log to console for debugging
      logConnectivityResults(testResults);
    } catch (err: any) {
      setError(`Failed to run connectivity test: ${err.message || String(err)}`);
      console.error('Connectivity test error:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Paper
      elevation={3}
      sx={{
        p: 3,
        mb: 3,
        maxWidth: 800,
        mx: 'auto',
        borderRadius: 2,
      }}
    >
      <Box display="flex" alignItems="center" mb={2}>
        <NetworkIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h5" component="h2">
          Connectivity Test
        </Typography>
      </Box>
      
      <Typography variant="body2" color="text.secondary" mb={3}>
        Test HTTP and WebSocket connectivity to the middleware server
      </Typography>
      
      <Button
        variant="contained"
        color="primary"
        onClick={runTest}
        disabled={isLoading}
        startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <NetworkIcon />}
        sx={{ mb: 3 }}
      >
        {isLoading ? 'Testing Connectivity...' : 'Run Connectivity Test'}
      </Button>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {results && (
        <Box>
          <Divider sx={{ mb: 3 }} />
          
          <Typography variant="h6" gutterBottom>
            Test Results
          </Typography>
          
          {/* HTTP Test Results */}
          <Paper variant="outlined" sx={{ mb: 2, p: 2 }}>
            <Box display="flex" alignItems="center" mb={1}>
              <Typography variant="subtitle1" fontWeight="bold">
                HTTP Connectivity:
              </Typography>
              <Chip
                icon={results.http.success ? <SuccessIcon /> : <ErrorIcon />}
                label={results.http.success ? 'Success' : 'Failed'}
                color={results.http.success ? 'success' : 'error'}
                size="small"
                sx={{ ml: 2 }}
              />
            </Box>
            
            <Typography variant="body2" color="text.secondary" mb={1}>
              {results.http.message}
            </Typography>
            
            {results.http.error && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {results.http.error}
              </Alert>
            )}
            
            {results.http.details && (
              <Accordion sx={{ mt: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2">Connection Details</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <pre style={{ 
                    fontSize: '0.8rem',
                    overflow: 'auto', 
                    maxHeight: '200px',
                    backgroundColor: '#f5f5f5',
                    padding: '8px',
                    borderRadius: '4px'
                  }}>
                    {JSON.stringify(results.http.details, null, 2)}
                  </pre>
                </AccordionDetails>
              </Accordion>
            )}
          </Paper>
          
          {/* WebSocket Test Results */}
          <Paper variant="outlined" sx={{ mb: 2, p: 2 }}>
            <Box display="flex" alignItems="center" mb={1}>
              <Typography variant="subtitle1" fontWeight="bold">
                WebSocket Connectivity:
              </Typography>
              <Chip
                icon={results.websocket.success ? <SuccessIcon /> : <ErrorIcon />}
                label={results.websocket.success ? 'Success' : 'Failed'}
                color={results.websocket.success ? 'success' : 'error'}
                size="small"
                sx={{ ml: 2 }}
              />
            </Box>
            
            <Typography variant="body2" color="text.secondary" mb={1}>
              {results.websocket.message}
            </Typography>
            
            {results.websocket.error && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {results.websocket.error}
              </Alert>
            )}
            
            {results.websocket.details && (
              <List dense>
                {Object.entries(results.websocket.details).map(([key, value]) => (
                  <ListItem key={key}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <InfoIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${key}: ${value}`}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
          
          <Alert severity="info" sx={{ mt: 3 }}>
            Check the browser console for more detailed results.
          </Alert>
        </Box>
      )}
    </Paper>
  );
};

export default ConnectivityTest; 