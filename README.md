# Deploy Node.js Google Search Console Report Job

## Job Description

I have a Node.js script which logs in to Google Search Console and downloads a report. I want to deploy this on the cloud and set up a trigger to run this automatically.

Attached is the script. Please check and let me know if this can be done.

## Solution

This root folder contains a cloud-ready Node.js solution that exports Google Search Console data through the official Search Console API instead of browser automation.

The attached Playwright script in `attachments/code.txt` is useful as a reference, but it is not ideal for scheduled cloud execution because it depends on interactive Google login, possible 2-step verification, visible browser mode, and fragile Google UI selectors. The API approach is the reliable path for Google Cloud or AWS Lambda.

## What This Exports

The app calls the Search Console Search Analytics API and writes a CSV report with these default dimensions:

- `query`
- `page`
- `country`
- `device`

Each row includes:

- `clicks`
- `impressions`
- `ctr`
- `position`

By default, it exports the last 7 complete days.

## Files

- `src/index.js` - local CLI entrypoint
- `src/server.js` - HTTP server for Cloud Run, Google Cloud Functions, and AWS Lambda handler export
- `src/job.js` - reusable report job
- `src/gsc.js` - Google Search Console API client
- `src/storage.js` - writes CSV locally, to Google Cloud Storage, or to S3
- `.env.example` - environment variable template
- `Dockerfile` - container for Google Cloud Run

## Authentication

Create a Google Cloud service account and grant it access to the Search Console property:

1. Enable the Google Search Console API in the Google Cloud project.
2. Create a service account.
3. Add the service account email as a user on the Search Console property.
4. Use Application Default Credentials locally, or attach the service account to Cloud Run / Cloud Functions.

For local testing:

```bash
gcloud auth application-default login
```

## Local Run

Install dependencies:

```bash
npm install
```

Create environment variables:

```bash
cp .env.example .env
```

Set at least:

```bash
SITE_URL=https://example.com/
```

Run:

```bash
npm start
```

The default local output is:

```text
./reports/gsc-report.csv
```

### Fix `Insufficient Permission`

If local testing fails with `GaxiosError: Insufficient Permission` and the response says `insufficient_scope`, refresh Application Default Credentials with the Search Console scope:

```bash
gcloud auth application-default revoke
gcloud auth application-default login \
  --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/webmasters.readonly
```

Then run:

```bash
npm start
```

The authenticated Google account must also be added as a user on the exact Search Console property from `SITE_URL`.

### Fix Missing Quota Project

If local testing fails with `requires a quota project`, set a Google Cloud project as the ADC quota project:

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud services enable searchconsole.googleapis.com
gcloud auth application-default set-quota-project YOUR_PROJECT_ID
```

Then run:

```bash
npm start
```

`YOUR_PROJECT_ID` must be a Google Cloud project where you have permission to enable APIs and use quota.

## Google Cloud Run Deployment

Build and deploy:

```bash
gcloud run deploy gsc-report-job \
  --source . \
  --region us-central1 \
  --set-env-vars SITE_URL=https://example.com/,GCS_BUCKET=my-report-bucket \
  --service-account my-service-account@my-project.iam.gserviceaccount.com
```

Create a scheduled trigger:

```bash
gcloud scheduler jobs create http gsc-report-daily \
  --location us-central1 \
  --schedule "0 6 * * *" \
  --uri "https://YOUR_CLOUD_RUN_URL" \
  --http-method GET
```

Set `GCS_BUCKET` to write reports to Google Cloud Storage.

## Google Cloud Functions Deployment

Deploy the exported HTTP function:

```bash
gcloud functions deploy runGscReport \
  --gen2 \
  --runtime nodejs20 \
  --region us-central1 \
  --trigger-http \
  --entry-point runGscReport \
  --set-env-vars SITE_URL=https://example.com/,GCS_BUCKET=my-report-bucket \
  --service-account my-service-account@my-project.iam.gserviceaccount.com
```

Then trigger it with Cloud Scheduler.

## AWS Lambda Deployment

The Lambda handler is exported from `src/server.js`:

```text
src/server.handler
```

Required AWS environment variables:

```bash
SITE_URL=https://example.com/
S3_BUCKET=my-report-bucket
```

The Lambda role needs permission to write to the target S3 bucket. Google credentials must also be provided to the function, usually through a service account JSON secret exposed as `GOOGLE_APPLICATION_CREDENTIALS` or through workload identity federation.

Use EventBridge Scheduler to run the Lambda automatically.

## Environment Variables

- `SITE_URL` - required Search Console property URL, for example `https://example.com/` or `sc-domain:example.com`
- `START_DATE` - optional report start date, `YYYY-MM-DD`
- `END_DATE` - optional report end date, `YYYY-MM-DD`
- `REPORT_DIMENSIONS` - optional comma-separated dimensions
- `DIMENSION_FILTER_GROUPS` - optional JSON filter groups for the Search Console API
- `ROW_LIMIT` - optional row limit, default `25000`
- `OUTPUT_FILE` - optional local CSV path
- `GCS_BUCKET` - optional Google Cloud Storage bucket
- `GCS_PREFIX` - optional Google Cloud Storage object prefix
- `S3_BUCKET` - optional AWS S3 bucket
- `S3_PREFIX` - optional AWS S3 object prefix

## Important Note About the Original Playwright Script

The original script appears to target Search Console UI reports. Some UI-only reports may not map exactly to the public Search Console API. If the required report is specifically an indexing or coverage drilldown that is only visible in the UI, then Playwright can still be attempted on Cloud Run with a containerized headless browser, but it will be less reliable than the API solution.
