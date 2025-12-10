const cors = require('cors');
const express = require('express');
const routes = require('./routes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../swagger');

// Initialize express app
const app = express();

// Enable trust proxy to handle X-Forwarded-Proto correctly behind nginx/proxies
app.enable('trust proxy');

// Resolve allowed origins from env vars (comma-separated)
// Fallback to localhost for dev if nothing set
const rawOrigins = process.env.API_ALLOWED_ORIGIN || process.env.CORS_ORIGIN || '';
const allowedOrigins = rawOrigins
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Default for development if no env var is set
if (allowedOrigins.length === 0 && process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:3000');
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      return callback(null, false);
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: 'Authorization,Content-Type,X-Org-Id,x-client-info,apikey,x-org-id',
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// 1) Handle OPTIONS preflight for all routes using the same cors options
// This ensures 204 response for allowed origins and consistent headers
app.options('*', cors(corsOptions));

// 2) Mount cors() middleware for actual requests
app.use(cors(corsOptions));

// 3) Request logging middleware
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  next();
});

// Explicit test route for OPTIONS/Health to confirm it works
// Logging added to confirm updated app is running
app.get('/api/healthz', (req, res) => {
  console.log('[Health] /api/healthz endpoint hit - App is updated');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Swagger UI setup
app.use('/docs', swaggerUi.serve, (req, res, next) => {
  const host = req.get('host');
  let protocol = req.protocol;

  const actualPort = req.socket.localPort;
  const hasPort = host.includes(':');
  
  const needsPort =
    !hasPort &&
    ((protocol === 'http' && actualPort !== 80) ||
     (protocol === 'https' && actualPort !== 443));
  const fullHost = needsPort ? `${host}:${actualPort}` : host;
  protocol = req.secure ? 'https' : protocol;

  const dynamicSpec = {
    ...swaggerSpec,
    servers: [
      {
        url: `${protocol}://${fullHost}`,
      },
    ],
  };
  swaggerUi.setup(dynamicSpec)(req, res, next);
});

// Parse JSON request body
app.use(express.json());

// Mount routes
app.use('/', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Internal Server Error',
  });
});

module.exports = app;
