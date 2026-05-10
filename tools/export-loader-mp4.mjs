import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.slice(1));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SERVER_ORIGIN = process.env.CHO_LOADER_ORIGIN || 'http://127.0.0.1:8123';
const OUTPUT = process.env.CHO_LOADER_OUTPUT
  ? path.resolve(ROOT, process.env.CHO_LOADER_OUTPUT)
  : path.join(ROOT, 'exports', 'chos-martial-arts-loader.mp4');
const WIDTH = Number(process.env.CHO_LOADER_WIDTH || 1280);
const HEIGHT = Number(process.env.CHO_LOADER_HEIGHT || 720);
const FPS = Number(process.env.CHO_LOADER_FPS || 60);
const VIDEO_BITRATE = Number(process.env.CHO_LOADER_BITRATE || 14000000);
const DURATION_MS = 3000;
const OUTPUT_URL_PATH = path.relative(ROOT, OUTPUT).replaceAll(path.sep, '/');

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

function readU32(buffer, offset) {
  return buffer.readUInt32BE(offset);
}

function writeU32(buffer, offset, value) {
  buffer.writeUInt32BE(value, offset);
}

function writeU64(buffer, offset, value) {
  const next = BigInt(value);
  buffer.writeBigUInt64BE(next, offset);
}

function walkBoxes(buffer, start, end, callback) {
  let offset = start;
  while (offset + 8 <= end) {
    let size = readU32(buffer, offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    let headerSize = 8;
    if (size === 1) {
      size = Number(buffer.readBigUInt64BE(offset + 8));
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < headerSize || offset + size > end) {
      break;
    }

    callback({ offset, size, type, headerSize });

    if (['moov', 'trak', 'mdia', 'minf', 'stbl', 'mvex', 'moof', 'traf', 'mfra'].includes(type)) {
      walkBoxes(buffer, offset + headerSize, offset + size, callback);
    }
    offset += size;
  }
}

function normalizeMp4Duration(buffer, targetSeconds) {
  let movieTimescale = 1000;
  let mediaTimescale = 30000;
  const trunDurationOffsets = [];

  walkBoxes(buffer, 0, buffer.length, ({ offset, size, type }) => {
    const payload = offset + 8;
    const version = buffer[payload];

    if (type === 'mvhd') {
      if (version === 1) {
        movieTimescale = readU32(buffer, payload + 20);
        writeU64(buffer, payload + 24, Math.round(targetSeconds * movieTimescale));
      } else {
        movieTimescale = readU32(buffer, payload + 12);
        writeU32(buffer, payload + 16, Math.round(targetSeconds * movieTimescale));
      }
    }

    if (type === 'tkhd') {
      if (version === 1) {
        writeU64(buffer, payload + 28, Math.round(targetSeconds * movieTimescale));
      } else {
        writeU32(buffer, payload + 20, Math.round(targetSeconds * movieTimescale));
      }
    }

    if (type === 'mdhd') {
      if (version === 1) {
        mediaTimescale = readU32(buffer, payload + 20);
        writeU64(buffer, payload + 24, Math.round(targetSeconds * mediaTimescale));
      } else {
        mediaTimescale = readU32(buffer, payload + 12);
        writeU32(buffer, payload + 16, Math.round(targetSeconds * mediaTimescale));
      }
    }

    if (type === 'trun') {
      const flags = (buffer[payload + 1] << 16) | (buffer[payload + 2] << 8) | buffer[payload + 3];
      const sampleCount = readU32(buffer, payload + 4);
      let cursor = payload + 8;
      if (flags & 0x1) cursor += 4;
      if (flags & 0x4) cursor += 4;

      for (let index = 0; index < sampleCount; index += 1) {
        if (flags & 0x100) {
          trunDurationOffsets.push(cursor);
          cursor += 4;
        }
        if (flags & 0x200) cursor += 4;
        if (flags & 0x400) cursor += 4;
        if (flags & 0x800) cursor += 4;
      }

      if (cursor > offset + size) {
        throw new Error('Invalid trun sample table while normalizing MP4 duration.');
      }
    }
  });

  if (trunDurationOffsets.length > 0) {
    const targetMediaDuration = Math.round(targetSeconds * mediaTimescale);
    const currentDurations = trunDurationOffsets.map((offset) => readU32(buffer, offset));
    const currentTotal = currentDurations.reduce((sum, duration) => sum + duration, 0);
    if (currentTotal > 0) {
      let adjustedTotal = 0;
      currentDurations.forEach((duration, index) => {
        const adjusted = index === currentDurations.length - 1
          ? targetMediaDuration - adjustedTotal
          : Math.max(1, Math.round((duration / currentTotal) * targetMediaDuration));
        adjustedTotal += adjusted;
        writeU32(buffer, trunDurationOffsets[index], adjusted);
      });
    }
  }

  return buffer;
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
    this.nextId += 1;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  close() {
    this.ws.close();
  }
}

async function connectToChrome(chromeProcess, port) {
  const versionUrl = `http://127.0.0.1:${port}/json/version`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      await getJson(versionUrl);
      break;
    } catch {
      await wait(100);
    }
  }

  const tabs = await getJson(`http://127.0.0.1:${port}/json/list`);
  const pageTarget = tabs.find((tab) => tab.type === 'page');
  if (!pageTarget) {
    chromeProcess.kill();
    throw new Error('No Chrome page target was available for MP4 export.');
  }

  const page = new CdpPage(pageTarget.webSocketDebuggerUrl);
  await page.open();
  return page;
}

