import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';

import { site } from '../config/site.js';
import {
  closeDatabase,
  createScan,
  finishScan,
  getActiveScan,
  getScan,
  listScans,
  markScanRunning,
  recoverInterruptedScans,
} from './db.js';
import { getCheckDefinitions, runScan } from './scanner.js';

const app = Fastify({ logger: true });
const publicDirectory = fileURLToPath(new URL('../public', import.meta.url));

recoverInterruptedScans();

await app.register(fastifyStatic, {
  root: publicDirectory,
  prefix: '/',
});

app.get('/api/health', async () => ({
  status: 'ok',
  site: {
    name: site.name,
    url: site.baseUrl,
    logoUrl: site.logoUrl,
  },
  groups: getCheckDefinitions(),
}));

app.get('/api/scans', async () => ({ scans: listScans() }));

app.get('/api/scans/:id', async (request, reply) => {
  const id = Number(request.params.id);

  if (!Number.isInteger(id) || id < 1) {
    return reply.code(400).send({ error: 'Некорректный идентификатор проверки.' });
  }

  const scan = getScan(id);
  if (!scan) {
    return reply.code(404).send({ error: 'Проверка не найдена.' });
  }

  return { scan };
});

app.post('/api/scans', async (_request, reply) => {
  const activeScan = getActiveScan();
  if (activeScan) {
    return reply.code(409).send({
      error: 'Проверка уже выполняется.',
      scan: activeScan,
    });
  }

  const scan = createScan(site.baseUrl);

  setImmediate(async () => {
    try {
      markScanRunning(scan.id);
      const result = await runScan();
      finishScan(scan.id, result);
    } catch (error) {
      app.log.error(error);
      finishScan(scan.id, {
        passed: false,
        report: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return reply.code(202).send({ scan });
});

app.addHook('onClose', async () => {
  closeDatabase();
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

await app.listen({ port, host });
