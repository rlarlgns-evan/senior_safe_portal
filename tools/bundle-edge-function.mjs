#!/usr/bin/env node
/**
 * Edge Function + _shared 를 단일 파일로 합칩니다.
 * Supabase 대시보드(한 파일만 업로드) 배포용.
 *
 * 사용법:
 *   node tools/bundle-edge-function.mjs analyze-link
 *   node tools/bundle-edge-function.mjs search-videos
 *   node tools/bundle-edge-function.mjs --all
 *
 * 결과: supabase/deploy/<함수명>.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FUNCTIONS_DIR = path.join(ROOT, "supabase", "functions");
const DEPLOY_DIR = path.join(ROOT, "supabase", "deploy");

const SHARED_IMPORT_RE =
  /import\s*\{[^}]+\}\s*from\s*["'](?:@shared\/security\.ts|\.\.\/_shared\/security\.ts|\.\/security\.ts)["'];\s*\n?/;

const GEMINI_IMPORT_RE =
  /import\s*\{[^}]+\}\s*from\s*["'](?:@shared\/gemini\.ts|\.\.\/_shared\/gemini\.ts|\.\/gemini\.ts)["'];\s*\n?/;

const FUNCTIONS_WITH_SHARED = ["analyze-link", "search-videos", "chat-agent"];
const SHARED_FILES = ["security.ts", "gemini.ts"];

function syncSharedFiles(name) {
  for (const fileName of SHARED_FILES) {
    const sharedPath = path.join(FUNCTIONS_DIR, "_shared", fileName);
    const localPath = path.join(FUNCTIONS_DIR, name, fileName);
    if (!fs.existsSync(sharedPath)) {
      throw new Error(`공유 파일 없음: ${sharedPath}`);
    }
    fs.copyFileSync(sharedPath, localPath);
  }
}

function bundleFunction(name) {
  const indexPath = path.join(FUNCTIONS_DIR, name, "index.ts");

  if (!fs.existsSync(indexPath)) {
    throw new Error(`함수를 찾을 수 없습니다: ${name}`);
  }

  if (FUNCTIONS_WITH_SHARED.includes(name)) {
    syncSharedFiles(name);
  }

  let indexSource = fs.readFileSync(indexPath, "utf8");
  const usesShared = SHARED_IMPORT_RE.test(indexSource) || GEMINI_IMPORT_RE.test(indexSource);

  if (!usesShared) {
    fs.mkdirSync(DEPLOY_DIR, { recursive: true });
    const outPath = path.join(DEPLOY_DIR, `${name}.ts`);
    fs.writeFileSync(outPath, indexSource, "utf8");
    console.log(`✓ ${name} — 공유 모듈 없음 → ${path.relative(ROOT, outPath)}`);
    return outPath;
  }

  indexSource = indexSource.replace(SHARED_IMPORT_RE, "");
  indexSource = indexSource.replace(GEMINI_IMPORT_RE, "");

  const sharedParts = SHARED_FILES.map((fileName) => {
    const sharedPath = path.join(FUNCTIONS_DIR, "_shared", fileName);
    if (!fs.existsSync(sharedPath)) {
      throw new Error(`공유 파일 없음: ${sharedPath}`);
    }
    return fs.readFileSync(sharedPath, "utf8").trim();
  });

  const bundled = [
    "// ── Supabase 대시보드 배포용 (자동 생성) ──",
    `// 원본: supabase/functions/${name}/index.ts + _shared/*`,
    "// node tools/bundle-edge-function.mjs " + name,
    "",
    ...sharedParts,
    "",
    indexSource.trim(),
    "",
  ].join("\n");

  fs.mkdirSync(DEPLOY_DIR, { recursive: true });
  const outPath = path.join(DEPLOY_DIR, `${name}.ts`);
  fs.writeFileSync(outPath, bundled, "utf8");
  console.log(`✓ ${name} → ${path.relative(ROOT, outPath)}`);
  return outPath;
}

const arg = process.argv[2];

if (!arg) {
  console.error("사용법: node tools/bundle-edge-function.mjs <함수명|--all>");
  process.exit(1);
}

if (arg === "--all") {
  for (const name of FUNCTIONS_WITH_SHARED) {
    bundleFunction(name);
  }
} else {
  bundleFunction(arg);
}
