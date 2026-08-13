import { render, screen, act } from '@testing-library/react';
import DeviceStatusIndicator from '../DeviceStatusIndicator';

// `jest.fn(() => jest.fn())` infers a zero-arg signature; the impl
// then gets re-bound via .mockImplementation to a 2-arg `(id, cb)`
// shape, which tsc rejects. Declare the signature explicitly so
// downstream impls (and the production component's call site that
// passes deviceId + callback) typecheck without `as any`.
const mockSubscribeToDevice = jest.fn<() => void, [string, (status: { status: string; timestamp: number }) => void]>(
  () => () => {},
);
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

  it('renders Unknown before any status has arrived', () => {
    // Was 'renders with default offline status'. Defaulting to Offline stated a
    // fact the client had not been told: absence of data is not evidence the
    // screen is down. See the 'unknown vs offline' block below.
    render(<DeviceStatusIndicator deviceId="device-1" />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
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

  it('shows pairing status from context', () => {
    mockGetDeviceStatus.mockReturnValue({ status: 'pairing', timestamp: Date.now() });
    render(<DeviceStatusIndicator deviceId="device-1" />);
    expect(screen.getByText('Pairing')).toBeInTheDocument();
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

describe('unknown vs offline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubscribeToDevice.mockImplementation(() => () => {});
  });

  /**
   * "We have no status for this device" and "this device is offline" are
   * different claims. The component used to initialise to 'offline' and fall
   * back to the offline config for anything unrecognised, so a device missing
   * from the status map — including when the whole bootstrap fetch failed —
   * rendered a red Offline badge identical to a device verified to be down.
   */
  it('reports Unknown, not Offline, when no status is available', () => {
    mockGetDeviceStatus.mockReturnValue(undefined);

    render(<DeviceStatusIndicator deviceId="dev-1" showLabel />);

    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.queryByText('Offline')).not.toBeInTheDocument();
  });

  it('still reports Offline when the server actually says offline', () => {
    mockGetDeviceStatus.mockReturnValue({ deviceId: 'dev-1', status: 'offline', timestamp: Date.now() });

    render(<DeviceStatusIndicator deviceId="dev-1" showLabel />);

    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
  });

  it('falls back to Unknown for a status it does not recognise', () => {
    mockGetDeviceStatus.mockReturnValue({ deviceId: 'dev-1', status: 'banana', timestamp: Date.now() });

    render(<DeviceStatusIndicator deviceId="dev-1" showLabel />);

    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
