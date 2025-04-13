import { vi } from 'vitest';
import { server } from './mocks/server';

// Mock express
vi.mock('express', () => ({
  default: () => ({
    use: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    listen: vi.fn(),
  }),
}));

// Mock socket.io
vi.mock('socket.io', () => ({
  Server: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    to: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    except: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
  })),
}));

// Mock cors
vi.mock('cors', () => ({
  default: vi.fn(),
}));

// Mock helmet
vi.mock('helmet', () => ({
  default: vi.fn(),
}));

// Mock compression
vi.mock('compression', () => ({
  default: vi.fn(),
}));

// Mock morgan
vi.mock('morgan', () => ({
  default: vi.fn(),
}));

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  sign: vi.fn(),
  verify: vi.fn(),
  decode: vi.fn(),
}));

// Mock bcrypt
vi.mock('bcrypt', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}));

// Mock mongoose
vi.mock('mongoose', () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  Schema: vi.fn(),
  model: vi.fn(),
}));

// Mock multer
vi.mock('multer', () => ({
  default: () => ({
    storage: vi.fn(),
    limits: vi.fn(),
    fileFilter: vi.fn(),
  }),
}));

// Mock cloudinary
vi.mock('cloudinary', () => ({
  v2: {
    config: vi.fn(),
    uploader: {
      upload: vi.fn(),
      destroy: vi.fn(),
    },
  },
}));

// Mock nodemailer
vi.mock('nodemailer', () => ({
  createTransport: vi.fn().mockReturnValue({
    sendMail: vi.fn(),
  }),
}));

// Mock winston
vi.mock('winston', () => ({
  format: {
    combine: vi.fn(),
    timestamp: vi.fn(),
    json: vi.fn(),
  },
  transports: {
    Console: vi.fn(),
    File: vi.fn(),
  },
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock moment
vi.mock('moment', () => ({
  default: vi.fn().mockImplementation(() => ({
    format: vi.fn(),
    add: vi.fn().mockReturnThis(),
    subtract: vi.fn().mockReturnThis(),
    isBefore: vi.fn(),
    isAfter: vi.fn(),
    isSame: vi.fn(),
    startOf: vi.fn().mockReturnThis(),
    endOf: vi.fn().mockReturnThis(),
  })),
}));

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    create: vi.fn().mockReturnThis(),
  },
}));

// Mock fs
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}));

// Mock path
vi.mock('path', () => ({
  join: (...args: string[]) => args.join('/'),
  resolve: (...args: string[]) => args.join('/'),
  dirname: (path: string) => path.split('/').slice(0, -1).join('/'),
  basename: (path: string) => path.split('/').pop(),
  extname: (path: string) => path.split('.').pop(),
}));

// Mock os
vi.mock('os', () => ({
  platform: () => 'win32',
  release: () => '10.0.0',
  arch: () => 'x64',
  hostname: () => 'test-host',
  networkInterfaces: () => ({
    'Ethernet': [{
      address: '192.168.1.1',
      netmask: '255.255.255.0',
      family: 'IPv4',
      mac: '00:00:00:00:00:00',
    }],
  }),
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn(),
}));

// Mock http
vi.mock('http', () => ({
  createServer: vi.fn(),
  request: vi.fn(),
}));

// Mock https
vi.mock('https', () => ({
  createServer: vi.fn(),
  request: vi.fn(),
}));

// Mock crypto
vi.mock('crypto', () => ({
  randomBytes: vi.fn(),
  createHash: vi.fn(),
  createHmac: vi.fn(),
}));

// Mock fs-extra
vi.mock('fs-extra', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readJson: vi.fn(),
  writeJson: vi.fn(),
  ensureDir: vi.fn(),
  copy: vi.fn(),
  move: vi.fn(),
  remove: vi.fn(),
}));

// Setup MSW
beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

/**
 * Test environment setup
 * 
 * This is used to set up the Node.js environment for Jest tests
 */

process.env = {
  ...process.env,
  // Use MongoDB Atlas test database for testing
  MONGO_URI: 'mongodb+srv://VizoraAdmin:sm5TkhjCxzCZDO6a@cluster0.6dmkg.mongodb.net/vizora_test?retryWrites=true&w=majority&appName=Cluster0',
  // Other test settings remain the same
  NODE_ENV: 'test',
  PORT: '3003',
  JWT_SECRET: 'test-secret',
  LOG_LEVEL: 'error',
}; 