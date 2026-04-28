import { createServer } from 'node:http';
import { runJob } from './job.js';

export async function runGscReport(req, res) {
  if (req.method && !['GET', 'POST'].includes(req.method)) {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const result = await runJob();
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

export async function handler() {
  return runJob();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number.parseInt(process.env.PORT || '8080', 10);
  const server = createServer(runGscReport);

  server.listen(port, () => {
    console.log(`GSC report service listening on port ${port}`);
  });
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}
