const cors = require('cors');
const express = require('express');
const routes = require('./routes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../swagger');

// Initialize express app
const app = express();

// Enable trust proxy to handle X-Forwarded-Proto correctly behind nginx/proxies
app.enable('trust proxy');

const allowedOrigins = [
  'https://vscode-internal-17989-beta.beta01.cloud.kavia.ai:3000',
  'http://localhost:3000'
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check against allowed origins
    // Using includes() || !origin logic as requested, though !origin is handled above
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      // Be permissive for dev if needed, or strict. 
      // Returning false instead of error avoids 500s on OPTIONS for unknown origins, just blocks CORS.
      return callback(null, false);
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: 'Authorization,Content-Type,X-Org-Id,x-client-info,apikey,x-org-id',
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// 1) Mount cors() with correct options at the very top before any routes/middleware
app.use(cors(corsOptions));

// 2) Adding a catch-all OPTIONS handler using the same cors options
app.options('*', cors(corsOptions));

// 3) Fallback middleware to explicitly set headers and handle OPTIONS if cors() didn't
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Set Access-Control-Allow-Origin if it matches our list
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-Org-Id,x-client-info,apikey,x-org-id');
  res.header('Access-Control-Allow-Credentials', 'true');

  // Universal OPTIONS responder
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Explicit test route for OPTIONS to confirm it works
app.options('/api/healthz', (req, res) => res.sendStatus(204));
app.get('/api/healthz', (req, res) => res.json({ status: 'ok' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  next();
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
