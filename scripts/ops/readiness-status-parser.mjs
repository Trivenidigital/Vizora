let input = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', () => {
  try {
    const body = JSON.parse(input || '{}');
    const payload =
      body && typeof body === 'object' && body.data && typeof body.data === 'object'
        ? body.data
        : body;
    const status = payload && typeof payload === 'object' ? payload.status : undefined;

    if (status === 'ok' || status === 'degraded' || status === 'unhealthy') {
      console.log(status);
      return;
    }

    console.log('unknown');
  } catch {
    console.log('invalid');
  }
});
