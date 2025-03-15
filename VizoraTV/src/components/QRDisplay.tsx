import React, { useEffect, useState, useCallback } from 'react';
import { Box, Typography, CircularProgress, Paper, Collapse, IconButton, Alert, LinearProgress, Snackbar, Tooltip, Zoom, Fade, Slide } from '@mui/material';
import { ExpandMore, ExpandLess, Refresh, Warning, CheckCircle, Error, Info } from '@mui/icons-material';
import QRCode from 'qrcode.react';
import { getPairingService, PairingState } from '../services/pairingService';
import { styled } from '@mui/material/styles';

const MetricsContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginTop: theme.spacing(2),
  backgroundColor: theme.palette.background.default
}));

const MetricsRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(1)
}));

const StatusIndicator = styled(Box)<{ status: 'good' | 'warning' | 'poor' }>(({ theme, status }) => ({
  width: 12,
  height: 12,
  borderRadius: '50%',
  backgroundColor: status === 'good' ? theme.palette.success.main :
                  status === 'warning' ? theme.palette.warning.main :
                  theme.palette.error.main,
  marginRight: theme.spacing(1)
}));

const AnimatedBox = styled(Box)(({ theme }) => ({
  transition: theme.transitions.create(['opacity', 'transform'], {
    duration: theme.transitions.duration.standard,
  }),
}));

const PulsingDot = styled(Box)<{ status: string }>(({ theme, status }) => ({
  width: 12,
  height: 12,
  borderRadius: '50%',
  backgroundColor: theme.palette[status === 'connected' ? 'success' : 
                                status === 'connecting' ? 'warning' : 
                                'error'].main,
  animation: status === 'connecting' ? 'pulse 1.5s ease-in-out infinite' : 'none',
  '@keyframes pulse': {
    '0%': {
      transform: 'scale(0.95)',
      boxShadow: '0 0 0 0 rgba(255, 177, 66, 0.7)',
    },
    '70%': {
      transform: 'scale(1)',
      boxShadow: '0 0 0 10px rgba(255, 177, 66, 0)',
    },
    '100%': {
      transform: 'scale(0.95)',
      boxShadow: '0 0 0 0 rgba(255, 177, 66, 0)',
    },
  },
}));

