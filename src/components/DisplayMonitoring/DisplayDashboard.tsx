import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Badge } from '../ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Progress } from '../ui/Progress';
import { Alert, AlertTitle, AlertDescription } from '../ui/Alert';
import { Icon } from '../ui/Icon';
import { WebSocketService } from '../../services/websocket';
import type { DisplayStatus, DisplayMetrics } from '../../types/display';

interface DisplayDashboardProps {
  displayId: string;
}

const DisplayDashboard: React.FC<DisplayDashboardProps> = ({ displayId }) => {
  const { displayId: routeDisplayId } = useParams();
  const id = routeDisplayId || displayId;
  const [status, setStatus] = useState<DisplayStatus | null>(null);
  const [metrics, setMetrics] = useState<DisplayMetrics | null>(null);
  const [wsService] = useState(() => new WebSocketService());

  // Fetch initial display data
  const { data: displayData, isLoading } = useQuery({
    queryKey: ['display', id],
    queryFn: async () => {
      const response = await fetch(`/api/displays/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch display data');
      }
      return response.json();
    },
    refetchInterval: 30000 // Poll every 30 seconds as fallback
  });

  useEffect(() => {
    // Connect to WebSocket
    wsService.connect();

    // Subscribe to display status and metrics
    wsService.subscribeToStatus(id, (newStatus) => {
      setStatus(newStatus);
    });

    wsService.subscribeToMetrics(id, (newMetrics) => {
      setMetrics(newMetrics);
    });

    // Cleanup on unmount
    return () => {
      wsService.disconnect();
    };
  }, [id, wsService]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const currentStatus = status || displayData?.status;
  const currentMetrics = metrics || displayData?.metrics;

  return (
    <div className="space-y-6">
      {/* Display Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{displayData?.name || 'Display'}</h1>
          <p className="text-muted-foreground">{id}</p>
        </div>
        <Badge variant={currentStatus?.online ? 'success' : 'error'}>
          {currentStatus?.online ? 'Online' : 'Offline'}
        </Badge>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Seen</span>
              <span className="text-sm">
                {currentStatus?.lastSeen
                  ? format(new Date(currentStatus.lastSeen), 'PPpp')
                  : 'Never'}
              </span>
            </div>
            {currentStatus?.currentContent && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current Content</span>
                <span className="text-sm">{currentStatus.currentContent}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Metrics Card */}
      {currentMetrics && (
        <Card>
          <CardHeader>
            <CardTitle>System Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">CPU Usage</span>
                  <span className="text-sm">{currentMetrics.cpu.usage}%</span>
                </div>
                <Progress value={currentMetrics.cpu.usage} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Memory Usage</span>
                  <span className="text-sm">{currentMetrics.memory.usage}%</span>
                </div>
                <Progress value={currentMetrics.memory.usage} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Storage Usage</span>
                  <span className="text-sm">{currentMetrics.storage.usage}%</span>
                </div>
                <Progress value={currentMetrics.storage.usage} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diagnostics */}
      {currentStatus?.diagnostic && (
        <Card>
          <CardHeader>
            <CardTitle>Diagnostics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {currentStatus.diagnostic.errors?.map((error, index) => (
                <Alert key={index} variant="destructive">
                  <Icon name="error" className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ))}
              {currentStatus.diagnostic.warnings?.map((warning, index) => (
                <Alert key={index} variant="warning">
                  <Icon name="warning" className="h-4 w-4" />
                  <AlertTitle>Warning</AlertTitle>
                  <AlertDescription>{warning}</AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DisplayDashboard; 