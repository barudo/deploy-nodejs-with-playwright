import { getConfig } from './config.js';
import { saveGscSession } from './playwright-gsc.js';

try {
  const config = getConfig({ PLAYWRIGHT_HEADLESS: 'false' });
  const storageStatePath = await saveGscSession(config);
  console.log(`Saved Google session state to ${storageStatePath}`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
