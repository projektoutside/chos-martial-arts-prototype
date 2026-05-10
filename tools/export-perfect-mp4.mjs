import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.slice(1));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FFMPEG = path.join(ROOT, '.export-tools', 'python', 'imageio_ffmpeg', 'binaries', 'ffmpeg-win-x86_64-v7.1.exe');
const SERVER_ORIGIN = process.env.CHO_LOADER_ORIGIN || 'http://127.0.0.1:8123';
const OUTPUT = process.env.CHO_LOADER_OUTPUT
  ? path.resolve(ROOT, process.env.CHO_LOADER_OUTPUT)
  : path.join(ROOT, 'exports', 'Cho-Martial-Arts-Animation-Perfect.mp4');
const WIDTH = Number(process.env.CHO_LOADER_WIDTH || 1280);
const HEIGHT = Number(process.env.CHO_LOADER_HEIGHT || 720);
const FPS = Number(process.env.CHO_LOADER_FPS || 60);
const DURATION_SECONDS = 3;
const FRAME_COUNT = FPS * DURATION_SECONDS;
const FRAME_DIR = path.join(ROOT, 'exports', 'perfect-frames');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
    server.on('error', reject);
  });
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} from ${url}`);
  }
  return response.json();
}

class CdpPage {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) {
        return;
      }
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) {
        reject(new Error(JSON.stringify(message.error)));
      } else {
        resolve(message.result);
      }
    };
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.ws.send(JSON.stringify({ id, method, params }));
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  close() {
    this.ws.close();
  }
}

async function connectToChrome(chromeProcess, port) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await getJson(`http://127.0.0.1:${port}/json/version`);
      break;
    } catch {
      await wait(100);
    }
  }

  const tabs = await getJson(`http://127.0.0.1:${port}/json/list`);
  const pageTarget = tabs.find((tab) => tab.type === 'page');
  if (!pageTarget) {
    chromeProcess.kill();
    throw new Error('No Chrome page target was available for frame export.');
  }

  const page = new CdpPage(pageTarget.webSocketDebuggerUrl);
  await page.open();
  return page;
}

async function waitForFunction(page, functionName) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await page.send('Runtime.evaluate', {
      expression: `typeof window.${functionName}`,
      returnByValue: true
    });
    if (result.result.value === 'function') {
      return;
    }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${functionName}.`);
}

async function exportFrames() {
  const port = await findFreePort();
  const profile = path.join(process.env.TEMP || ROOT, `cho-loader-frame-export-${Date.now()}`);
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--no-first-run',
    '--no-default-browser-check',
    `--window-size=${WIDTH},${HEIGHT}`,
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    `${SERVER_ORIGIN}/export-mp4.html`
  ], {
    stdio: ['ignore', 'ignore', 'pipe']
  });

  let page;
  try {
    page = await connectToChrome(chrome, port);
    await page.send('Runtime.enable');
    await page.send('Page.enable');
    await page.send('Page.navigate', {
      url: `${SERVER_ORIGIN}/export-mp4.html?frames=${Date.now()}`
    });
    await waitForFunction(page, 'renderChoLoaderFramePng');

    await mkdir(FRAME_DIR, { recursive: true });
    const resolvedFrameDir = path.resolve(FRAME_DIR);
    const resolvedExports = path.resolve(ROOT, 'exports');
    if (!resolvedFrameDir.startsWith(resolvedExports)) {
      throw new Error(`Refusing to clear unexpected frame directory: ${resolvedFrameDir}`);
    }
    await rm(FRAME_DIR, { recursive: true, force: true });
    await mkdir(FRAME_DIR, { recursive: true });

    for (let index = 0; index < FRAME_COUNT; index += 1) {
      const timeMs = (index / FPS) * 1000;
      const expression = `window.renderChoLoaderFramePng({
        width: ${WIDTH},
        height: ${HEIGHT},
        timeMs: ${timeMs.toFixed(4)},
        background: 'dark'
      })`;
      const result = await page.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
        timeout: 15000
      });
      if (result.exceptionDetails) {
        throw new Error(JSON.stringify(result.exceptionDetails));
      }
      const base64 = result.result.value;
      const filename = path.join(FRAME_DIR, `frame_${String(index).padStart(4, '0')}.png`);
      await writeFile(filename, Buffer.from(base64, 'base64'));
      if (index % 30 === 0) {
        console.log(`rendered ${index + 1}/${FRAME_COUNT} frames`);
      }
    }
  } finally {
    page?.close();
    chrome.kill();
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(FFMPEG, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    ffmpeg.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(stderr);
      } else {
        reject(new Error(stderr));
      }
    });
  });
}

async function encodeMp4() {
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  const inputPattern = path.join(FRAME_DIR, 'frame_%04d.png');
  await runFfmpeg([
    '-y',
    '-framerate', String(FPS),
    '-i', inputPattern,
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '12',
    '-profile:v', 'high',
    '-pix_fmt', 'yuv420p',
    '-r', String(FPS),
    '-movflags', '+faststart',
    '-video_track_timescale', String(FPS * 1000),
    OUTPUT
  ]);
}

async function probeMp4() {
  const stderr = await runFfmpeg([
    '-hide_banner',
    '-i', OUTPUT,
    '-f', 'null',
    '-'
  ]).catch((error) => error.message);

  const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  const videoMatch = stderr.match(/Video:\s*[^,]+,[^,]+,\s*(\d+)x(\d+)/);
  return {
    output: OUTPUT,
    width: videoMatch ? Number(videoMatch[1]) : WIDTH,
    height: videoMatch ? Number(videoMatch[2]) : HEIGHT,
    fps: FPS,
    expectedFrames: FRAME_COUNT,
    duration: durationMatch
      ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
      : null
  };
}

async function main() {
  console.log(`rendering ${FRAME_COUNT} frames at ${WIDTH}x${HEIGHT}, ${FPS}fps`);
  await exportFrames();
  console.log('encoding high-quality MP4');
  await encodeMp4();
  console.log(JSON.stringify(await probeMp4(), null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
