type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function redactWidgetSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    let changed = false;
    const redacted = value.map((item) => {
      const next = redactWidgetSecrets(item);
      changed = changed || next !== item;
      return next;
    });
    return changed ? redacted : value;
  }

  if (!isRecord(value)) {
    return value;
  }

  let copy: JsonRecord | null = null;
  const mutableCopy = () => {
    copy ??= { ...value };
    return copy;
  };

  if (
    value.isWidget === true
    && value.widgetType === 'generic-api'
    && Object.prototype.hasOwnProperty.call(value, 'widgetConfig')
  ) {
    delete mutableCopy().widgetConfig;
  }

  const source = copy ?? value;
  for (const [key, child] of Object.entries(source)) {
    const redactedChild = redactWidgetSecrets(child);
    if (redactedChild !== child) {
      mutableCopy()[key] = redactedChild;
    }
  }

  return copy ?? value;
}

export function redactDevicePayload<T>(payload: T): T {
  return redactWidgetSecrets(payload) as T;
}

export function redactDeviceContentMetadata<T>(metadata: T): T {
  return redactDevicePayload(metadata);
}

export function redactDevicePlaylist<T>(playlist: T): T {
  return redactDevicePayload(playlist);
}
