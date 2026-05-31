export const DEFAULT_MAX_JSON_RESPONSE_BYTES = 1024 * 1024;

export async function readJsonResponseBodyWithLimit(
  res: Response,
  maxBytes = DEFAULT_MAX_JSON_RESPONSE_BYTES,
): Promise<string> {
  const contentLength = res.headers.get('content-length');
  if (contentLength) {
    const declaredBytes = Number(contentLength);
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      await cancelResponseBody(res);
      throw new Error(`Endpoint response is too large; maximum is ${maxBytes} bytes`);
    }
  }

  if (!res.body) {
    const text = await res.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      throw new Error(`Endpoint response is too large; maximum is ${maxBytes} bytes`);
    }
    return text;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let text = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        await cancelReader(reader);
        throw new Error(`Endpoint response is too large; maximum is ${maxBytes} bytes`);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

async function cancelResponseBody(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    // Preserve the response-size error even if stream cancellation fails.
  }
}

async function cancelReader(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // Preserve the response-size error even if stream cancellation fails.
  }
}
