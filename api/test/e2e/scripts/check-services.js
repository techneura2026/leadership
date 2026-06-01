const net = require('net');

function checkPort(port, host) {
  return new Promise((resolve) => {
    const client = net.createConnection(port, host);
    client.on('connect', () => {
      client.end();
      resolve(true);
    });
    client.on('error', () => {
      resolve(false);
    });
  });
}

async function main() {
  const pgRunning = await checkPort(5432, 'localhost');
  if (!pgRunning) {
    console.error('\n❌  PostgreSQL is not running. Start it first: npm run db:up\n');
    process.exit(1);
  }

  const redisRunning = await checkPort(6379, 'localhost');
  if (!redisRunning) {
    console.error('\n❌  Redis is not running. Start it first: npm run db:up\n');
    process.exit(1);
  }

  process.exit(0);
}

main();
