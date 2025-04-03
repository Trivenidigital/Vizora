import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'react-hot-toast';
import { DisplaySettings, DisplaySettingsSchema, RESOLUTION_OPTIONS, PLAYBACK_MODES } from '@/types/display';
import { useSocket } from '@/hooks/useSocket';
import { useAuth } from '@/hooks/useAuth';
import '@/components/DeviceSettingsForm.css';

interface DeviceSettingsFormProps {
  displayId: string;
  initialSettings: DisplaySettings;
  onSave?: (settings: DisplaySettings) => void;
}

export const DeviceSettingsForm: React.FC<DeviceSettingsFormProps> = ({
  displayId,
  initialSettings,
  onSave
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [health, setHealth] = useState<DisplayHealth | null>(null);
  const { socket } = useSocket();
  const { user } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
    setValue
  } = useForm<DisplaySettings>({
    resolver: zodResolver(DisplaySettingsSchema),
    defaultValues: initialSettings
  });

  // Watch for settings changes
  const settings = watch();

  // Listen for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleSettingsUpdate = (data: { displayId: string; settings: DisplaySettings }) => {
      if (data.displayId === displayId) {
        // Update form with new settings
        Object.entries(data.settings).forEach(([key, value]) => {
          setValue(key as keyof DisplaySettings, value, { shouldDirty: false });
        });
        toast.success('Settings updated in real-time');
      }
    };

    const handleHealthUpdate = (data: { displayId: string; health: DisplayHealth }) => {
      if (data.displayId === displayId) {
        setHealth(data.health);
      }
    };

    socket.on('display:settings:update', handleSettingsUpdate);
    socket.on('display:health:update', handleHealthUpdate);

    return () => {
      socket.off('display:settings:update', handleSettingsUpdate);
      socket.off('display:health:update', handleHealthUpdate);
    };
  }, [socket, displayId, setValue]);

  const onSubmit = async (data: DisplaySettings) => {
    try {
      setIsSaving(true);
      
      // Emit settings update via socket
      socket?.emit('display:settings:update', {
        displayId,
        settings: data
      });

      // Call API to persist settings
      const response = await fetch(`/api/displays/${displayId}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ settings: data })
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      toast.success('Settings saved successfully');
      onSave?.(data);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="device-settings-form">
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Basic Information */}
        <div className="form-section">
          <h3>Basic Information</h3>
          <div className="form-group">
            <label htmlFor="name">Display Name</label>
            <input
              id="name"
              {...register('name')}
              className={errors.name ? 'error' : ''}
            />
            {errors.name && <span className="error-message">{errors.name.message}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="location.name">Location Name</label>
            <input
              id="location.name"
              {...register('location.name')}
              className={errors.location?.name ? 'error' : ''}
            />
            {errors.location?.name && (
              <span className="error-message">{errors.location.name.message}</span>
            )}
          </div>
        </div>

        {/* Display Settings */}
        <div className="form-section">
          <h3>Display Settings</h3>
          <div className="form-group">
            <label htmlFor="resolution">Resolution</label>
            <select
              id="resolution"
              {...register('resolution')}
              className={errors.resolution ? 'error' : ''}
            >
              {RESOLUTION_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.resolution && (
              <span className="error-message">{errors.resolution.message}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="playbackMode">Playback Mode</label>
            <select
              id="playbackMode"
              {...register('playbackMode')}
              className={errors.playbackMode ? 'error' : ''}
            >
              {PLAYBACK_MODES.map(mode => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
            {errors.playbackMode && (
              <span className="error-message">{errors.playbackMode.message}</span>
            )}
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="form-section">
          <h3>Advanced Settings</h3>
          <div className="form-group">
            <label htmlFor="settings.brightness">Brightness (%)</label>
            <input
              type="number"
              id="settings.brightness"
              {...register('settings.brightness', { valueAsNumber: true })}
              min="0"
              max="100"
              className={errors.settings?.brightness ? 'error' : ''}
            />
            {errors.settings?.brightness && (
              <span className="error-message">{errors.settings.brightness.message}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="settings.volume">Volume (%)</label>
            <input
              type="number"
              id="settings.volume"
              {...register('settings.volume', { valueAsNumber: true })}
              min="0"
              max="100"
              className={errors.settings?.volume ? 'error' : ''}
            />
            {errors.settings?.volume && (
              <span className="error-message">{errors.settings.volume.message}</span>
            )}
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                {...register('settings.autoPlay')}
                className={errors.settings?.autoPlay ? 'error' : ''}
              />
              Auto-play Content
            </label>
          </div>
        </div>

        {/* Group Assignment (Admin only) */}
        {user?.role === 'admin' && (
          <div className="form-section">
            <h3>Group Assignment</h3>
            <div className="form-group">
              <label htmlFor="groupId">Display Group</label>
              <select
                id="groupId"
                {...register('groupId')}
                className={errors.groupId ? 'error' : ''}
              >
                <option value="">No Group</option>
                {/* Group options will be populated dynamically */}
              </select>
              {errors.groupId && (
                <span className="error-message">{errors.groupId.message}</span>
              )}
            </div>
          </div>
        )}

        {/* Device Health */}
        {health && (
          <div className="form-section health-section">
            <h3>Device Health</h3>
            <div className="health-status">
              <span className={`status-indicator ${health.status}`}>
                {health.status.toUpperCase()}
              </span>
              <div className="health-metrics">
                <div>CPU: {health.metrics.cpu}%</div>
                <div>Memory: {health.metrics.memory}%</div>
                <div>Storage: {health.metrics.storage}%</div>
                <div>Temperature: {health.metrics.temperature}°C</div>
                <div>Uptime: {Math.floor(health.metrics.uptime / 3600)}h</div>
              </div>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button
            type="submit"
            disabled={isSaving || !isDirty}
            className="primary-button"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}; 