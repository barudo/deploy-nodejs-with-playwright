import { access, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { chromium, firefox, webkit } from 'playwright';

const BROWSERS = { chromium, firefox, webkit };

export async function scrapeGscReports(config) {
  validateReports(config.reports);

  const browser = await launchBrowser(config);

  try {
    const context = await createContext(browser, config);
    const page = await context.newPage();
    page.setDefaultTimeout(config.navigationTimeoutMs);
    page.setDefaultNavigationTimeout(config.navigationTimeoutMs);

    await ensureAuthenticated(page, context, config);

    const rows = [];

    for (const report of config.reports) {
      const reportRows = await scrapeReport(page, report, config);
      rows.push(...reportRows);
      console.log(`Extracted ${report.name}: ${reportRows.length} rows`);
    }

    return rows;
  } finally {
    await browser.close();
  }
}

export async function saveGscSession(config) {
  const browser = await launchBrowser({ ...config, playwrightHeadless: false });

  try {
    const context = await createContext(browser, config);
    const page = await context.newPage();
    page.setDefaultTimeout(config.navigationTimeoutMs);
    page.setDefaultNavigationTimeout(config.navigationTimeoutMs);

    await ensureAuthenticated(page, context, config);
    return config.storageStatePath;
  } finally {
    await browser.close();
  }
}

async function launchBrowser(config) {
  const browserType = BROWSERS[config.playwrightBrowser];

  if (!browserType) {
    throw new Error(`Unsupported PLAYWRIGHT_BROWSER: ${config.playwrightBrowser}`);
  }

  const launchOptions = {
    headless: config.playwrightHeadless
  };

  if (config.playwrightBrowser === 'chromium' && config.playwrightChannel) {
    launchOptions.channel = config.playwrightChannel;
  }

  if (config.playwrightBrowser === 'chromium') {
    launchOptions.args = ['--no-sandbox', '--disable-dev-shm-usage'];

    if (config.playwrightDisableAutomationControlled) {
      launchOptions.args.push('--disable-blink-features=AutomationControlled');
    }
  }

  return browserType.launch(launchOptions);
}

async function createContext(browser, config) {
  const options = {
    viewport: { width: 1440, height: 1000 },
    locale: 'en-US'
  };

  if (config.playwrightUserAgent) {
    options.userAgent = config.playwrightUserAgent;
  }

  if (config.storageStatePath && await fileExists(config.storageStatePath)) {
    options.storageState = config.storageStatePath;
  }

  return browser.newContext(options);
}

async function ensureAuthenticated(page, context, config) {
  await page.goto('https://search.google.com/search-console/welcome?hl=en', {
    waitUntil: 'domcontentloaded'
  });

  if (!isGoogleLoginUrl(page.url()) && !await hasVisibleLoginField(page)) {
    await persistStorageState(context, config.storageStatePath);
    return;
  }

  if (!config.googleEmail || !config.googlePassword) {
    throw new Error(
      'Google login is required. Set GOOGLE_EMAIL and GOOGLE_PASSWORD, or run npm run login locally with STORAGE_STATE_PATH and deploy that saved browser state securely.'
    );
  }

  await fillIfVisible(page, 'input[type="email"], input[name="identifier"]', config.googleEmail);
  await page.keyboard.press('Enter');

  await throwIfGoogleRejectedLogin(page);

  await page.waitForSelector('input[type="password"], input[name="Passwd"]', {
    timeout: config.loginTimeoutMs
  });
  await fillIfVisible(page, 'input[type="password"], input[name="Passwd"]', config.googlePassword);
  await page.keyboard.press('Enter');

  await waitForGoogleLoginToFinish(page, config);
  await persistStorageState(context, config.storageStatePath);
}

async function scrapeReport(page, report, config) {
  await page.goto(buildReportUrl(config.siteUrl, report.param), {
    waitUntil: 'domcontentloaded'
  });
  await page.waitForLoadState('networkidle').catch(() => {});
  const hasRows = await page.waitForSelector(config.reportSelector, {
    timeout: config.navigationTimeoutMs
  }).then(() => true).catch(() => false);

  if (!hasRows) {
    return [];
  }

  return page.evaluate(
    ({ reportSelector, updatedSelector, category, name }) => {
      const updatedText = document.querySelector(updatedSelector)?.textContent || '';

      return Array.from(document.querySelectorAll(reportSelector)).map((element) => ({
        status: category,
        'report name': name,
        url: element.textContent.replace(/[\uE145\uE89E\uE8B6]/g, '').trim(),
        updated: updatedText.replace(/[^\d/.-]+/g, '').trim()
      }));
    },
    {
      reportSelector: config.reportSelector,
      updatedSelector: config.updatedSelector,
      category: report.category || '',
      name: report.name || report.param
    }
  );
}

async function waitForGoogleLoginToFinish(page, config) {
  const deadline = Date.now() + config.loginTimeoutMs;

  while (Date.now() < deadline) {
    await throwIfGoogleRejectedLogin(page);

    if (!isGoogleLoginUrl(page.url()) && !await hasVisibleLoginField(page)) {
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      return;
    }

    await page.waitForTimeout(1000);
  }

  throw new Error('Google login did not finish before LOGIN_TIMEOUT_MS. Check for 2-step verification, CAPTCHA, or blocked sign-in.');
}

async function throwIfGoogleRejectedLogin(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});

  if (page.url().includes('/signin/rejected')) {
    throw new Error(
      'Google rejected this automated browser as not secure. Try npm run login with PLAYWRIGHT_BROWSER=firefox and no PLAYWRIGHT_CHANNEL, then reuse the saved STORAGE_STATE_PATH for scheduled runs.'
    );
  }
}

