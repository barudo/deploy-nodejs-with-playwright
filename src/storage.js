import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Storage } from '@google-cloud/storage';

export async function saveCsv(csv, config) {
  const filename = buildFilename(config);

  if (config.gcsBucket) {
    const storage = new Storage();
    const key = joinKey(config.gcsPrefix, filename);
    await storage.bucket(config.gcsBucket).file(key).save(csv, {
      contentType: 'text/csv'
    });

    return `gs://${config.gcsBucket}/${key}`;
  }

  if (config.s3Bucket) {
    const client = new S3Client({});
    const key = joinKey(config.s3Prefix, filename);
    await client.send(new PutObjectCommand({
      Bucket: config.s3Bucket,
      Key: key,
      Body: csv,
      ContentType: 'text/csv'
    }));

    return `s3://${config.s3Bucket}/${key}`;
  }

  await mkdir(dirname(config.outputFile), { recursive: true });
  await writeFile(config.outputFile, csv, 'utf8');
  return config.outputFile;
}

function buildFilename(config) {
  const safeSite = config.siteUrl
    .replace(/^sc-domain:/, '')
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9.-]+/gi, '-')
    .replace(/^-+|-+$/g, '');

  return `${safeSite}-${config.startDate}-to-${config.endDate}.csv`;
}

function joinKey(prefix, filename) {
  return prefix ? `${prefix}/${filename}` : filename;
}
