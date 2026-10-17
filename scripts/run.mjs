import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const venvPython = isWindows
  ? path.join(root, ".venv", "Scripts", "python.exe")
  : path.join(root, ".venv", "bin", "python");
const command = process.argv[2];

if (command !== "start" && command !== "dev") {
  console.error("Usage: node scripts/run.mjs <start|dev>");
  process.exit(1);
}

if (!existsSync(venvPython)) {
  console.error("The app is not set up yet.");
  console.error("From this folder, run: npm run setup");
  process.exit(1);
}

if (
  command === "start" &&
  !existsSync(path.join(root, "client", "dist", "index.html"))
) {
  console.error("The website has not been built yet.");
  console.error("From this folder, run: npm run setup");
  process.exit(1);
}

const children = [];
let shuttingDown = false;

function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode) return;
  if (isWindows) {
    spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (children.length === 0) process.exit(code);
  let remaining = children.length;
  for (const child of children) {
    child.once("exit", () => {
      remaining -= 1;
      if (remaining <= 0) process.exit(code);
    });
    stopChild(child);
  }
  setTimeout(() => process.exit(code), 2000).unref();
}

function startProcess(commandName, args, options = {}) {
  const child = spawn(commandName, args, {
    cwd: options.cwd || root,
    env: options.env || process.env,
    stdio: "inherit",
    windowsHide: true,
    detached: !isWindows,
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(`Could not run ${commandName}: ${error.message}`);
    shutdown(1);
  });
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    const status = signal || code || 0;
    if (children.length > 1) {
      console.error(`${commandName} stopped (${status}). Stopping the other process.`);
    }
    shutdown(code ?? 0);
  });
  return child;
}

const flaskEnv = { ...process.env, FLASK_APP: "server.app" };
const flaskArgs = ["-m", "flask", "run", "--host", "127.0.0.1", "--port", "5000"];

if (command === "start") {
  console.log("Starting Crew Job Tracker at http://localhost:5000");
  console.log("Demo login: demo / password123");
  console.log("Press Ctrl+C to stop.");
  startProcess(venvPython, flaskArgs, { env: flaskEnv });
} else {
  console.log("Starting the API at http://localhost:5000");
  console.log("Starting the website dev server. Vite will print its address.");
  console.log("Press Ctrl+C to stop both.");
  startProcess(venvPython, flaskArgs, { env: flaskEnv });
  const npm = isWindows ? "npm.cmd" : "npm";
  startProcess(npm, ["run", "dev"], { cwd: path.join(root, "client") });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
