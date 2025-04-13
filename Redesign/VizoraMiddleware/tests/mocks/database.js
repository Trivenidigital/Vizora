/**
 * Database mock for tests
 */

// Mock user database operations
const user = {
  findByPk: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  destroy: jest.fn()
};

// Mock token database operations
const token = {
  findOne: jest.fn(),
  create: jest.fn(),
  destroy: jest.fn()
};

// Mock blacklist database operations
const blacklist = {
  findOne: jest.fn(),
  create: jest.fn()
};

// Mock refresh token operations
const refreshToken = {
  findOne: jest.fn(),
  create: jest.fn(),
  destroy: jest.fn()
};

// Mock other collections needed by tests
const displays = {
  findOne: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
};

const content = {
  findOne: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
};

module.exports = {
  user,
  token,
  blacklist,
  refreshToken,
  displays,
  content
}; 