'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getDeviceIdentifier, getDeviceMetadata } from '../lib/device-identifier';
import type { DeviceCredentials, PairingResponse, PairingStatusResponse } from '../lib/types';

const CREDENTIALS_KEY = 'vizora_display_credentials';

function getStoredCredentials(): DeviceCredentials | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(CREDENTIALS_KEY);
    if (!stored) return null;
    const creds = JSON.parse(stored) as DeviceCredentials;
    if (creds.deviceToken && creds.deviceId) return creds;
    return null;
  } catch {
    return null;
  }
}

function storeCredentials(creds: DeviceCredentials) {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(creds));
}

export function clearCredentials() {
  localStorage.removeItem(CREDENTIALS_KEY);
}

export function usePairing() {
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<DeviceCredentials | null>(null);
  const [isPairing, setIsPairing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Check for stored credentials on mount
  useEffect(() => {
    const stored = getStoredCredentials();
    if (stored) {
      setCredentials(stored);
    }
    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const requestPairingCode = useCallback(async () => {
    setIsPairing(true);
    setError(null);
    setPairingCode(null);
    setQrCode(null);

    try {
      const deviceIdentifier = getDeviceIdentifier();
      const metadata = getDeviceMetadata();

      const res = await fetch('/api/v1/devices/pairing/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceIdentifier, metadata }),
      });

      if (!res.ok) {
        throw new Error(`Pairing request failed: ${res.status}`);
      }

      const body = await res.json();
      const data: PairingResponse = body?.data ?? body;

      if (!mountedRef.current) return;

      setPairingCode(data.code);
      if (data.qrCode) setQrCode(data.qrCode);

      // Start polling for pairing completion
      startPolling(data.code);
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : 'Failed to request pairing code';
      setError(msg);
      setIsPairing(false);
    }
  }, []);

  const startPolling = useCallback((code: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/devices/pairing/status/${code}`);

        if (res.status === 404) {
          // Code expired, request a new one
          if (pollRef.current) clearInterval(pollRef.current);
          if (mountedRef.current) requestPairingCode();
          return;
        }

        if (!res.ok) return;

        const body = await res.json();
        const data: PairingStatusResponse = body?.data ?? body;

        if (data.status === 'paired' && data.deviceToken) {
          if (pollRef.current) clearInterval(pollRef.current);
          if (!mountedRef.current) return;

          const creds: DeviceCredentials = {
            deviceToken: data.deviceToken,
            deviceId: getDeviceIdentifier(),
            organizationId: data.organizationId,
          };

          storeCredentials(creds);
          setCredentials(creds);
          setIsPairing(false);
          setPairingCode(null);
        }
      } catch {
        // Silently retry on next interval
      }
    }, 2000);
  }, [requestPairingCode]);

  const resetPairing = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    clearCredentials();
    setCredentials(null);
    setPairingCode(null);
    setQrCode(null);
    setIsPairing(false);
    setError(null);
  }, []);

  return {
    pairingCode,
    qrCode,
    credentials,
    isPairing,
    error,
    requestPairingCode,
    resetPairing,
  };
}
