/**
 * System Controller
 * Handles system status, health checks, metrics, and management functions
 */

const os = require('os');
const { version } = require('../../package.json');
const { ApiError } = require('../middleware/errorMiddleware');
const Display = require('../models/Display');
const Content = require('../models/Content');
const User = require('../models/User');

/**
 * @desc    Get system status
 * @route   GET /api/system/status
 * @access  Private/Admin
 */
const getSystemStatus = async (req, res, next) => {
  try {
    const uptime = process.uptime();
    const uptimeFormatted = formatUptime(uptime);
    
    // Memory usage
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    
    // System info
    const systemInfo = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cpus: os.cpus().length,
      hostname: os.hostname()
    };
    
    res.status(200).json({
      success: true,
      version,
      uptime: uptimeFormatted,
      startedAt: new Date(Date.now() - uptime * 1000).toISOString(),
      memory: {
        total: formatBytes(totalMemory),
        free: formatBytes(freeMemory),
        used: formatBytes(totalMemory - freeMemory),
        rss: formatBytes(memoryUsage.rss),
        heapTotal: formatBytes(memoryUsage.heapTotal),
        heapUsed: formatBytes(memoryUsage.heapUsed),
        external: formatBytes(memoryUsage.external)
      },
      system: systemInfo,
      env: process.env.NODE_ENV
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get system health
 * @route   GET /api/system/health
 * @access  Public
 */
const getSystemHealth = async (req, res, next) => {
  try {
    // Simple health check - just return 200 OK
    res.status(200).json({
      success: true,
      status: 'up',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get system metrics
 * @route   GET /api/system/metrics
 * @access  Private/Admin
 */
const getSystemMetrics = async (req, res, next) => {
  try {
    // Count documents in collections
    const [displayCount, contentCount, userCount] = await Promise.all([
      Display.countDocuments(),
      Content.countDocuments(),
      User.countDocuments()
    ]);
    
    // Get active displays (connected in last 5 minutes)
    const activeDisplays = await Display.countDocuments({
      lastHeartbeat: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
    });
    
    // Get content metrics
    const contentMetrics = await Content.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalViews: { $sum: '$statistics.views' }
        }
      }
    ]);
    
    // Format content metrics
    const contentByType = {};
    contentMetrics.forEach(metric => {
      contentByType[metric._id] = {
        count: metric.count,
        totalViews: metric.totalViews
      };
    });
    
    // Get top 5 most viewed content
    const topContent = await Content.find()
      .sort({ 'statistics.views': -1 })
      .limit(5)
      .select('title type statistics.views');
    
    res.status(200).json({
      success: true,
      displays: {
        total: displayCount,
        active: activeDisplays,
        inactive: displayCount - activeDisplays
      },
      content: {
        total: contentCount,
        byType: contentByType,
        topViewed: topContent
      },
      users: {
        total: userCount
      },
      performance: {
        memoryUsage: process.memoryUsage().rss / 1024 / 1024,
        uptime: process.uptime()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get system logs
 * @route   GET /api/system/logs
 * @access  Private/Admin
 */
const getSystemLogs = async (req, res, next) => {
  try {
    const { level = 'info', limit = 100, page = 1 } = req.query;
    
    // In a real implementation, this would fetch logs from a database or log file
    // For this prototype, we'll return dummy logs
    
    const dummyLogs = generateDummyLogs(limit, level);
    
    res.status(200).json({
      success: true,
      logs: dummyLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: dummyLogs.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Restart system
 * @route   POST /api/system/restart
 * @access  Private/Admin
 */
const restartSystem = async (req, res, next) => {
  try {
    // In a real implementation, this would trigger a system restart
    // For this prototype, we'll just simulate it
    
    // Send response before "restarting"
    res.status(200).json({
      success: true,
      message: 'System restart initiated'
    });
    
    // Log restart event
    console.log(`[${new Date().toISOString()}] System restart initiated by user: ${req.user.id}`);
    
    // In a real system, you might do:
    // setTimeout(() => process.exit(0), 1000);
  } catch (error) {
    next(error);
  }
};

/**
 * Helper function to format uptime in human-readable format
 */
const formatUptime = (uptime) => {
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);
  
  return parts.join(' ');
};

/**
 * Helper function to format bytes in human-readable format
 */
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Helper function to generate dummy logs for demonstration
 */
const generateDummyLogs = (limit, level) => {
  const levels = ['error', 'warn', 'info', 'debug'];
  const logTypes = [
    'system:start', 'system:config', 'display:connect', 'display:disconnect',
    'content:update', 'user:login', 'user:logout', 'api:request'
  ];
  
  const logs = [];
  const levelIndex = levels.indexOf(level);
  
  for (let i = 0; i < limit; i++) {
    const randomLevel = levels[Math.floor(Math.random() * (levelIndex + 1))];
    const logType = logTypes[Math.floor(Math.random() * logTypes.length)];
    const timestamp = new Date(Date.now() - Math.random() * 86400000).toISOString();
    
    let message = `${logType} operation completed`;
    let data = {};
    
    switch (logType) {
      case 'display:connect':
        message = 'Display connected';
        data = { displayId: `display_${Math.floor(Math.random() * 100)}` };
        break;
      case 'display:disconnect':
        message = 'Display disconnected';
        data = { displayId: `display_${Math.floor(Math.random() * 100)}` };
        break;
      case 'content:update':
        message = 'Content updated';
        data = { contentId: `content_${Math.floor(Math.random() * 100)}` };
        break;
      case 'user:login':
        message = 'User logged in';
        data = { userId: `user_${Math.floor(Math.random() * 10)}` };
        break;
      case 'api:request':
        message = 'API request';
        data = { 
          path: `/api/${['display', 'content', 'auth', 'system'][Math.floor(Math.random() * 4)]}`,
          method: ['GET', 'POST', 'PUT', 'DELETE'][Math.floor(Math.random() * 4)],
          status: [200, 201, 400, 401, 403, 404, 500][Math.floor(Math.random() * 7)],
          duration: Math.random() * 500
        };
        break;
    }
    
    logs.push({
      id: `log_${i}`,
      timestamp,
      level: randomLevel,
      type: logType,
      message,
      data
    });
  }
  
  return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

module.exports = {
  getSystemStatus,
  getSystemHealth,
  getSystemMetrics,
  getSystemLogs,
  restartSystem
}; 