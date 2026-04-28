import 'dotenv/config';

const DEFAULT_DIMENSIONS = ['query', 'page', 'country', 'device'];

export function getConfig(overrides = {}) {
  const env = { ...process.env, ...overrides };
  const siteUrl = required(env.SITE_URL, 'SITE_URL');
  const { startDate, endDate } = getDateWindow(env);

  return {
    siteUrl,
    startDate,
    endDate,
    dimensions: parseList(env.REPORT_DIMENSIONS, DEFAULT_DIMENSIONS),
    dimensionFilterGroups: parseJson(env.DIMENSION_FILTER_GROUPS, []),
    rowLimit: parseInteger(env.ROW_LIMIT, 25000),
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

function parseJson(value, fallback) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Invalid JSON in DIMENSION_FILTER_GROUPS: ${error.message}`);
  }
}

function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/g, '');
}
