#!/usr/bin/env node
import { listUavSlugs, preflightUavCollection, readUavCollection } from './lib/uav-store.mjs';

try {
  const slugs = await listUavSlugs(process.cwd());
  const failures = [];
  let lookups = 0;
  for (const slug of slugs) {
    const folder = await readUavCollection(slug, process.cwd());
    lookups += 1
      + folder.collection.series.length
      + folder.manifest.groups.flatMap((group) => group.buckets.flatMap((bucket) => bucket.files)).length;
    const checked = await preflightUavCollection(slug, { rootDir: process.cwd() });
    for (const blocker of checked.blockers || []) {
      failures.push(`${slug}/${blocker.id}: ${blocker.detail}`);
    }
  }
  if (failures.length) throw new Error(failures.join('\n'));
  console.log(`uav:audit passed (${slugs.length} collection(s), ${lookups} lookup(s)).`);
} catch (error) {
  console.error(`uav:audit failed: ${error?.message || error}`);
  process.exit(1);
}
