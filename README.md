# API Project

A Node.js Express API server with essential middleware and structure.

## Features

- Express.js server with security middleware (Helmet)
- CORS enabled for cross-origin requests
- Request logging with Morgan
- Environment variable support with dotenv
- Basic error handling
- Sample endpoints for testing
- Development auto-reload with nodemon

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration.

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Or start production server:**
   ```bash
   npm start
   ```

## Available Endpoints

- `GET /` - Server status and info
- `GET /health` - Health check endpoint
- `GET /api/data` - Sample data endpoint

## Project Structure

```
api-project/
├── src/
│   ├── controllers/     # Route handlers
│   ├── middleware/      # Custom middleware
│   ├── routes/          # Route definitions
│   └── index.js        # Main server file
├── .env.example        # Environment variables template
├── .gitignore         # Git ignore rules
├── package.json       # Project dependencies and scripts
└── README.md          # This file
```

## Scripts

- `npm start` - Start the production server
- `npm run dev` - Start development server with auto-reload
- `npm test` - Run tests (placeholder)

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (development/production)

## Development

The server runs on port 3000 by default. Visit:
- http://localhost:3000 - API root
- http://localhost:3000/health - Health check
- http://localhost:3000/api/data - Sample data

## Next Steps

- Add database integration
- Implement authentication
- Add more API endpoints
- Set up testing framework
- Add API documentation