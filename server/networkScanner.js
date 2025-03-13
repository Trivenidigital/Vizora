import dgram from 'dgram';
import os from 'os';

export class NetworkScanner {
  constructor() {
    this.socket = dgram.createSocket('udp4');
    this.isScanning = false;
    this.lastDiscoveredDevice = null;
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    if (!this.socket) return;

    this.socket.on('message', (msg, rinfo) => {
      this.handleMessage(msg, rinfo);
    });

    this.socket.on('error', (err) => {
      console.error('Socket error:', err);
    });
  }

  handleMessage(msg, rinfo) {
    const message = msg.toString();
    
    // Parse SSDP response
    if (message.includes('HTTP/1.1 200 OK')) {
      const headers = this.parseSSDPHeaders(message);
      if (this.isTVDevice(headers)) {
        this.lastDiscoveredDevice = {
          name: headers['server'] || headers['user-agent'] || 'Unknown TV',
          ip: rinfo.address
        };
      }
    }
  }

  parseSSDPHeaders(message) {
    const headers = {};
    const lines = message.split('\r\n');
    
    for (const line of lines) {
      const [key, value] = line.split(':').map(s => s.trim());
      if (key && value) {
        headers[key.toLowerCase()] = value;
      }
    }
    
    return headers;
  }

  isTVDevice(headers) {
    const tvIdentifiers = [
      'tv',
      'television',
      'smart-tv',
      'samsung',
      'lg',
      'sony',
      'philips',
      'tcl',
      'vizio',
      'hisense',
      'sharp',
      'panasonic',
      'toshiba',
      'jvc',
      'hitachi',
      'westinghouse',
      'insignia',
      'element',
      'sanyo',
      'haier'
    ];

    const searchText = Object.values(headers).join(' ').toLowerCase();
    return tvIdentifiers.some(id => searchText.includes(id));
  }

  async startScan() {
    if (this.isScanning) return;

    this.isScanning = true;
    this.lastDiscoveredDevice = null;

    const interfaces = os.networkInterfaces();
    const multicastAddress = '239.255.255.250';
    const port = 1900;

    // SSDP M-SEARCH request
    const searchRequest = Buffer.from(
      'M-SEARCH * HTTP/1.1\r\n' +
      'HOST: 239.255.255.250:1900\r\n' +
      'MAN: "ssdp:discover"\r\n' +
      'MX: 3\r\n' +
      'ST: ssdp:all\r\n' +
      '\r\n'
    );

    for (const [name, addresses] of Object.entries(interfaces)) {
      if (!addresses) continue;

      for (const addr of addresses) {
        if (addr.family === 'IPv4' && !addr.internal) {
          try {
            if (this.socket) {
              this.socket.bind(0, addr.address);
              this.socket.send(searchRequest, port, multicastAddress);
            }
          } catch (error) {
            console.error(`Error sending SSDP request on interface ${name}:`, error);
          }
        }
      }
    }
  }

  stopScan() {
    this.isScanning = false;
    if (this.socket) {
      this.socket.close();
      this.socket = dgram.createSocket('udp4');
      this.setupSocketHandlers();
    }
  }

  getLastDiscoveredDevice() {
    return this.lastDiscoveredDevice;
  }
} 