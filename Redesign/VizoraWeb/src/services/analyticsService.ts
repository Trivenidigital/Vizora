import { apiService } from './apiService';

interface AnalyticsTimeRange {
  startTime: string;
  endTime: string;
  interval: 'hour' | 'day' | 'week' | 'month' | 'year';
}

interface DisplayAnalytics {
  totalDisplays: number;
  onlineDisplays: number;
  offlineDisplays: number;
  maintenanceDisplays: number;
  uptime: {
    average: number;
    byDisplay: {
      displayId: string;
      uptime: number;
    }[];
  };
  performance: {
    averageCpu: number;
    averageMemory: number;
    averageStorage: number;
    byDisplay: {
      displayId: string;
      cpu: number;
      memory: number;
      storage: number;
    }[];
  };
  network: {
    averageLatency: number;
    averageBandwidth: number;
    byDisplay: {
      displayId: string;
      latency: number;
      bandwidth: number;
    }[];
  };
}

interface ContentAnalytics {
  totalContent: number;
  byType: {
    type: string;
    count: number;
  }[];
  views: {
    total: number;
    byContent: {
      contentId: string;
      views: number;
    }[];
    byType: {
      type: string;
      views: number;
    }[];
  };
  engagement: {
    averageDuration: number;
    completionRate: number;
    byContent: {
      contentId: string;
      averageDuration: number;
      completionRate: number;
    }[];
  };
  schedule: {
    totalScheduled: number;
    activeSchedules: number;
    byDisplay: {
      displayId: string;
      scheduled: number;
      active: number;
    }[];
  };
}

interface UserAnalytics {
  totalUsers: number;
  activeUsers: number;
  byRole: {
    role: string;
    count: number;
  }[];
  activity: {
    totalSessions: number;
    averageSessionDuration: number;
    byUser: {
      userId: string;
      sessions: number;
      averageDuration: number;
    }[];
  };
  actions: {
    total: number;
    byType: {
      type: string;
      count: number;
    }[];
    byUser: {
      userId: string;
      actions: number;
    }[];
  };
}

interface SystemAnalytics {
  performance: {
    cpu: number;
    memory: number;
    storage: number;
    network: {
      latency: number;
      bandwidth: number;
    };
  };
  errors: {
    total: number;
    byType: {
      type: string;
      count: number;
    }[];
    recent: {
      id: string;
      type: string;
      message: string;
      timestamp: string;
    }[];
  };
  updates: {
    total: number;
    successful: number;
    failed: number;
    byType: {
      type: string;
      count: number;
    }[];
  };
  backups: {
    total: number;
    successful: number;
    failed: number;
    lastBackup: string;
    size: number;
  };
}

class AnalyticsService {
  async getDisplayAnalytics(timeRange: AnalyticsTimeRange): Promise<DisplayAnalytics> {
    try {
      const response = await apiService.get<{ analytics: DisplayAnalytics }>('/analytics/displays', {
        params: timeRange,
      });
      return response.analytics;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getContentAnalytics(timeRange: AnalyticsTimeRange): Promise<ContentAnalytics> {
    try {
      const response = await apiService.get<{ analytics: ContentAnalytics }>('/analytics/content', {
        params: timeRange,
      });
      return response.analytics;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getUserAnalytics(timeRange: AnalyticsTimeRange): Promise<UserAnalytics> {
    try {
      const response = await apiService.get<{ analytics: UserAnalytics }>('/analytics/users', {
        params: timeRange,
      });
      return response.analytics;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getSystemAnalytics(timeRange: AnalyticsTimeRange): Promise<SystemAnalytics> {
    try {
      const response = await apiService.get<{ analytics: SystemAnalytics }>('/analytics/system', {
        params: timeRange,
      });
      return response.analytics;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async exportAnalytics(timeRange: AnalyticsTimeRange): Promise<{
    displays: DisplayAnalytics;
    content: ContentAnalytics;
    users: UserAnalytics;
    system: SystemAnalytics;
  }> {
    try {
      const response = await apiService.get<{
        displays: DisplayAnalytics;
        content: ContentAnalytics;
        users: UserAnalytics;
        system: SystemAnalytics;
      }>('/analytics/export', {
        params: timeRange,
      });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error('An unexpected error occurred');
  }
}

export const analyticsService = new AnalyticsService(); 