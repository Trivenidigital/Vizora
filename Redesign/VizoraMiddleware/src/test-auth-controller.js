require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const { login } = require('./controllers/auth.controller');

// MongoDB connection - using MongoDB Atlas
const mongoURI = process.env.MONGO_URI || 'mongodb+srv://VizoraAdmin:sm5TkhjCxzCZDO6a@cluster0.6dmkg.mongodb.net/vizora?retryWrites=true&w=majority&appName=Cluster0';

async function connectDB() {
  try {
    await mongoose.connect(mongoURI);
    console.log('MongoDB Atlas connected...');
  } catch (err) {
    console.error('Database connection error:', err.message);
    process.exit(1);
  }
}

async function testAuthController() {
  try {
    console.log('======= Testing Auth Controller Login =======');
    
    // Create mock req and res objects
    const mockRes = {
      status: function(statusCode) {
        this.statusCode = statusCode;
        return this;
      },
      json: function(data) {
        this.data = data;
        console.log(`Response (${this.statusCode}):`, this.data);
        return this;
      }
    };
    
    // 1. Test with test user correct credentials
    console.log('\n1. Testing login with test user correct credentials');
    const mockReq1 = {
      body: {
        email: 'test@example.com',
        password: 'password123'
      }
    };
    
    await login(mockReq1, mockRes);
    
    // 2. Test with test user incorrect password
    console.log('\n2. Testing login with test user incorrect password');
    const mockReq2 = {
      body: {
        email: 'test@example.com',
        password: 'wrongpassword'
      }
    };
    
    await login(mockReq2, mockRes);
    
    // 3. Test with non-existent user
    console.log('\n3. Testing login with non-existent user');
    const mockReq3 = {
      body: {
        email: 'nonexistent@example.com',
        password: 'password123'
      }
    };
    
    await login(mockReq3, mockRes);
    
    // 4. Test with regular user
    console.log('\n4. Testing login with regular user');
    const mockReq4 = {
      body: {
        email: 'user@example.com',
        password: 'regularpass123'
      }
    };
    
    await login(mockReq4, mockRes);
    
    // 5. Test with missing email
    console.log('\n5. Testing login with missing email');
    const mockReq5 = {
      body: {
        password: 'password123'
      }
    };
    
    await login(mockReq5, mockRes);
    
    // 6. Test with missing password
    console.log('\n6. Testing login with missing password');
    const mockReq6 = {
      body: {
        email: 'test@example.com'
      }
    };
    
    await login(mockReq6, mockRes);
    
  } catch (err) {
    console.error('Error testing auth controller:', err);
  } finally {
    // Close connection
    await mongoose.disconnect();
    console.log('\nTest completed, database connection closed');
  }
}

// Run the function
connectDB().then(() => {
  testAuthController();
}); 