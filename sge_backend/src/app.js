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
    
    if (allowedOrigins.indexOf(origin) !== -1) {
       return callback(null, true);
    } else {
       // For this prototype/dev environment, we might want to be permissive if the exact origin isn't matched,
       // but strictly following the requirement to allow specific origins.
       // Use the specific allowed list. 
       return callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-client-info', 'apikey', 'X-Org-Id', 'x-org-id'],
  credentials: true
};

// 1) Mount cors() with correct options at the very top before any routes/middleware
app.use(cors(corsOptions));

// 2) Adding a catch-all OPTIONS handler
app.options('*', cors(corsOptions));

// Explicit OPTIONS handler for the specific path to ensure 204 success for preflight
app.options('/api/chat/conversations', cors(corsOptions));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  // console.log('Headers:', JSON.stringify(req.headers, null, 2));
  next();
});

app.use('/docs', swaggerUi.serve, (req, res, next) => {
  const host = req.get('host');           // may or may not include port
  let protocol = req.protocol;          // http or https

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
