import { render, screen } from '@testing-library/react';
import DeviceHealthMonitor, { DeviceHealth } from '../DeviceHealthMonitor';

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

const healthyDevice: DeviceHealth = {
  deviceId: 'device-1',
  cpuUsage: 45,
  memoryUsage: 60,
  storageUsage: 30,
  temperature: 42,
  uptime: 72,
  lastHeartbeat: new Date(),
  score: 92,
};

const poorDevice: DeviceHealth = {
  deviceId: 'device-2',
  cpuUsage: 90,
  memoryUsage: 95,
  storageUsage: 85,
  temperature: 70,
  uptime: 2,
  lastHeartbeat: new Date(),
  score: 35,
};

describe('DeviceHealthMonitor', () => {
  it('renders full view with health score', () => {
    render(<DeviceHealthMonitor health={healthyDevice} />);
    expect(screen.getByText('Device Health')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('Excellent')).toBeInTheDocument();
  });

  it('renders compact view', () => {
    render(<DeviceHealthMonitor health={healthyDevice} compact />);
    expect(screen.getByText('Health:')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
  });

  it('shows metric bars for CPU, Memory, Storage', () => {
    render(<DeviceHealthMonitor health={healthyDevice} />);
    expect(screen.getByText('CPU')).toBeInTheDocument();
    expect(screen.getByText('Memory')).toBeInTheDocument();
    expect(screen.getByText('Storage')).toBeInTheDocument();
  });

  it('shows temperature when enabled', () => {
    render(<DeviceHealthMonitor health={healthyDevice} showTemperature />);
    expect(screen.getByText('Temperature')).toBeInTheDocument();
  });

  it('hides temperature when disabled', () => {
    render(<DeviceHealthMonitor health={healthyDevice} showTemperature={false} />);
    expect(screen.queryByText('Temperature')).not.toBeInTheDocument();
  });

  it('shows uptime in days for long uptimes', () => {
    render(<DeviceHealthMonitor health={healthyDevice} showUptime />);
    expect(screen.getByText('Uptime')).toBeInTheDocument();
    expect(screen.getByText('3.0 days')).toBeInTheDocument();
  });

  it('shows warning alert for poor health', () => {
    render(<DeviceHealthMonitor health={poorDevice} />);
    expect(screen.getByText(/Device health is poor/)).toBeInTheDocument();
  });

  it('does not show alert for healthy device', () => {
    render(<DeviceHealthMonitor health={healthyDevice} />);
    expect(screen.queryByText(/Device health is poor/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Device health is degraded/)).not.toBeInTheDocument();
  });
});