export const QRDisplay: React.FC = () => {
  const [pairingState, setPairingState] = useState<PairingState | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [performanceStatus, setPerformanceStatus] = useState<any>(null);
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', severity: 'success' });
  const [showTooltip, setShowTooltip] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const pairingService = getPairingService();
    setPairingState(pairingService.getCurrentPairingState());
    setMetrics(pairingService.getMetrics());
    setPerformanceStatus(pairingService.getPerformanceStatus());

    const updateInterval = setInterval(() => {
      const newState = pairingService.getCurrentPairingState();
      const newMetrics = pairingService.getMetrics();
      const newStatus = pairingService.getPerformanceStatus();

      setPairingState(newState);
      setMetrics(newMetrics);
      setPerformanceStatus(newStatus);
      setLastUpdate(new Date());

      // Performance notifications
      if (newStatus.status === 'warning' && performanceStatus?.status === 'good') {
        setNotification({
          open: true,
          message: 'Connection performance is degrading',
          severity: 'warning'
        });
      } else if (newStatus.status === 'poor' && performanceStatus?.status !== 'poor') {
        setNotification({
          open: true,
          message: 'Connection performance is poor',
          severity: 'error'
        });
      }

      // Check for significant ping spikes
      if (newMetrics?.performance && 
          newMetrics.performance.lastPingTime > 0 && 
          newMetrics.performance.averagePingTime > 0 &&
          newMetrics.performance.lastPingTime > newMetrics.performance.averagePingTime * 2) {
        setNotification({
          open: true,
          message: 'High latency detected',
          severity: 'warning'
        });
      }

      // Show tooltip periodically
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 3000);
    }, 1000);

    return () => clearInterval(updateInterval);
  }, [performanceStatus?.status]);

  const handleRetry = () => {
    const pairingService = getPairingService();
    pairingService.resetPairing();
    setNotification({
      open: true,
      message: 'Reconnecting...',
      severity: 'info'
    });
  };

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  if (!pairingState) {
    return <CircularProgress />;
  }

  const getConnectionStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'success.main';
      case 'connecting': return 'warning.main';
      case 'error': return 'error.main';
      default: return 'text.secondary';
    }
  };

  const formatTime = (ms: number) => {
    return `${Math.round(ms)}ms`;
  };

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', p: 3 }}>
      <Fade in={true}>
        <Paper elevation={3} sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            Pair Your Device
          </Typography>

          {pairingState.connectionStatus === 'error' && (
            <Alert 
              severity="error" 
              action={
                <Tooltip title="Try reconnecting">
                  <IconButton color="inherit" size="small" onClick={handleRetry}>
                    <Refresh />
                  </IconButton>
                </Tooltip>
              }
              sx={{ mb: 2 }}
            >
              {pairingState.errorMessage || 'Connection error'}
            </Alert>
          )}

          <AnimatedBox sx={{ position: 'relative', mb: 2 }}>
            <Tooltip
              open={showTooltip && pairingState.connectionStatus === 'connected'}
              title="QR Code ready to scan"
              placement="top"
              TransitionComponent={Zoom}
            >
              <Box>
                <QRCode
                  value={pairingState.pairingCode}
                  size={256}
                  level="H"
                  includeMargin
                  style={{
                    opacity: pairingState.connectionStatus === 'connected' ? 1 : 0.5,
                    transition: 'opacity 0.3s ease-in-out',
                    transform: pairingState.connectionStatus === 'connected' ? 'scale(1)' : 'scale(0.95)',
                  }}
                />
              </Box>
            </Tooltip>
            {pairingState.connectionStatus === 'connecting' && (
              <CircularProgress
                size={40}
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  marginTop: '-20px',
                  marginLeft: '-20px'
                }}
              />
            )}
          </AnimatedBox>

          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Connection Status
            </Typography>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: 1 
            }}>
              <PulsingDot status={pairingState.connectionStatus} />
              <Typography
                variant="body1"
                color={getConnectionStatusColor(pairingState.connectionStatus)}
                sx={{ fontWeight: 'medium' }}
              >
                {pairingState.connectionStatus.charAt(0).toUpperCase() + pairingState.connectionStatus.slice(1)}
              </Typography>
              <Tooltip title={`Last updated ${getTimeAgo(lastUpdate)}`}>
                <Info fontSize="small" color="action" />
              </Tooltip>
            </Box>
          </Box>

          <Box sx={{ mt: 2 }}>
            <Tooltip title={showDetails ? "Hide details" : "Show details"}>
              <IconButton onClick={() => setShowDetails(!showDetails)}>
                {showDetails ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Tooltip>
          </Box>

          <Collapse in={showDetails}>
            <MetricsContainer>
              <Typography variant="subtitle2" gutterBottom>
                Connection Metrics
              </Typography>
              <MetricsRow>
                <Typography variant="body2">Connection Attempts:</Typography>
                <Typography variant="body2">{metrics?.connection.attempts || 0}</Typography>
              </MetricsRow>
              <MetricsRow>
                <Typography variant="body2">Successful Connections:</Typography>
                <Typography variant="body2">{metrics?.connection.successfulConnections || 0}</Typography>
              </MetricsRow>
              <MetricsRow>
                <Typography variant="body2">Average Connect Time:</Typography>
                <Typography variant="body2">{formatTime(metrics?.connection.averageConnectTime || 0)}</Typography>
              </MetricsRow>

              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                Performance Metrics
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <StatusIndicator status={performanceStatus.status} />
                <Typography variant="body2">{performanceStatus.details}</Typography>
              </Box>
              <MetricsRow>
                <Typography variant="body2">Current Ping:</Typography>
                <Typography variant="body2">{formatTime(metrics?.performance.lastPingTime || 0)}</Typography>
              </MetricsRow>
              <MetricsRow>
                <Typography variant="body2">Average Ping:</Typography>
                <Typography variant="body2">{formatTime(metrics?.performance.averagePingTime || 0)}</Typography>
              </MetricsRow>
              <Box sx={{ mt: 1 }}>
                <Tooltip title={`${Math.min(100, (metrics?.performance.averagePingTime || 0) / 3)}% of maximum acceptable latency`}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, (metrics?.performance.averagePingTime || 0) / 3)}
                    color={performanceStatus.status === 'good' ? 'success' :
                          performanceStatus.status === 'warning' ? 'warning' : 'error'}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Tooltip>
              </Box>

              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                Pairing Metrics
              </Typography>
              <MetricsRow>
                <Typography variant="body2">Total Attempts:</Typography>
                <Typography variant="body2">{metrics?.pairing.totalPairingAttempts || 0}</Typography>
              </MetricsRow>
              <MetricsRow>
                <Typography variant="body2">Successful Pairings:</Typography>
                <Typography variant="body2">{metrics?.pairing.successfulPairings || 0}</Typography>
              </MetricsRow>
              <MetricsRow>
                <Typography variant="body2">Average Pairing Time:</Typography>
                <Typography variant="body2">{formatTime(metrics?.pairing.averagePairingTime || 0)}</Typography>
              </MetricsRow>
            </MetricsContainer>
          </Collapse>

          <Snackbar
            open={notification.open}
            autoHideDuration={6000}
            onClose={handleCloseNotification}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            TransitionComponent={Slide}
          >
            <Alert 
              onClose={handleCloseNotification} 
              severity={notification.severity}
              sx={{ width: '100%' }}
              variant="filled"
            >
              {notification.message}
            </Alert>
          </Snackbar>
        </Paper>
      </Fade>
    </Box>
  );
};
 