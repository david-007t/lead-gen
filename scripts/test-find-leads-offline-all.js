#!/usr/bin/env node
import { readdir } from "fs/promises";
import path from "path";
import { spawnSync } from "child_process";

const fixtureDir = path.join(process.cwd(), "fixtures/find-leads");
const entries = (await readdir(fixtureDir))
  .filter(name => name.endsWith(".json"))
  .sort();

if (entries.length === 0) {
  console.error(`No fixture files found in ${fixtureDir}`);
  process.exit(1);
}

let failed = 0;
for (const file of entries) {
  const fixturePath = path.join(fixtureDir, file);
  console.log(`\n=== ${file} ===`);
  const result = spawnSync(process.execPath, ["scripts/test-find-leads.js"], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: {
      ...process.env,
      FIXTURE_FILE: fixturePath,
      ALLOW_CLAUDE_LIVE: "",
      LIVE_VERIFY: "",
    },
  });
  if (result.status !== 0) failed += 1;
}

if (failed > 0) {
  console.error(`\n${failed}/${entries.length} offline Find Leads fixtures failed.`);
  process.exit(1);
}

console.log(`\nAll ${entries.length} offline Find Leads fixtures passed.`);
