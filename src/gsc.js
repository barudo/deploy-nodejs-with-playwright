import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly'];

export async function fetchSearchAnalyticsRows(config) {
  const auth = new google.auth.GoogleAuth({ scopes: SCOPES });
  const webmasters = google.webmasters({ version: 'v3', auth });

  const response = await webmasters.searchanalytics.query({
    siteUrl: config.siteUrl,
    requestBody: {
      startDate: config.startDate,
      endDate: config.endDate,
      dimensions: config.dimensions,
      dimensionFilterGroups: config.dimensionFilterGroups,
      rowLimit: config.rowLimit
    }
  });

  return normalizeRows(response.data.rows || [], config.dimensions);
}

function normalizeRows(rows, dimensions) {
  return rows.map((row) => {
    const record = {};

    dimensions.forEach((dimension, index) => {
      record[dimension] = row.keys?.[index] || '';
    });

    record.clicks = row.clicks || 0;
    record.impressions = row.impressions || 0;
    record.ctr = row.ctr || 0;
    record.position = row.position || 0;

    return record;
  });
}
