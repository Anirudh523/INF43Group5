import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const coverageDir = path.join(serverDir, ".coverage", "integration");
const filesToReport = new Map([
  ["app.js", path.join(serverDir, "app.js")],
  ["auth.js", path.join(serverDir, "auth.js")],
  ["store.js", path.join(serverDir, "store.js")],
]);

await rm(coverageDir, { recursive: true, force: true });
await mkdir(coverageDir, { recursive: true });

const testResult = await run(process.execPath, ["--test", "tests/api.integration.test.js"], {
  cwd: serverDir,
  env: { ...process.env, NODE_V8_COVERAGE: coverageDir },
});

if (testResult.code !== 0) {
  process.stdout.write(testResult.stdout);
  process.stderr.write(testResult.stderr);
  process.exit(testResult.code ?? 1);
}

const coverage = await collectCoverage();
const rows = [];

for (const [label, absolutePath] of filesToReport) {
  const script = coverage.get(pathToFileUrl(absolutePath));
  if (!script) {
    rows.push({ file: label, linePct: 0, funcsPct: 0, coveredLines: 0, totalLines: 0, coveredFuncs: 0, totalFuncs: 0 });
    continue;
  }
  rows.push(await summarizeScript(label, absolutePath, script));
}

printSummary(rows);

function run(command, args, options) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function collectCoverage() {
  const coverageFiles = (await readdir(coverageDir))
    .filter((name) => name.startsWith("coverage-") && name.endsWith(".json"));
  const scripts = new Map();

  for (const file of coverageFiles) {
    const raw = JSON.parse(await readFile(path.join(coverageDir, file), "utf8"));
    for (const result of raw.result ?? []) {
      if (!filesToReportHasUrl(result.url)) continue;
      const existing = scripts.get(result.url);
      scripts.set(result.url, existing ? mergeScript(existing, result) : result);
    }
  }

  return scripts;
}

function filesToReportHasUrl(url) {
  for (const absolutePath of filesToReport.values()) {
    if (url === pathToFileUrl(absolutePath)) return true;
  }
  return false;
}

function mergeScript(a, b) {
  return {
    ...a,
    functions: a.functions.map((fn, i) => ({
      ...fn,
      ranges: fn.ranges.map((range, j) => ({
        ...range,
        count: range.count + (b.functions[i]?.ranges[j]?.count ?? 0),
      })),
    })),
  };
}

async function summarizeScript(label, absolutePath, script) {
  const source = await readFile(absolutePath, "utf8");
  const lineOffsets = getLineOffsets(source);
  const executableLines = getExecutableLines(source);
  const coveredLines = new Set();
  const uncoveredLines = new Set();
  const functions = script.functions.filter((fn) => !isTopLevelFunction(fn, source.length));

  for (const fn of functions) {
    for (const range of fn.ranges) {
      for (const line of linesTouchedByRange(lineOffsets, range.startOffset, range.endOffset)) {
        if (!executableLines.has(line)) continue;
        if (range.count > 0) {
          coveredLines.add(line);
        } else {
          uncoveredLines.add(line);
        }
      }
    }
  }
  for (const line of uncoveredLines) coveredLines.delete(line);

  const coveredFuncs = functions.filter((fn) => fn.ranges.some((range) => range.count > 0)).length;

  return {
    file: label,
    linePct: pct(coveredLines.size, executableLines.size),
    funcsPct: pct(coveredFuncs, functions.length),
    coveredLines: coveredLines.size,
    totalLines: executableLines.size,
    coveredFuncs,
    totalFuncs: functions.length,
  };
}

function getLineOffsets(source) {
  const offsets = [0];
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === "\n") offsets.push(i + 1);
  }
  return offsets;
}

function getExecutableLines(source) {
  const lines = source.split(/\r?\n/);
  const executable = new Set();
  let inBlockComment = false;

  lines.forEach((line, index) => {
    let trimmed = line.trim();
    if (!trimmed) return;
    if (inBlockComment) {
      if (trimmed.includes("*/")) inBlockComment = false;
      return;
    }
    if (trimmed.startsWith("/*")) {
      if (!trimmed.includes("*/")) inBlockComment = true;
      return;
    }
    if (trimmed.startsWith("*") || trimmed.startsWith("//")) return;
    if (["{", "}", "});", "};", ");"].includes(trimmed)) return;
    executable.add(index + 1);
  });

  return executable;
}

function linesTouchedByRange(lineOffsets, startOffset, endOffset) {
  const lines = [];
  for (let i = 0; i < lineOffsets.length; i += 1) {
    const lineStart = lineOffsets[i];
    const lineEnd = lineOffsets[i + 1] ?? Number.POSITIVE_INFINITY;
    if (lineEnd <= startOffset) continue;
    if (lineStart >= endOffset) break;
    lines.push(i + 1);
  }
  return lines;
}

function isTopLevelFunction(fn, sourceLength) {
  return (
    fn.functionName === "" &&
    fn.ranges.length === 1 &&
    fn.ranges[0].startOffset === 0 &&
    fn.ranges[0].endOffset >= sourceLength - 1
  );
}

function pct(covered, total) {
  return total === 0 ? 100 : Number(((covered / total) * 100).toFixed(2));
}

function pathToFileUrl(absolutePath) {
  return new URL(`file:///${absolutePath.replace(/\\/g, "/")}`).href;
}

function printSummary(rows) {
  const totalCoveredLines = rows.reduce((sum, row) => sum + row.coveredLines, 0);
  const totalLines = rows.reduce((sum, row) => sum + row.totalLines, 0);
  const totalCoveredFuncs = rows.reduce((sum, row) => sum + row.coveredFuncs, 0);
  const totalFuncs = rows.reduce((sum, row) => sum + row.totalFuncs, 0);

  console.log("Integration coverage from API integration tests");
  console.log("------------------------------------------------");
  console.log("file     | line % | funcs % | covered lines | covered funcs");
  console.log("------------------------------------------------");
  for (const row of rows) {
    console.log(
      `${row.file.padEnd(8)} | ${String(row.linePct).padStart(6)} | ${String(row.funcsPct).padStart(7)} | ${`${row.coveredLines}/${row.totalLines}`.padStart(13)} | ${`${row.coveredFuncs}/${row.totalFuncs}`.padStart(13)}`,
    );
  }
  console.log("------------------------------------------------");
  console.log(
    `${"all".padEnd(8)} | ${String(pct(totalCoveredLines, totalLines)).padStart(6)} | ${String(pct(totalCoveredFuncs, totalFuncs)).padStart(7)} | ${`${totalCoveredLines}/${totalLines}`.padStart(13)} | ${`${totalCoveredFuncs}/${totalFuncs}`.padStart(13)}`,
  );
}
