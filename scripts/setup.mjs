import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const venvPython = isWindows
  ? path.join(root, ".venv", "Scripts", "python.exe")
  : path.join(root, ".venv", "bin", "python");
const clientDir = path.join(root, "client");

function fail(message) {
  console.error("");
  console.error(message);
  process.exit(1);
}

function step(number, message) {
  console.log("");
  console.log(`${number}. ${message}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    env: options.env || process.env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) {
    fail(`Could not run ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const shown = [command, ...args].join(" ");
    fail(
      `"${shown}" failed. Scroll up for the error, fix it, and run npm run setup again.`,
    );
  }
}

function pythonCandidates() {
  const candidates = [];
  if (isWindows) candidates.push({ command: "py", args: ["-3"] });
  candidates.push({ command: "python3", args: [] });
  candidates.push({ command: "python", args: [] });
  return candidates;
}

function readPythonVersion(candidate) {
  const result = spawnSync(
    candidate.command,
    [
      ...candidate.args,
      "-c",
      "import sys; print('%d.%d.%d' % sys.version_info[:3])",
    ],
    { encoding: "utf8", windowsHide: true },
  );
  if (result.error || result.status !== 0) return null;
  const version = (result.stdout || "").trim().split(/\s+/)[0];
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return null;
  return {
    version,
    major: Number(match[1]),
    minor: Number(match[2]),
  };
}

function findPython() {
  let tooOld = null;
  for (const candidate of pythonCandidates()) {
    const found = readPythonVersion(candidate);
    if (!found) continue;
    if (found.major > 3 || (found.major === 3 && found.minor >= 10)) {
      return { ...candidate, version: found.version };
    }
    tooOld = found.version;
  }
  return { missing: true, tooOld };
}

function printPythonHelp(found) {
  if (found.tooOld) {
    console.error(
      `Python ${found.tooOld} is installed, but this app needs Python 3.10 or newer.`,
    );
  } else {
    console.error("Python 3.10 or newer was not found on this computer.");
  }
  console.error(
    "Install it from https://www.python.org/downloads/ and then run npm run setup again.",
  );
}

function databaseUserCount(env) {
  const probe = spawnSync(
    venvPython,
    [
      "-c",
      [
        "from sqlalchemy import func, select",
        "from server.app import app",
        "from server.models import User, db",
        "with app.app_context():",
        "    count = db.session.scalar(select(func.count()).select_from(User))",
        "    print(0 if count is None else count)",
      ].join("\n"),
    ],
    { cwd: root, env, encoding: "utf8", windowsHide: true },
  );
  if (probe.error || probe.status !== 0) {
    if (probe.stdout) console.error(probe.stdout);
    if (probe.stderr) console.error(probe.stderr);
    fail("Could not check whether the database already has data.");
  }
  const lines = (probe.stdout || "").trim().split(/\r?\n/).filter(Boolean);
  const count = Number(lines[lines.length - 1]);
  if (!Number.isInteger(count) || count < 0) {
    fail("Could not check whether the database already has data.");
  }
  return count;
}

step(1, "Checking for Python 3.10 or newer...");
const python = findPython();
if (python.missing) {
  printPythonHelp(python);
  process.exit(1);
}
console.log(`   Found Python ${python.version} (${python.command}).`);

step(2, "Creating the Python environment (.venv)...");
if (existsSync(venvPython)) {
  console.log("   Already created, so this step was skipped.");
} else {
  run(python.command, [...python.args, "-m", "venv", path.join(root, ".venv")]);
  if (!existsSync(venvPython)) {
    fail(`Python environment was created, but ${venvPython} is missing.`);
  }
  console.log("   Created .venv.");
}

step(3, "Installing Python packages...");
run(venvPython, ["-m", "pip", "install", "-r", "server/requirements.txt"]);

step(4, "Installing and building the website...");
const npm = isWindows ? "npm.cmd" : "npm";
run(npm, ["install"], { cwd: clientDir });
run(npm, ["run", "build"], { cwd: clientDir });

step(5, "Preparing the database...");
const env = { ...process.env, FLASK_APP: "server.app" };
run(venvPython, ["-m", "flask", "db", "upgrade"], { env });
const users = databaseUserCount(env);
if (users === 0) {
  console.log("   Database is empty. Adding demo data...");
  run(venvPython, ["-m", "server.seed"], { env });
} else {
  console.log("   Database already has data, so demo data was left as-is.");
}

console.log("");
console.log(
  "Done! Run: npm start, then open http://localhost:5555  (demo login shown below)",
);
console.log("");
console.log("  Username: demo");
console.log("  Password: password123");
console.log("");
