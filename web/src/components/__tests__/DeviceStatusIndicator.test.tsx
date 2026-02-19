import { render, screen, act } from '@testing-library/react';
import DeviceStatusIndicator from '../DeviceStatusIndicator';

const mockSubscribeToDevice = jest.fn(() => jest.fn());
const mockGetDeviceStatus = jest.fn();

jest.mock('@/lib/context/DeviceStatusContext', () => ({
  useDeviceStatus: () => ({
    subscribeToDevice: mockSubscribeToDevice,
    getDeviceStatus: mockGetDeviceStatus,
  }),
  DeviceStatus: {},
}));

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

describe('DeviceStatusIndicator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDeviceStatus.mockReturnValue(null);
  });

  it('renders with default offline status', () => {
    render(<DeviceStatusIndicator deviceId="device-1" />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('subscribes to device on mount', () => {
    render(<DeviceStatusIndicator deviceId="device-1" />);
    expect(mockSubscribeToDevice).toHaveBeenCalledWith('device-1', expect.any(Function));
  });

  it('shows initial status from context', () => {
    mockGetDeviceStatus.mockReturnValue({ status: 'online', timestamp: Date.now() });
    render(<DeviceStatusIndicator deviceId="device-1" />);
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('hides label when showLabel is false', () => {
    render(<DeviceStatusIndicator deviceId="device-1" showLabel={false} />);
    expect(screen.queryByText('Offline')).not.toBeInTheDocument();
  });

  it('updates when subscription fires', () => {
    let callback: any;
    mockSubscribeToDevice.mockImplementation((_id: string, cb: any) => {
      callback = cb;
      return jest.fn();
    });

    render(<DeviceStatusIndicator deviceId="device-1" />);

    act(() => {
      callback({ status: 'online', timestamp: Date.now() });
    });

    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('unsubscribes on unmount', () => {
    const unsubscribe = jest.fn();
    mockSubscribeToDevice.mockReturnValue(unsubscribe);

    const { unmount } = render(<DeviceStatusIndicator deviceId="device-1" />);
    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
