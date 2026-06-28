#!/usr/bin/env node
import { buildUavOutputs, syncUavCatalogOutputs } from './lib/uav-store.mjs';

try {
  const built = await buildUavOutputs({ rootDir: process.cwd() });
  await syncUavCatalogOutputs({ rootDir: process.cwd(), aggregate: built.aggregate });
  console.log(`uav:build wrote ${built.collections} collection(s), ${built.lookups} lookup(s).`);
} catch (error) {
  console.error(`uav:build failed: ${error?.message || error}`);
  process.exit(1);
}

