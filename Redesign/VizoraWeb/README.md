# Vizora Web Application

Advanced digital signage content management web application.

## Features

- Content library with grid and list views
- Content categorization and tagging
- Advanced filtering and searching
- Upload functionality for various content types
- Bulk actions for content management
- Content scheduling and preview
- Analytics integration
- Display management
- Secure authentication system

## Development Setup

### Prerequisites

- Node.js (v18 or later)
- npm (v9 or later)
- Docker and Docker Compose (for containerized development)

### Local Development

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/vizora.git
   cd vizora/Redesign/VizoraWeb
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   ```
   cp .env.example .env
   ```

4. Start the development server:
   ```
   npm run dev
   ```

5. Access the development server at http://localhost:5173

### Using Docker for Development

1. Build and start the containers:
   ```
   docker-compose up --build
   ```

2. Access the application at http://localhost

3. Stop the containers:
   ```
   docker-compose down
   ```

## Application Structure

```
src/
├── assets/        # Static assets like images and icons
├── components/    # Reusable UI components
├── contexts/      # React contexts (e.g., AuthContext)
├── layouts/       # Page layout components
├── pages/         # Page components
├── routes/        # Route definitions
├── services/      # API services and mock data
├── stores/        # State management
├── styles/        # Global styles and theme
├── types/         # TypeScript type definitions
└── utils/         # Utility functions
```

## Authentication

The application uses a token-based authentication system. For development purposes, any email/password combination will work with the mock authentication service.

### Protected Routes

All routes under `/dashboard` are protected and require authentication:

- `/dashboard` - Main dashboard
- `/content` - Content management
- `/displays` - Displays management
- `/schedules` - Content scheduling
- `/analytics` - Analytics dashboard
- `/settings` - User and account settings

### Mock Authentication

The mock authentication service:
- Accepts any valid email/password combination
- Stores authentication state in localStorage
- Creates a mock user with demo data
- Simulates token-based authentication

## Mock Services

To facilitate development without a backend, this application uses mock services:

### Display Service

- `getDisplays()` - Returns a list of mock displays
- `pairDisplay()` - Simulates pairing a new display
- `getDisplay()` - Retrieves a single display by ID
- `updateDisplay()` - Updates display information
- `unpairDisplay()` - Removes a display
- `pushContent()` - Simulates pushing content to a display

### Content Service

- `getContentList()` - Returns a list of mock content items
- `getContentById()` - Retrieves a single content item
- `createContent()` - Creates a new content item
- `updateContent()` - Updates content information
- `deleteContent()` - Removes content
- `uploadContent()` - Simulates uploading a file
- `pushContentToDisplay()` - Pushes content to a specific display
- `scheduleContent()` - Schedules content for display

## Environment Configuration

The application uses environment variables for configuration. Available variables:

| Variable | Description | Default |
|----------|-------------|---------|
| VITE_API_URL | API endpoint URL | http://localhost:3003/api |
| VITE_USE_MOCK_DATA | Whether to use mock data | true |
| VITE_ENABLE_LOGGING | Enable detailed logging | false |
| VITE_USE_FAKE_API | Use fake API for auth | true |

To customize these settings, modify the `.env` file in the root directory.

## Running Tests

### Unit and Integration Tests

```
npm test
```

### End-to-End Tests

```
npm run test:e2e
```

### Linting

```
npm run lint
```

## Building for Production

```
npm run build
```

The production-ready build will be in the `dist` directory.

## Deployment

### Docker Deployment

1. Build the Docker image:
   ```
   docker build -t vizora-web:latest .
   ```

2. Run the container:
   ```
   docker run -p 80:80 vizora-web:latest
   ```

### Kubernetes Deployment

1. Update the image repository and tag in the Kubernetes deployment file:
   ```
   sed -i 's/${REPOSITORY_URL}/your-repo-url/g' kubernetes/deployment.yaml
   sed -i 's/${IMAGE_TAG}/latest/g' kubernetes/deployment.yaml
   ```

2. Apply the Kubernetes configuration:
   ```
   kubectl apply -f kubernetes/deployment.yaml
   ```

## CI/CD Pipeline

This project uses GitHub Actions for CI/CD. The workflow performs the following steps:

1. Linting
2. Running unit and integration tests
3. Running end-to-end tests
4. Building the application
5. (If on main branch) Deploying to production

## License

[MIT](LICENSE)

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature/my-new-feature`
5. Submit a pull request 