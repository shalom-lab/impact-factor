import { promises as fs } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const dataDir = path.join(projectRoot, 'data');
const publicDir = path.join(projectRoot, 'public');
const manifestPath = path.join(publicDir, 'data-manifest.json');

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function formatTitle(fileName) {
  return fileName
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\.csv$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function buildManifest() {
  await ensureDir(publicDir);

  let entries = [];
  try {
    entries = await fs.readdir(dataDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn('[manifest] No data directory found, writing empty manifest.');
    } else {
      throw error;
    }
  }

  const files = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.toLowerCase().endsWith('.csv')) continue;

    const filePath = path.join(dataDir, entry.name);
    const stats = await fs.stat(filePath);

    files.push({
      fileName: entry.name,
      title: formatTitle(entry.name),
      relativePath: `data/${entry.name}`,
      size: stats.size,
      lastModified: stats.mtime.toISOString()
    });
  }

  files.sort((a, b) => a.title.localeCompare(b.title));

  const manifest = {
    generatedAt: new Date().toISOString(),
    fileCount: files.length,
    files
  };

  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`[manifest] Written ${files.length} entries to ${path.relative(projectRoot, manifestPath)}`);
}

buildManifest().catch((error) => {
  console.error('[manifest] Failed to generate manifest.');
  console.error(error);
  process.exit(1);
});

