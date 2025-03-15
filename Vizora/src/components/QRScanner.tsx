import React, { useState } from 'react';
import { Box, TextField, Button, Typography, Paper, Alert } from '@mui/material';
import { getPairingService } from '../services/pairingService';

interface QRScannerProps {
  onPairingComplete: (displayId: string) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onPairingComplete }) => {
  const [pairingCode, setPairingCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const pairingService = getPairingService();
      const displayId = await pairingService.pairWithDisplay(pairingCode);
      onPairingComplete(displayId);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to pair with display');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', p: 3 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Enter Pairing Code
        </Typography>
        
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Pairing Code"
            value={pairingCode}
            onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
            margin="normal"
            variant="outlined"
            disabled={isLoading}
            placeholder="Enter the code shown on your display"
          />
          
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            sx={{ mt: 2 }}
            disabled={isLoading || !pairingCode}
          >
            {isLoading ? 'Connecting...' : 'Pair Display'}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}; 