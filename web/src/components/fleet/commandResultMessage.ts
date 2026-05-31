interface FleetCommandResult {
  devicesTargeted: number;
  devicesOnline?: number;
  devicesQueued?: number;
  devicesDelivered?: number;
  devicesFailed?: number;
}

export type FleetCommandMessageKind = 'success' | 'warning' | 'error';

export interface FleetCommandMessage {
  kind: FleetCommandMessageKind;
  message: string;
}

const plural = (count: number, singular: string, pluralText = `${singular}s`) =>
  `${count} ${count === 1 ? singular : pluralText}`;

export function formatFleetCommandResult(
  actionLabel: string,
  result: FleetCommandResult,
): FleetCommandMessage {
  const targeted = result.devicesTargeted ?? 0;
  const delivered = result.devicesDelivered ?? result.devicesOnline ?? 0;
  const queued = result.devicesQueued ?? Math.max(targeted - delivered, 0);
  const failed = result.devicesFailed ?? 0;

  if (targeted === 0) {
    return {
      kind: 'error',
      message: `${actionLabel} did not match any devices`,
    };
  }

  if (targeted > 0 && failed >= targeted && delivered === 0 && queued === 0) {
    return {
      kind: 'error',
      message: `${actionLabel} failed for all ${plural(targeted, 'targeted device')}`,
    };
  }

  if (failed > 0) {
    return {
      kind: 'warning',
      message: `${actionLabel} reached ${delivered} of ${targeted} devices; ${failed} failed`,
    };
  }

  if (queued > 0 && delivered === 0) {
    return {
      kind: 'success',
      message: `${actionLabel} queued for ${plural(queued, 'offline device')}`,
    };
  }

  if (queued > 0) {
    return {
      kind: 'success',
      message: `${actionLabel} delivered to ${plural(delivered, 'device')}; ${queued} queued for offline devices`,
    };
  }

  return {
    kind: 'success',
    message: `${actionLabel} delivered to ${plural(delivered, 'device')}`,
  };
}

export function toastFleetCommandResult(
  toast: {
    success: (message: string) => void;
    warning?: (message: string) => void;
    error: (message: string) => void;
  },
  actionLabel: string,
  result: FleetCommandResult,
): FleetCommandMessage {
  const formatted = formatFleetCommandResult(actionLabel, result);
  if (formatted.kind === 'error') {
    toast.error(formatted.message);
    return formatted;
  }
  if (formatted.kind === 'warning') {
    (toast.warning ?? toast.error)(formatted.message);
    return formatted;
  }
  toast.success(formatted.message);
  return formatted;
}
