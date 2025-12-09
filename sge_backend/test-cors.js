// Simple CORS test script
// Usage: node test-cors.js

const http = require('http');
const https = require('https');

const testOrigins = [
  'http://localhost:3000',
  'https://vscode-internal-30623-beta.beta01.cloud.kavia.ai:3000',
  'http://example.com' // Should be allowed in dev mode with warning
];

const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

function testCors(origin) {
  return new Promise((resolve, reject) => {
    const url = new URL(backendUrl);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: '/',
      method: 'OPTIONS',
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,Authorization'
      },
      rejectUnauthorized: false // For self-signed certs in dev
    };

    const req = lib.request(options, (res) => {
      const headers = res.headers;
      resolve({
        origin,
        statusCode: res.statusCode,
        allowOrigin: headers['access-control-allow-origin'],
        allowMethods: headers['access-control-allow-methods'],
        allowHeaders: headers['access-control-allow-headers'],
        allowCredentials: headers['access-control-allow-credentials']
      });
    });

    req.on('error', (e) => {
      reject({ origin, error: e.message });
    });

    req.end();
  });
}

async function runTests() {
  console.log('Testing CORS configuration...\n');
  console.log(`Backend URL: ${backendUrl}\n`);

  for (const origin of testOrigins) {
    try {
      const result = await testCors(origin);
      console.log(`Origin: ${origin}`);
      console.log(`  Status: ${result.statusCode}`);
      console.log(`  Allow-Origin: ${result.allowOrigin || 'Not set'}`);
      console.log(`  Allow-Methods: ${result.allowMethods || 'Not set'}`);
      console.log(`  Allow-Headers: ${result.allowHeaders || 'Not set'}`);
      console.log(`  Allow-Credentials: ${result.allowCredentials || 'Not set'}`);
      console.log('');
    } catch (err) {
      console.log(`Origin: ${err.origin}`);
      console.log(`  Error: ${err.error}`);
      console.log('');
    }
  }
}

runTests().then(() => {
  console.log('CORS tests completed.');
}).catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
