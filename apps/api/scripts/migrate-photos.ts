import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SRC_URL = process.env.SRC_SUPABASE_URL!;
const SRC_KEY = process.env.SRC_SERVICE_ROLE!;
const DST_URL = process.env.DST_SUPABASE_URL!;
const DST_KEY = process.env.DST_SERVICE_ROLE!;
const BUCKET  = process.env.BUCKET_NAME!;
const PREFIX  = (process.env.FOLDER_PREFIX || '').replace(/^\/+/, '').replace(/\/+$/, '');
const FORCE_PUBLIC = process.env.PUBLIC_FLAG ? process.env.PUBLIC_FLAG.toLowerCase() === 'true' : undefined;

if (!SRC_URL || !SRC_KEY || !DST_URL || !DST_KEY || !BUCKET) {
  throw new Error('Missing required env vars: SRC_* DST_* BUCKET_NAME');
}

const src = createClient(SRC_URL, SRC_KEY, { auth: { persistSession: false } });
const dst = createClient(DST_URL, DST_KEY, { auth: { persistSession: false } });

async function getBucketPublicFlag(): Promise<boolean> {
  if (FORCE_PUBLIC !== undefined) return FORCE_PUBLIC;
  const { data, error } = await src.storage.listBuckets();
  if (error) throw error;
  const meta = (data || []).find(b => b.name === BUCKET);
  return !!meta?.public;
}

async function ensureBucket(isPublic: boolean) {
  const { data: list, error } = await dst.storage.listBuckets();
  if (error) throw error;
  const exists = (list || []).some(b => b.name === BUCKET);
  if (!exists) {
    const { error: ce } = await dst.storage.createBucket(BUCKET, { public: isPublic });
    if (ce) throw ce;
    console.log(`Created bucket '${BUCKET}' (public=${isPublic}) on destination.`);
  }
}

type Entry = { name: string };
async function listRecursive(path = ''): Promise<string[]> {
  const { data, error } = await src.storage.from(BUCKET).list(path, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (error) throw error;
  const files: string[] = [];
  for (const e of (data || []) as Entry[]) {
    if (!e) continue;
    const p = path ? `${path}/${e.name}` : e.name;
    // If it ends with '/', treat as folder and recurse
    if (p.endsWith('/')) {
      files.push(...await listRecursive(p));
    } else {
      files.push(p);
    }
  }
  return files;
}

async function collectFiles(prefix: string): Promise<string[]> {
  if (!prefix) return await listRecursive('');
  const norm = prefix.replace(/^\/+/, '').replace(/\/+$/, '');
  return await listRecursive(norm);
}

async function copyOne(key: string) {
  const dl = await src.storage.from(BUCKET).download(key);
  if (dl.error) throw dl.error;
  const buf = Buffer.from(await (dl.data as Blob).arrayBuffer());
  const up = await dst.storage.from(BUCKET).upload(key, buf, { upsert: true });
  if (up.error) throw up.error;
}

async function main() {
  const publicFlag = await getBucketPublicFlag();
  await ensureBucket(publicFlag);

  const files = await collectFiles(PREFIX);
  if (files.length === 0) {
    console.log(`No files found under '${PREFIX || '(bucket root)'}'.`);
    return;
  }

  console.log(`Copying ${files.length} object(s) from '${BUCKET}/${PREFIX || ''}' ...`);
  let done = 0, errors = 0;
  for (const key of files) {
    if (PREFIX && !key.startsWith(PREFIX)) continue; // copy only the photos/ subtree if set
    try {
      await copyOne(key);
      done++;
      if (done % 25 === 0) console.log(`...${done}/${files.length}`);
    } catch (e: any) {
      errors++;
      console.error(`Failed: ${key}`, e?.message || e);
    }
  }
  console.log(`Done. Copied=${done}, Errors=${errors}`);
}

main().catch(e => { console.error(e); process.exit(1); });
