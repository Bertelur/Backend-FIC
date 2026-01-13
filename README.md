# Backend-FIC

Backend service support for FIC project

## Overview

This is a production-ready ExpressJS backend application built with TypeScript, featuring MongoDB database integration, Sentry error monitoring, and Vercel deployment support.

## Tech Stack

- **Runtime**: Node.js (>=18.0.0)
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB (NoSQL)
- **Monitoring**: Sentry
- **Deployment**: Vercel
- **Security**: Helmet, CORS
- **Logging**: Morgan

## Project Structure

```
Backend-FIC/
├── index.ts                 # Main entry point
├── config/
│   ├── database.ts         # MongoDB connection configuration
│   └── sentry.ts           # Sentry initialization
├── routes/
│   └── health.ts           # Health check endpoint
├── models/                 # MongoDB models (for future use)
├── middleware/             # Custom middleware (for future use)
├── utils/                  # Utility functions (for future use)
├── .env.example            # Environment variables template
├── .gitignore             # Git ignore rules
├── tsconfig.json          # TypeScript configuration
├── vercel.json            # Vercel deployment configuration
├── package.json           # Dependencies and scripts
└── README.md              # Project documentation
```

## Setup Instructions

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- MongoDB instance (local or cloud)

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd Backend-FIC
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

4. Update the `.env` file with your configuration:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/fic-db
SENTRY_DSN=your-sentry-dsn-here
```

### Environment Variables

| Variable      | Description                          | Required | Default     |
| ------------- | ------------------------------------ | -------- | ----------- |
| `PORT`        | Server port number                   | No       | 3000        |
| `NODE_ENV`    | Environment (development/production) | No       | development |
| `MONGODB_URI` | MongoDB connection string            | Yes      | -           |
| `SENTRY_DSN`  | Sentry DSN for error monitoring      | No       | -           |

## Development Workflow

### Available Scripts

- `npm run dev` - Start development server with hot reload (nodemon + ts-node)
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server (requires build first)
- `npm run type-check` - Type check without emitting files

### Running the Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3000` (or the port specified in your `.env` file).

### Building for Production

```bash
npm run build
npm start
```

## API Endpoints

### Health Check

**GET** `/health`

Returns the health status of the server and database connection.

**Response (200 OK)**:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "database": "connected"
}
```

**Response (503 Service Unavailable)**:

```json
{
  "status": "unhealthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "database": "disconnected",
  "error": "Error message"
}
```

### Root Endpoint

**GET** `/`

Returns basic API information.

**Response (200 OK)**:

```json
{
  "message": "Backend-FIC API",
  "version": "1.0.0",
  "status": "running"
}
```

## Database Configuration

The application uses MongoDB for data storage. The connection is managed in `config/database.ts` with the following features:

- Connection pooling
- Automatic reconnection handling
- Graceful shutdown support

Make sure your MongoDB instance is running and accessible before starting the server.

## Sentry Integration

Sentry is configured for error monitoring and performance tracking. To enable Sentry:

1. Create a Sentry project at [sentry.io](https://sentry.io)
2. Copy your DSN from the Sentry dashboard
3. Add it to your `.env` file as `SENTRY_DSN`

If Sentry DSN is not configured, the application will run without error monitoring (useful for local development).

## Deployment to Vercel

### Prerequisites

- Vercel account
- Vercel CLI installed (`npm i -g vercel`)

### Deployment Steps

1. Install Vercel CLI (if not already installed):

```bash
npm i -g vercel
```

2. Login to Vercel:

```bash
vercel login
```

3. Deploy:

```bash
vercel
```

4. Set environment variables in Vercel dashboard:
   - Go to your project settings
   - Navigate to Environment Variables
   - Add all variables from your `.env` file

### Vercel Configuration

The `vercel.json` file is pre-configured for serverless deployment. The configuration:

- Uses `@vercel/node` builder for TypeScript support
- Routes all requests to `index.ts`
- Sets production environment

## Security Features

- **Helmet**: Sets various HTTP headers for security
- **CORS**: Configures Cross-Origin Resource Sharing
- **Environment Variables**: Sensitive data stored in environment variables

## Error Handling

- Sentry integration for error tracking
- Custom error handling middleware
- 404 handler for undefined routes
- Graceful error responses

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

ISC