async function waitForLoad(page) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await page.send('Runtime.evaluate', {
      expression: 'document.readyState',
      returnByValue: true
    });
    if (result.result.value === 'complete') {
      return;
    }
    await wait(100);
  }
  throw new Error('Timed out waiting for export page to load.');
}

async function waitForRecorder(page) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await page.send('Runtime.evaluate', {
      expression: 'typeof window.recordChoLoaderMp4',
      returnByValue: true
    });
    if (result.result.value === 'function') {
      return;
    }
    await wait(100);
  }
  throw new Error('Timed out waiting for recordChoLoaderMp4 to become available.');
}

async function main() {
  const port = await findFreePort();
  const profile = path.join(process.env.TEMP || ROOT, `cho-loader-chrome-${Date.now()}`);
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--no-first-run',
    '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    `--window-size=${WIDTH},${HEIGHT}`,
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    `${SERVER_ORIGIN}/export-mp4.html`
  ], {
    stdio: ['ignore', 'ignore', 'pipe']
  });

  let stderr = '';
  chrome.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  let page;
  try {
    page = await connectToChrome(chrome, port);
    await page.send('Runtime.enable');
    await page.send('Page.enable');
    await page.send('Page.navigate', {
      url: `${SERVER_ORIGIN}/export-mp4.html?export=${Date.now()}`
    });
    await waitForLoad(page);
    await waitForRecorder(page);

    const expression = `window.recordChoLoaderMp4({
      width: ${WIDTH},
      height: ${HEIGHT},
      fps: ${FPS},
      durationMs: ${DURATION_MS},
      background: 'dark',
      mimeType: 'video/mp4;codecs=avc1.42E01E',
      stopDelayMs: Number(${JSON.stringify(process.env.CHO_LOADER_STOP_DELAY_MS || '65')}),
      videoBitsPerSecond: ${VIDEO_BITRATE}
    })`;

    const exportResult = await page.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      timeout: 20000
    });

    if (exportResult.exceptionDetails) {
      throw new Error(JSON.stringify(exportResult.exceptionDetails));
    }

    const payload = exportResult.result.value;
    if (!payload?.base64) {
      throw new Error('MP4 export did not return video data.');
    }

    await mkdir(path.dirname(OUTPUT), { recursive: true });
    const mp4Buffer = normalizeMp4Duration(Buffer.from(payload.base64, 'base64'), DURATION_MS / 1000);
    await writeFile(OUTPUT, mp4Buffer);

    const metadataResult = await page.send('Runtime.evaluate', {
      expression: `new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = '${SERVER_ORIGIN}/${OUTPUT_URL_PATH}?verify=' + Date.now();
        video.onloadedmetadata = () => resolve({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight
        });
        video.onerror = () => reject(new Error('Unable to read exported MP4 metadata'));
      })`,
      awaitPromise: true,
      returnByValue: true,
      timeout: 10000
    });

    if (metadataResult.exceptionDetails) {
      throw new Error(JSON.stringify(metadataResult.exceptionDetails));
    }

    console.log(JSON.stringify({
      output: OUTPUT,
      bytes: (await readFile(OUTPUT)).byteLength,
      width: payload.width,
      height: payload.height,
      fps: payload.fps,
      mimeType: payload.mimeType,
      expectedDurationSeconds: DURATION_MS / 1000,
      metadata: metadataResult.result.value
    }, null, 2));
  } finally {
    page?.close();
    chrome.kill();
    await rm(profile, { recursive: true, force: true }).catch(() => {});
    if (stderr.includes('ERROR') && process.env.CHO_LOADER_DEBUG) {
      console.error(stderr);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
