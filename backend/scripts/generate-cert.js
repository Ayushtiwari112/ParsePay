const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const sslDir = path.join(__dirname, '../ssl');

// Create ssl directory if it doesn't exist
if (!fs.existsSync(sslDir)) {
  fs.mkdirSync(sslDir, { recursive: true });
}

// Generate self-signed certificate
const command = `openssl req -x509 -newkey rsa:4096 -keyout ${path.join(sslDir, 'server.key')} -out ${path.join(sslDir, 'server.cert')} -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"`;

try {
  console.log('Generating self-signed SSL certificate...');
  execSync(command, { stdio: 'inherit' });
  console.log('✅ SSL certificate generated successfully!');
  console.log(`   Key: ${path.join(sslDir, 'server.key')}`);
  console.log(`   Cert: ${path.join(sslDir, 'server.cert')}`);
} catch (error) {
  console.error('❌ Error generating certificate:', error.message);
  console.log('\n💡 Alternative: Manually generate certificates using:');
  console.log('   openssl req -x509 -newkey rsa:4096 -keyout ssl/server.key -out ssl/server.cert -days 365 -nodes');
}