async function fillIfVisible(page, selector, value) {
  const field = page.locator(selector).first();
  await field.waitFor({ state: 'visible' });
  await field.fill(value);
}

async function hasVisibleLoginField(page) {
  return page.locator('input[type="email"], input[name="identifier"], input[type="password"], input[name="Passwd"]').first().isVisible().catch(() => false);
}

async function persistStorageState(context, storageStatePath) {
  if (!storageStatePath) {
    return;
  }

  await mkdir(dirname(storageStatePath), { recursive: true });
  await context.storageState({ path: storageStatePath });
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function buildReportUrl(siteUrl, param) {
  const reportUrl = normalizeReportUrl(param);

  if (reportUrl) {
    return reportUrl;
  }

  const url = new URL('https://search.google.com/search-console/index/drilldown');
  url.searchParams.set('resource_id', siteUrl);
  url.searchParams.set('item_key', normalizeItemKey(param));
  return url.toString();
}

function normalizeReportUrl(param) {
  const text = String(param || '').trim();

  if (!text) {
    return null;
  }

  try {
    const parsed = new URL(text);

    if (parsed.hostname === 'search.google.com' && parsed.pathname.startsWith('/search-console/')) {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeItemKey(param) {
  const text = String(param || '').trim();

  if (!text) {
    return text;
  }

  try {
    const parsed = new URL(text);
    const itemKey = parsed.searchParams.get('item_key');

    if (itemKey) {
      return itemKey;
    }
  } catch {
    // Not a full URL. Treat it as an item_key value.
  }

  const itemKeyMatch = text.match(/(?:^|[?&])item_key=([^&]+)/);
  const itemKey = itemKeyMatch ? itemKeyMatch[1] : text;

  try {
    return decodeURIComponent(itemKey);
  } catch {
    return itemKey;
  }
}

function isGoogleLoginUrl(url) {
  return url.includes('accounts.google.com') || url.includes('/signin/');
}

function validateReports(reports) {
  if (!Array.isArray(reports) || reports.length === 0) {
    throw new Error('GSC_REPORTS_JSON is required and must be a JSON array of report objects with category, name, and param fields.');
  }

  for (const report of reports) {
    if (!report || !report.param) {
      throw new Error('Each GSC_REPORTS_JSON item must include a param value.');
    }
  }
}
