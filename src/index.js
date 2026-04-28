import { runJob } from './job.js';

try {
  const result = await runJob();
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
