import Fastify from 'fastify';

export function buildServer() {
  const server = Fastify({ logger: true });

  server.get('/health', async () => ({ status: 'ok' }));

  return server;
}

async function start() {
  const server = buildServer();
  const port = Number(process.env.PORT ?? 3000);
  await server.listen({ port, host: '0.0.0.0' });
}

const isMain = process.argv[1]?.endsWith('server.ts');
if (isMain) start();
