require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

async function run() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Try to login directly
    console.log('Finding test user...');
    let user = await User.findOne({ email: 'test@example.com' }).select('+password');
    
    if (!user) {
      console.log('Test user not found! Creating one...');
      
      // Create a new test user
      const newUser = new User({
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        password: 'password123',
        role: 'admin'
      });
      
      await newUser.save();
      console.log('Test user created successfully');
      
      // Set the user for login
      user = await User.findOne({ email: 'test@example.com' }).select('+password');
    }
    
    // Try to match password
    console.log('Checking password...');
    const isMatch = await user.matchPassword('password123');
    console.log(`Password match result: ${isMatch}`);
    
    if (isMatch) {
      // Generate token
      const token = user.generateAuthToken();
      console.log('\nLogin successful!');
      console.log('User:', {
        id: user._id.toString(),
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role
      });
      
      // Create files with the token for different use cases
      
      // Create a token file
      fs.writeFileSync(path.join(__dirname, 'token.txt'), token);
      console.log('\nToken saved to: ' + path.join(__dirname, 'token.txt'));
      
      // Create PowerShell script
      const psScript = `
$token = "${token}"
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Uri "http://localhost:3003/api/protected-route" -Headers $headers
      `.trim();
      fs.writeFileSync(path.join(__dirname, 'use-token.ps1'), psScript);
      console.log('PowerShell script saved to: ' + path.join(__dirname, 'use-token.ps1'));
      
      // Create bash script
      const bashScript = `
#!/bin/bash
TOKEN="${token}"
curl -H "Authorization: Bearer $TOKEN" http://localhost:3003/api/protected-route
      `.trim();
      fs.writeFileSync(path.join(__dirname, 'use-token.sh'), bashScript);
      console.log('Bash script saved to: ' + path.join(__dirname, 'use-token.sh'));
      
      // Create JS file
      const jsScript = `
const token = "${token}";
fetch("http://localhost:3003/api/protected-route", {
  headers: { Authorization: \`Bearer \${token}\` }
})
.then(res => res.json())
.then(data => console.log(data));
      `.trim();
      fs.writeFileSync(path.join(__dirname, 'use-token.js'), jsScript);
      console.log('JavaScript file saved to: ' + path.join(__dirname, 'use-token.js'));
      
      // Verify the token
      console.log('\nVerifying token...');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Decoded token:', decoded);
    } else {
      console.log('Password does not match!');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

run(); 