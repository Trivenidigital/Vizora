const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

// Mock data
const contents = [
  {
    id: '1',
    title: 'Sample Image',
    type: 'image',
    url: 'https://picsum.photos/800/600',
    thumbnail: 'https://picsum.photos/200/150',
    createdAt: '2023-10-15T14:30:00.000Z',
    updatedAt: '2023-10-15T14:30:00.000Z',
    status: 'published',
    description: 'A sample image for testing',
    tags: ['sample', 'image', 'test'],
    fileSize: 1024000,
    dimensions: '800x600',
    duration: null
  },
  {
    id: '2',
    title: 'Sample Video',
    type: 'video',
    url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
    thumbnail: 'https://picsum.photos/200/150?random=2',
    createdAt: '2023-10-10T10:15:00.000Z',
    updatedAt: '2023-10-12T09:45:00.000Z',
    status: 'draft',
    description: 'A sample video for testing',
    tags: ['sample', 'video', 'test'],
    fileSize: 5120000,
    dimensions: '1280x720',
    duration: 10
  }
];

const displays = [
  {
    id: '1',
    name: 'Lobby Display',
    location: 'Main Lobby',
    status: 'online'
  },
  {
    id: '2',
    name: 'Conference Room Screen',
    location: 'Conference Room A',
    status: 'online'
  }
];

// Content endpoints
app.get('/contents', (req, res) => {
  res.json(contents);
});

app.get('/contents/:id', (req, res) => {
  const content = contents.find(c => c.id === req.params.id);
  if (content) {
    res.json(content);
  } else {
    res.status(404).json({ error: 'Content not found' });
  }
});

app.post('/contents', (req, res) => {
  const newContent = {
    id: (contents.length + 1).toString(),
    ...req.body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  contents.push(newContent);
  res.status(201).json(newContent);
});

app.put('/contents/:id', (req, res) => {
  const index = contents.findIndex(c => c.id === req.params.id);
  if (index !== -1) {
    contents[index] = {
      ...contents[index],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    res.json(contents[index]);
  } else {
    res.status(404).json({ error: 'Content not found' });
  }
});

app.delete('/contents/:id', (req, res) => {
  const index = contents.findIndex(c => c.id === req.params.id);
  if (index !== -1) {
    const deleted = contents.splice(index, 1)[0];
    res.json(deleted);
  } else {
    res.status(404).json({ error: 'Content not found' });
  }
});

// Display endpoints
app.get('/displays', (req, res) => {
  res.json(displays);
});

app.post('/displays/:displayId/push', (req, res) => {
  const display = displays.find(d => d.id === req.params.displayId);
  const content = contents.find(c => c.id === req.body.contentId);
  
  if (!display) {
    return res.status(404).json({ error: 'Display not found' });
  }
  
  if (!content) {
    return res.status(404).json({ error: 'Content not found' });
  }
  
  // Simulate pushing content to display
  res.json({ 
    message: `Content "${content.title}" pushed to display "${display.name}" successfully`,
    timestamp: new Date().toISOString()
  });
});

// Auth endpoints
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  
  // Simple mock authentication
  if (email === 'admin@example.com' && password === 'password') {
    res.json({
      token: 'mock-jwt-token',
      user: {
        id: '1',
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin'
      }
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.listen(port, () => {
  console.log(`Mock API server running at http://localhost:${port}`);
}); 