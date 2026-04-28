import 'dotenv/config';

const DEFAULT_REPORT_SELECTOR = '.OOHai';
const DEFAULT_UPDATED_SELECTOR = '.zTJZxd.zOPr2c';

export function getConfig(overrides = {}) {
  const env = { ...process.env, ...overrides };
  const siteUrl = required(env.SITE_URL, 'SITE_URL');
  const { startDate, endDate } = getDateWindow(env);

  return {
    siteUrl,
    startDate,
    endDate,
    googleEmail: env.GOOGLE_EMAIL,
    googlePassword: env.GOOGLE_PASSWORD,
    reports: parseJson(env.GSC_REPORTS_JSON, [], 'GSC_REPORTS_JSON'),
    reportSelector: env.GSC_REPORT_SELECTOR || DEFAULT_REPORT_SELECTOR,
    updatedSelector: env.GSC_UPDATED_SELECTOR || DEFAULT_UPDATED_SELECTOR,
    playwrightBrowser: env.PLAYWRIGHT_BROWSER || 'chromium',
    playwrightChannel: env.PLAYWRIGHT_CHANNEL,
    playwrightUserAgent: env.PLAYWRIGHT_USER_AGENT,
    playwrightDisableAutomationControlled: parseBoolean(env.PLAYWRIGHT_DISABLE_AUTOMATION_CONTROLLED, true),
    playwrightHeadless: parseBoolean(env.PLAYWRIGHT_HEADLESS, true),
    navigationTimeoutMs: parseInteger(env.NAVIGATION_TIMEOUT_MS, 60000),
    loginTimeoutMs: parseInteger(env.LOGIN_TIMEOUT_MS, 120000),
    storageStatePath: env.STORAGE_STATE_PATH || './.auth/gsc-state.json',
    outputFile: env.OUTPUT_FILE || './reports/gsc-report.csv',
    gcsBucket: env.GCS_BUCKET,
    gcsPrefix: trimSlashes(env.GCS_PREFIX || 'gsc-reports'),
    s3Bucket: env.S3_BUCKET,
    s3Prefix: trimSlashes(env.S3_PREFIX || 'gsc-reports')
  };
}

function required(value, name) {
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function getDateWindow(env) {
  if (env.START_DATE && env.END_DATE) {
    return {
      startDate: env.START_DATE,
      endDate: env.END_DATE
    };
  }

  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);

  return {
    startDate: formatDate(start),
    endDate: formatDate(end)
  };
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseList(value, fallback) {
  if (!value) {
    return fallback;
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseInteger(value, fallback) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`Invalid integer value: ${value}`);
  }

  return parsed;
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function parseJson(value, fallback, name) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Invalid JSON in ${name}: ${error.message}`);
  }
}

function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/g, '');
}
