#!/usr/bin/env npx ts-node
/**
 * Channel Tree Example
 *
 * Displays a live tree of channels and users in a Mumble server.
 * Optionally bridges audio to a Discord voice channel.
 *
 * Usage: npx ts-node examples/channel-tree.ts <host> [username] [password] [--discord token guildId channelId]
 */

// Suppress noisy Node.js warnings from discord.js internals
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  // Suppress TimeoutNegativeWarning from discord.js
  if (warning.name === 'TimeoutNegativeWarning') return;
  if (warning.message?.includes('Negative')) return;
  console.warn(warning);
});

import * as blessed from 'blessed';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { MumbleClient, MumbleChannel, MumbleUser, RejectType } from '../src';

// Discord imports (optional feature)
import { Client, GatewayIntentBits, Events } from 'discord.js';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  StreamType,
  entersState,
  VoiceConnection,
  AudioPlayer as DiscordAudioPlayer,
} from '@discordjs/voice';

// Opus decoder for Discord streaming
const OpusScript = require('opusscript');

// Opus encoder for microphone (native bindings - OpusScript has encoding issues)
const { Encoder: OpusEncoder } = require('@evan/opus');

// Speaker for local audio output (when Discord not configured)
// Using @mastra/node-speaker fork which fixes CoreAudio buffer underflow warnings
const Speaker = require('@mastra/node-speaker');

// Microphone for push-to-talk - use child_process directly for better buffer control
import { spawn, ChildProcess } from 'child_process';

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const BIT_DEPTH = 16;

// Error log file
const logFile = path.join(__dirname, '..', 'error.log');

function logError(label: string, error: unknown): void {
  const timestamp = new Date().toISOString();
  const message = error instanceof Error
    ? `${error.message}\n${error.stack}`
    : String(error);
  const entry = `[${timestamp}] ${label}\n${message}\n\n`;
  fs.appendFileSync(logFile, entry);
}

function logDebug(message: string): void {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFile, `[${timestamp}] DEBUG: ${message}\n`);
}

// Clear log file on start
fs.writeFileSync(logFile, `=== Mumble.js Error Log - ${new Date().toISOString()} ===\n\n`);

// Global error handlers for full stack traces
process.on('uncaughtException', (error) => {
  logError('UNCAUGHT EXCEPTION', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logError('UNHANDLED REJECTION', reason);
});

// Parse command line arguments
const args = process.argv.slice(2);

// Check for --discord flag
const discordIndex = args.indexOf('--discord');
let discordConfig: { token: string; guildId: string; channelId: string } | null = null;

if (discordIndex !== -1) {
  const discordArgs = args.splice(discordIndex, 4); // Remove --discord and its 3 args
  if (discordArgs.length < 4) {
    console.error('Error: --discord requires 3 arguments: token guildId channelId');
    process.exit(1);
  }
  discordConfig = {
    token: discordArgs[1],
    guildId: discordArgs[2],
    channelId: discordArgs[3],
  };
}

if (args.length < 1) {
  console.error('Usage: npx ts-node examples/channel-tree.ts <host[:port]> [username] [password] [--discord token guildId channelId]');
  console.error('');
  console.error('Examples:');
  console.error('  npx ts-node examples/channel-tree.ts mumble.example.com MyBot');
  console.error('  npx ts-node examples/channel-tree.ts mumble.example.com MyBot password --discord BOT_TOKEN 123456 789012');
  process.exit(1);
}

const [hostPort, username = 'MumbleJS-Bot', password] = args;
const [host, portStr] = hostPort.split(':');
const port = portStr ? parseInt(portStr, 10) : 64738;

// Per-user decoder entry
interface UserDecoder {
  decoder: any;
  lastTime: number;
}

// Discord audio stream - decodes Opus from Mumble and provides PCM to Discord
// Uses per-user decoders since Opus is stateful
class DiscordAudioStream extends Readable {
  private decoders = new Map<number, UserDecoder>();
  private buffer: Buffer[] = [];
  private isReading = false;

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  private getDecoder(session: number): any {
    let entry = this.decoders.get(session);
    if (!entry) {
      entry = {
        decoder: new OpusScript(SAMPLE_RATE, 1, OpusScript.Application.AUDIO),
        lastTime: Date.now(),
      };
      this.decoders.set(session, entry);
    }
    entry.lastTime = Date.now();
    return entry.decoder;
  }

  pushOpusPacket(session: number, opusData: Buffer): void {
    try {
      const decoder = this.getDecoder(session);
      const pcmMono = decoder.decode(opusData);
      if (pcmMono && pcmMono.length > 0) {
        // Convert mono to stereo for Discord
        const monoSamples = pcmMono.length / 2;
        const stereoBuffer = Buffer.alloc(monoSamples * 4);
        for (let i = 0; i < monoSamples; i++) {
          const sample = pcmMono.readInt16LE ? pcmMono.readInt16LE(i * 2) :
                         (pcmMono[i * 2] | (pcmMono[i * 2 + 1] << 8));
          const signedSample = sample > 32767 ? sample - 65536 : sample;
          stereoBuffer.writeInt16LE(signedSample, i * 4);
          stereoBuffer.writeInt16LE(signedSample, i * 4 + 2);
        }
        this.buffer.push(stereoBuffer);

        if (this.isReading && this.buffer.length > 0) {
          this.isReading = false;
          const chunk = this.buffer.shift();
          if (chunk) {
            this.push(chunk);
          }
        }
      }
    } catch (err) {
      logError('Discord decode opus', err);
    }
  }

  _read(): void {
    if (this.buffer.length > 0) {
      const chunk = this.buffer.shift();
      if (chunk) {
        this.push(chunk);
      }
    } else {
      this.isReading = true;
    }
  }

  cleanup(): void {
    for (const [, entry] of this.decoders) {
      try { entry.decoder.delete(); } catch {}
    }
    this.decoders.clear();
  }
}

// Discord state
let discordClient: Client | null = null;
let discordConnection: VoiceConnection | null = null;
let discordPlayer: DiscordAudioPlayer | null = null;
let discordAudioStream: DiscordAudioStream | null = null;
let discordPlayerRestarting = false;

// Local speaker state (used when Discord not configured)
let localSpeaker: any = null;
let localSpeakerEnabled = false;
const localDecoders = new Map<number, UserDecoder>();

// Microphone state for push-to-talk
let micProcess: ChildProcess | null = null;
let micEncoder: any = null;
let isTalking = false;
let micSendTimer: NodeJS.Timeout | null = null;
let micTalkStartTime = 0;
let micFrameCount = 0;
// Mumble uses 48kHz - sox will resample from mic's native rate
const MIC_SAMPLE_RATE = 48000;
const MIC_CHANNELS = 1; // Mono input
// Match Mumble: 10ms frames (480 samples), buffer 2 frames before encoding (20ms packets)
const MIC_FRAME_SIZE = 480; // 10ms at 48kHz (48000 * 0.010 = 480)
const MIC_FRAMES_PER_PACKET = 2; // Encode 2 frames (20ms) per Opus packet
const MIC_ENCODE_SIZE = MIC_FRAME_SIZE * MIC_FRAMES_PER_PACKET; // 960 samples for encoding
const MIC_BYTES_PER_SAMPLE = 2; // 16-bit
const MIC_FRAME_BYTES = MIC_FRAME_SIZE * MIC_CHANNELS * MIC_BYTES_PER_SAMPLE;
const MIC_ENCODE_BYTES = MIC_ENCODE_SIZE * MIC_CHANNELS * MIC_BYTES_PER_SAMPLE;
const MIC_FRAME_DURATION_MS = 20; // 20ms per encoded frame
const MIC_MAX_BUFFER_MS = 150; // Max buffer to prevent latency buildup
let micBuffer = Buffer.alloc(0);

// Channel navigation state
let channelList: MumbleChannel[] = [];
let selectedIndex = 0;

// Mouse click state
let lineToChannelIndex: Map<number, number> = new Map();
let lastClickTime = 0;
let lastClickLine = -1;
const DOUBLE_CLICK_THRESHOLD = 300; // ms

// Create blessed screen
const screen = blessed.screen({
  smartCSR: true,
  title: 'Mumble Channel Tree',
});

// Header
const header = blessed.box({
  top: 0,
  left: 0,
  width: '100%',
  height: 3,
  content: '{center}{bold}Mumble Channel Tree{/bold}{/center}',
  tags: true,
  border: {
    type: 'line',
  },
  style: {
    fg: 'white',
    border: {
      fg: 'cyan',
    },
  },
});

// Connection status
const statusBox = blessed.box({
  top: 3,
  left: 0,
  width: '100%',
  height: 3,
  content: ' Status: Connecting...',
  tags: true,
  border: {
    type: 'line',
  },
  style: {
    fg: 'yellow',
    border: {
      fg: 'gray',
    },
  },
});

// Tree view
const treeBox = blessed.box({
  top: 6,
  left: 0,
  width: '100%',
  height: '100%-14',
  content: '',
  tags: true,
  border: {
    type: 'line',
  },
  scrollable: true,
  alwaysScroll: true,
  scrollbar: {
    ch: ' ',
    track: {
      bg: 'gray',
    },
    style: {
      inverse: true,
    },
  },
  style: {
    fg: 'white',
    border: {
      fg: 'green',
    },
  },
  keys: true,
  mouse: true,
});

// Event log
const logBox = blessed.box({
  bottom: 3,
  left: 0,
  width: '100%',
  height: 5,
  content: '',
  tags: true,
  border: {
    type: 'line',
  },
  scrollable: true,
  alwaysScroll: true,
  style: {
    fg: 'white',
    border: {
      fg: 'blue',
    },
  },
  label: ' Log ',
});

const logMessages: string[] = [];
const MAX_LOG_MESSAGES = 50;

function addLogMessage(message: string): void {
  const timestamp = new Date().toLocaleTimeString();
  logMessages.push(`{gray-fg}[${timestamp}]{/gray-fg} ${message}`);
  if (logMessages.length > MAX_LOG_MESSAGES) {
    logMessages.shift();
  }
  // Show last 3 lines (visible in 5-line box with border)
  const visibleLines = logMessages.slice(-3);
  logBox.setContent(visibleLines.join('\n'));
  screen.render();
}

// Help text
const helpBox = blessed.box({
  bottom: 0,
  left: 0,
  width: '100%',
  height: 3,
  content: ' {bold}j/k{/bold}: Select | {bold}Enter{/bold}: Join | {bold}/{/bold}: Search | {bold}m{/bold}: Push-to-talk | {bold}q{/bold}: Quit',
  tags: true,
  border: {
    type: 'line',
  },
  style: {
    fg: 'gray',
    border: {
      fg: 'gray',
    },
  },
});

screen.append(header);
screen.append(statusBox);
screen.append(treeBox);
screen.append(logBox);
screen.append(helpBox);

// Search UI components (hidden by default)
let searchMode = false;
let searchResults: MumbleChannel[] = [];
let searchSelectedIndex = 0;
let lastSearchQuery = '';

const searchOverlay = blessed.box({
  top: 'center',
  left: 'center',
  width: '60%',
  height: '50%',
  border: {
    type: 'line',
  },
  style: {
    fg: 'white',
    bg: 'black',
    border: {
      fg: 'cyan',
    },
  },
  hidden: true,
});

const searchInput = blessed.textbox({
  parent: searchOverlay,
  top: 0,
  left: 0,
  width: '100%-2',
  height: 3,
  border: {
    type: 'line',
  },
  style: {
    fg: 'white',
    bg: 'black',
    border: {
      fg: 'yellow',
    },
    focus: {
      border: {
        fg: 'green',
      },
    },
  },
  inputOnFocus: true,
});

const searchResultsList = blessed.box({
  parent: searchOverlay,
  top: 3,
  left: 0,
  width: '100%-2',
  height: '100%-5',
  content: '',
  tags: true,
  scrollable: true,
  style: {
    fg: 'white',
    bg: 'black',
  },
});

const searchHelp = blessed.box({
  parent: searchOverlay,
  bottom: 0,
  left: 0,
  width: '100%-2',
  height: 1,
  content: ' {bold}↑/↓{/bold}: Navigate | {bold}Enter{/bold}: Jump | {bold}Esc{/bold}: Close',
  tags: true,
  style: {
    fg: 'gray',
    bg: 'black',
  },
});

screen.append(searchOverlay);

function openSearch(): void {
  searchMode = true;
  searchResults = [...channelList];
  searchSelectedIndex = 0;
  lastSearchQuery = '';
  searchOverlay.hidden = false;
  searchInput.clearValue();
  updateSearchResults('');
  searchInput.focus();
  screen.render();
}

function closeSearch(): void {
  searchMode = false;
  searchOverlay.hidden = true;
  treeBox.focus();
  screen.render();
}

function updateSearchResults(query: string): void {
  const lowerQuery = query.toLowerCase().trim();

  // Filter out root channel (has no parent) - it clutters search results
  const searchableChannels = channelList.filter(ch => ch.parent !== undefined);

  if (lowerQuery === '') {
    searchResults = [...searchableChannels];
  } else {
    searchResults = searchableChannels
      .map(ch => {
        const pathString = getChannelPathString(ch).toLowerCase();
        const score = fuzzyMatch(lowerQuery, pathString);
        return { channel: ch, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.channel);
  }

  // Reset selection to first item when search query changes
  if (lowerQuery !== lastSearchQuery) {
    searchSelectedIndex = 0;
    lastSearchQuery = lowerQuery;
  }

  // Render results with full channel path
  let content = '';
  searchResults.forEach((ch, idx) => {
    const isSelected = idx === searchSelectedIndex;
    const marker = isSelected ? '{bold}{cyan-fg}▶{/cyan-fg}{/bold} ' : '  ';
    const channelPath = getChannelPathHighlighted(ch, lowerQuery);
    content += `${marker}${channelPath}\n`;
  });

  if (searchResults.length === 0) {
    content = '{gray-fg}  No channels found{/gray-fg}';
  }

  searchResultsList.setContent(content);
  screen.render();
}

// Fuzzy match - returns score (0 = no match, higher = better match)
function fuzzyMatch(query: string, target: string): number {
  if (query.length === 0) return 1;
  if (target.length === 0) return 0;

  // Split query into terms by whitespace
  const terms = query.split(/\s+/).filter(t => t.length > 0);
  if (terms.length === 0) return 1;

  // Extract words from target for word-boundary matching
  const words = target.split(/[\s>()]+/).filter(w => w.length > 0);
  const wordsLower = words.map(w => w.toLowerCase());

  // Also create a compressed version without spaces for fuzzy matching "gen1" -> "General 1"
  const targetCompressed = target.toLowerCase().replace(/\s+/g, '');

  let totalScore = 0;

  for (const term of terms) {
    let bestTermScore = 0;

    // Try to match term against each word
    for (let wi = 0; wi < wordsLower.length; wi++) {
      const word = wordsLower[wi];

      // Check if term is a prefix of the word (best match)
      if (word.startsWith(term)) {
        const score = 100 + (term.length * 10) - wi;
        bestTermScore = Math.max(bestTermScore, score);
      }
      // Check if term appears anywhere in word
      else if (word.includes(term)) {
        const score = 50 + (term.length * 5) - wi;
        bestTermScore = Math.max(bestTermScore, score);
      }
    }

    // Try matching against concatenated adjacent words (e.g., "gen1" matches "General" + "1")
    if (bestTermScore < 100) {
      for (let wi = 0; wi < wordsLower.length; wi++) {
        let concat = '';
        for (let wj = wi; wj < wordsLower.length && concat.length < term.length + 10; wj++) {
          concat += wordsLower[wj];
          if (concat.startsWith(term)) {
            const score = 90 + (term.length * 8) - wi;
            bestTermScore = Math.max(bestTermScore, score);
            break;
          }
          if (concat.includes(term)) {
            const score = 40 + (term.length * 4) - wi;
            bestTermScore = Math.max(bestTermScore, score);
          }
        }
      }
    }

    // Fuzzy subsequence match on compressed target
    if (bestTermScore === 0) {
      let termIdx = 0;
      for (let i = 0; i < targetCompressed.length && termIdx < term.length; i++) {
        if (targetCompressed[i] === term[termIdx]) termIdx++;
      }
      if (termIdx === term.length) {
        bestTermScore = 5 + term.length;
      }
    }

    if (bestTermScore === 0) return 0; // Term didn't match anything
    totalScore += bestTermScore;
  }

  return totalScore;
}

function getChannelPathParts(channel: MumbleChannel): string[] {
  const path: string[] = [channel.name];
  let parentId = channel.parent;

  while (parentId !== undefined) {
    const parent = client.getChannel(parentId);
    if (!parent || parent.channelId === channel.channelId) break;
    // Skip root channel (parent === undefined) in the path
    if (parent.parent === undefined) break;
    path.unshift(parent.name);
    if (parent.parent === parent.channelId) break;
    parentId = parent.parent;
  }

  return path;
}

function getChannelPathString(channel: MumbleChannel): string {
  return getChannelPathParts(channel).join(' > ');
}

function getChannelPathHighlighted(channel: MumbleChannel, query: string): string {
  const path = getChannelPathParts(channel);
  const terms = query.split(/\s+/).filter(t => t.length > 0);

  return path.map((name, pathIdx) => {
    const isLast = pathIdx === path.length - 1;
    const nameLower = name.toLowerCase();

    // Check if any term matches this path part
    let hasMatch = false;
    for (const term of terms) {
      if (nameLower.includes(term)) {
        hasMatch = true;
        break;
      }
      // Check fuzzy match
      let termIdx = 0;
      for (let i = 0; i < nameLower.length && termIdx < term.length; i++) {
        if (nameLower[i] === term[termIdx]) termIdx++;
      }
      if (termIdx === term.length) {
        hasMatch = true;
        break;
      }
    }

    if (isLast) {
      return hasMatch
        ? `{green-fg}{bold}# ${name}{/bold}{/green-fg}`
        : `{green-fg}# ${name}{/green-fg}`;
    }
    return hasMatch
      ? `{yellow-fg}{bold}${name}{/bold}{/yellow-fg}`
      : `{white-fg}${name}{/white-fg}`;
  }).join(' {cyan-fg}>{/cyan-fg} ');
}

function getChannelDepth(channel: MumbleChannel): number {
  let depth = 0;
  let parentId = channel.parent;
  while (parentId !== undefined && parentId !== channel.channelId) {
    const parent = client.getChannel(parentId);
    if (!parent || parent.channelId === parentId) break;
    depth++;
    parentId = parent.parent;
  }
  return depth;
}

function selectSearchResult(): void {
  if (searchResults.length > 0 && searchSelectedIndex < searchResults.length) {
    const channel = searchResults[searchSelectedIndex];
    // Find index in main channel list
    const mainIndex = channelList.findIndex(ch => ch.channelId === channel.channelId);
    if (mainIndex !== -1) {
      selectedIndex = mainIndex;
      updateTree();
      scrollToSelected();
    }
    closeSearch();
  }
}

// Search input handlers
searchInput.on('keypress', (_ch: string, key: any) => {
  if (key.name === 'escape') {
    closeSearch();
    return;
  }
  if (key.name === 'enter' || key.name === 'return') {
    selectSearchResult();
    return;
  }
  if (key.name === 'up' || (key.ctrl && key.name === 'p')) {
    searchSelectedIndex = Math.max(0, searchSelectedIndex - 1);
    updateSearchResults(searchInput.getValue());
    return;
  }
  if (key.name === 'down' || (key.ctrl && key.name === 'n')) {
    searchSelectedIndex = Math.min(searchResults.length - 1, searchSelectedIndex + 1);
    updateSearchResults(searchInput.getValue());
    return;
  }
});

searchInput.on('submit', () => {
  selectSearchResult();
});

searchInput.on('cancel', () => {
  closeSearch();
});

// Update results as user types
searchInput.on('keypress', () => {
  // Delay to let the input value update
  setTimeout(() => {
    if (searchMode) {
      updateSearchResults(searchInput.getValue());
    }
  }, 10);
});

// Cleanup function
function quit(): void {
  try {
    client.disconnect();
  } catch (e) {
    // Ignore disconnect errors
  }
  // Discord cleanup
  try {
    if (discordAudioStream) discordAudioStream.cleanup();
    if (discordConnection) discordConnection.destroy();
    if (discordClient) discordClient.destroy();
  } catch (e) {
    // Ignore Discord cleanup errors
  }
  // Local speaker cleanup
  try {
    if (localSpeaker) {
      localSpeaker.end();
      localSpeaker = null;
    }
    for (const [, entry] of localDecoders) {
      try { entry.decoder.delete(); } catch {}
    }
    localDecoders.clear();
  } catch (e) {
    // Ignore local speaker cleanup errors
  }
  // Microphone cleanup
  try {
    if (micProcess) {
      micProcess.kill();
      micProcess = null;
    }
    micEncoder = null;
  } catch (e) {
    // Ignore mic cleanup errors
  }
  screen.destroy();
  process.exit(0);
}

// Key bindings
screen.key(['q', 'C-c'], quit);
screen.key(['escape'], () => {
  if (searchMode) {
    closeSearch();
  } else {
    quit();
  }
});

// Search key binding
screen.key(['/'], () => {
  if (!searchMode) {
    openSearch();
  }
});

screen.key(['r'], () => {
  updateTree();
});

// Vim navigation
screen.key(['j', 'down'], () => {
  try {
    if (channelList.length > 0) {
      selectedIndex = Math.min(selectedIndex + 1, channelList.length - 1);
      updateTree();
      scrollToSelected();
    }
  } catch (e) {
    logError('key j/down', e);
  }
});

screen.key(['k', 'up'], () => {
  try {
    if (channelList.length > 0) {
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateTree();
      scrollToSelected();
    }
  } catch (e) {
    logError('key k/up', e);
  }
});

// Page navigation
screen.key(['C-d', 'pagedown'], () => {
  try {
    if (channelList.length > 0) {
      selectedIndex = Math.min(selectedIndex + 10, channelList.length - 1);
      updateTree();
      scrollToSelected();
    }
  } catch (e) {
    logError('key C-d/pagedown', e);
  }
});

screen.key(['C-u', 'pageup'], () => {
  try {
    if (channelList.length > 0) {
      selectedIndex = Math.max(selectedIndex - 10, 0);
      updateTree();
      scrollToSelected();
    }
  } catch (e) {
    logError('key C-u/pageup', e);
  }
});

// Join channel on Enter
screen.key(['enter'], () => {
  try {
    if (channelList.length > 0 && selectedIndex < channelList.length) {
      const channel = channelList[selectedIndex];
      if (channel) {
        client.moveToChannel(channel.channelId);
        setStatus(`Joining "${channel.name}"...`, 'cyan');
      }
    }
  } catch (e) {
    logError('key enter', e);
  }
});

// Push-to-talk: hold 'm' to transmit
screen.on('keypress', (_ch: string, key: any) => {
  if (searchMode) return; // Don't capture while searching

  if (key.name === 'm' && !key.ctrl && !key.meta) {
    if (!isTalking) {
      startTalking();
    }
  }
});

// Detect key release for push-to-talk
// Note: blessed doesn't have native keyup, so we use a timeout approach
let talkKeyTimer: NodeJS.Timeout | null = null;
screen.on('keypress', (_ch: string, key: any) => {
  if (key.name === 'm' && !key.ctrl && !key.meta && isTalking) {
    // Reset timer on each keypress (key repeat)
    if (talkKeyTimer) clearTimeout(talkKeyTimer);
    talkKeyTimer = setTimeout(() => {
      stopTalking();
      talkKeyTimer = null;
    }, 200); // Stop after 200ms of no key repeat
  }
});

// Mouse click support for channel tree
treeBox.on('mouse', (mouse: any) => {
  try {
    // Only handle click events
    if (mouse.action !== 'mousedown') return;

    // Calculate the line number in content (accounting for scroll and border)
    // mouse.y is absolute screen position, need to convert to relative position in box
    const boxAbsTop = (treeBox as any).atop ?? (treeBox as any).top ?? 0;
    const scrollPos = (treeBox as any).childBase || 0;
    const relativeY = mouse.y - boxAbsTop - 1; // -1 for top border
    const contentLine = relativeY + scrollPos;

    logDebug(`Mouse click: y=${mouse.y}, boxTop=${boxAbsTop}, scroll=${scrollPos}, relY=${relativeY}, line=${contentLine}`);

    if (contentLine < 0) return;

    // Check if this line corresponds to a channel
    const clickedChannelIndex = lineToChannelIndex.get(contentLine);
    logDebug(`Line ${contentLine} -> channelIndex ${clickedChannelIndex}, map size=${lineToChannelIndex.size}`);

    if (clickedChannelIndex === undefined) return;

    const now = Date.now();
    const isDoubleClick =
      now - lastClickTime < DOUBLE_CLICK_THRESHOLD &&
      lastClickLine === contentLine;

    if (isDoubleClick) {
      // Double-click: join the channel
      if (channelList.length > 0 && clickedChannelIndex < channelList.length) {
        const channel = channelList[clickedChannelIndex];
        if (channel) {
          client.moveToChannel(channel.channelId);
          setStatus(`Joining "${channel.name}"...`, 'cyan');
        }
      }
      lastClickTime = 0;
      lastClickLine = -1;
    } else {
      // Single-click: highlight the channel
      selectedIndex = clickedChannelIndex;
      updateTree();
      lastClickTime = now;
      lastClickLine = contentLine;
    }
  } catch (e) {
    logError('mouse click', e);
  }
});

// Handle SIGINT (Ctrl+C) at process level too
process.on('SIGINT', quit);
process.on('SIGTERM', quit);

// Create Mumble client with debug logging to file
const client = new MumbleClient({
  host,
  port,
  username,
  password,
  debug: true,
  logger: (msg) => fs.appendFileSync(logFile, msg + '\n'),
});

function setStatus(text: string, color: string = 'yellow'): void {
  statusBox.setContent(` Status: {${color}-fg}${text}{/${color}-fg}`);
  screen.render();
}

function scrollToSelected(): void {
  try {
    // Calculate approximate line position (accounting for users between channels)
    let linePos = 0;
    for (let i = 0; i < selectedIndex && i < channelList.length; i++) {
      const channel = channelList[i];
      if (!channel) continue;
      linePos++; // Channel line
      linePos += client.getUsersInChannel(channel.channelId).length; // User lines
    }

    const boxHeight = typeof treeBox.height === 'number' ? treeBox.height : 20;
    const scrollPos = Math.max(0, linePos - Math.floor((boxHeight - 2) / 2));
    treeBox.setScroll(scrollPos);
  } catch (e) {
    logError('scrollToSelected', e);
  }
}

function buildChannelList(): MumbleChannel[] {
  const list: MumbleChannel[] = [];
  const visited = new Set<number>();

  function addChannel(channel: MumbleChannel): void {
    if (visited.has(channel.channelId)) return;
    visited.add(channel.channelId);

    list.push(channel);

    const subChannels = client.getSubChannels(channel.channelId);
    subChannels.sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      return a.name.localeCompare(b.name);
    });

    for (const sub of subChannels) {
      addChannel(sub);
    }
  }

  const root = client.getRootChannel();
  if (root) {
    addChannel(root);
  }

  return list;
}

function buildTree(): string {
  const channels = client.channels;

  if (channels.size === 0) {
    return '{gray-fg}No channels loaded yet...{/gray-fg}';
  }

  // Build flat channel list for navigation
  channelList = buildChannelList();

  // Ensure selected index is valid
  if (selectedIndex >= channelList.length) {
    selectedIndex = Math.max(0, channelList.length - 1);
  }

  // Track visited channels to prevent cycles
  const visited = new Set<number>();
  let channelIndex = 0;
  let currentLine = 0;

  // Reset line-to-channel mapping
  lineToChannelIndex = new Map();

  // Build channel tree recursively
  function renderChannel(channel: MumbleChannel, indent: number): string {
    if (visited.has(channel.channelId)) return '';
    visited.add(channel.channelId);

    if (indent > 50) return '';

    const currentChannelIndex = channelIndex++;
    const isSelected = currentChannelIndex === selectedIndex;
    const isCurrentChannel = client.self?.channelId === channel.channelId;

    const prefix = '  '.repeat(indent);
    const treeChar = indent === 0 ? '' : '├─ ';
    const channelUsers = client.getUsersInChannel(channel.channelId);
    const subChannels = client.getSubChannels(channel.channelId);

    subChannels.sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      return a.name.localeCompare(b.name);
    });

    let output = '';

    // Map this line to the channel index for mouse clicks
    lineToChannelIndex.set(currentLine, currentChannelIndex);
    currentLine++;

    // Channel name with selection highlight
    const tempFlag = channel.temporary ? ' {yellow-fg}(temp){/yellow-fg}' : '';
    const userCount = channelUsers.length > 0 ? ` {cyan-fg}[${channelUsers.length}]{/cyan-fg}` : '';
    const currentMarker = isCurrentChannel ? ' {magenta-fg}◀{/magenta-fg}' : '';

    if (isSelected) {
      output += `${prefix}${treeChar}{black-fg}{white-bg}{bold}# ${channel.name}{/bold}{/white-bg}{/black-fg}${tempFlag}${userCount}${currentMarker}\n`;
    } else {
      output += `${prefix}${treeChar}{bold}{green-fg}# ${channel.name}{/green-fg}{/bold}${tempFlag}${userCount}${currentMarker}\n`;
    }

    // Users in this channel (these lines don't map to channels)
    for (const user of channelUsers) {
      currentLine++;
      const userPrefix = '  '.repeat(indent + 1);
      const selfMarker = user.session === client.session ? ' {magenta-fg}(you){/magenta-fg}' : '';
      const muteDeaf = getMuteDeafIndicator(user);
      const hash = user.hash ? ` {gray-fg}(${user.hash}){/gray-fg}` : '';
      const speakerIcon = client.isUserSpeaking(user.session) ? '{green-fg}[S]{/green-fg} ' : '    ';
      output += `${userPrefix}├─ ${speakerIcon}{white-fg}${user.name}{/white-fg}${hash}${selfMarker}${muteDeaf}\n`;
    }

    // Sub-channels
    for (const subChannel of subChannels) {
      output += renderChannel(subChannel, indent + 1);
    }

    return output;
  }

  function getMuteDeafIndicator(user: MumbleUser): string {
    const indicators: string[] = [];

    if (user.deaf || user.selfDeaf) {
      indicators.push('{red-fg}D{/red-fg}');
    } else if (user.mute || user.selfMute) {
      indicators.push('{yellow-fg}M{/yellow-fg}');
    }

    if (user.suppress) {
      indicators.push('{gray-fg}S{/gray-fg}');
    }

    if (user.recording) {
      indicators.push('{red-fg}REC{/red-fg}');
    }

    if (user.prioritySpeaker) {
      indicators.push('{cyan-fg}P{/cyan-fg}');
    }

    return indicators.length > 0 ? ` [${indicators.join('')}]` : '';
  }

  // Start from root channel (ID 0)
  const rootChannel = client.getRootChannel();
  if (!rootChannel) {
    return '{gray-fg}No root channel found{/gray-fg}';
  }

  return renderChannel(rootChannel, 0);
}

function updateTree(): void {
  try {
    const tree = buildTree();
    treeBox.setContent(tree);

    // Update header with server info
    const userCount = client.users.size;
    const channelCount = client.channels.size;
    const currentChannel = client.self ? client.getChannel(client.self.channelId)?.name : 'N/A';
    header.setContent(
      `{center}{bold}Mumble Channel Tree{/bold}{/center}\n` +
        `{center}${host}:${port} | Users: ${userCount} | Channels: ${channelCount} | Current: ${currentChannel}{/center}`
    );

    screen.render();
  } catch (e) {
    logError('updateTree', e);
  }
}

// Event handlers
client.on('connected', () => {
  setStatus('Connected, authenticating...', 'cyan');
});

client.on('ready', () => {
  const discordStatus = discordConfig ? ' | Discord: Connected' : '';
  setStatus(`Connected as "${username}"${discordStatus}`, 'green');
  updateTree();

  // Setup microphone for push-to-talk
  setupMicrophone();

  // Setup whisper mode (target 1) for current channel only
  // This sends audio only to the current channel, not linked channels
  client.setupWhisperToCurrentChannel();
});

client.on('disconnected', (reason) => {
  addLogMessage(`{red-fg}✖{/red-fg} Disconnected: ${reason || 'unknown'}`);
  setStatus('Disconnected', 'red');
  logError('DISCONNECTED', new Error(`Disconnected: ${reason || 'unknown reason'}`));
});

client.on('error', (error) => {
  setStatus(`Error: ${error.message}`, 'red');
  logError('CLIENT ERROR', error);
});

client.on('rejected', (type: RejectType, reason?: string) => {
  const typeNames: Record<RejectType, string> = {
    [RejectType.None]: 'Unknown',
    [RejectType.WrongVersion]: 'Wrong Version',
    [RejectType.InvalidUsername]: 'Invalid Username',
    [RejectType.WrongUserPW]: 'Wrong User Password',
    [RejectType.WrongServerPW]: 'Wrong Server Password',
    [RejectType.UsernameInUse]: 'Username In Use',
    [RejectType.ServerFull]: 'Server Full',
    [RejectType.NoCertificate]: 'Certificate Required',
    [RejectType.AuthenticatorFail]: 'Authenticator Failure',
    [RejectType.NoNewConnections]: 'No New Connections Allowed',
  };
  setStatus(`Rejected: ${typeNames[type]}${reason ? ` - ${reason}` : ''}`, 'red');
});

client.on('userJoin', (user) => {
  try {
    addLogMessage(`{green-fg}→{/green-fg} {bold}${user.name}{/bold} joined`);
    updateTree();
  } catch (e) { logError('userJoin handler', e); }
});

client.on('userLeave', (user) => {
  try {
    addLogMessage(`{red-fg}←{/red-fg} {bold}${user.name}{/bold} left`);
    updateTree();
  } catch (e) { logError('userLeave handler', e); }
});

client.on('userUpdate', (user, oldUser) => {
  try {
    // Log channel changes
    if (user.channelId !== oldUser.channelId) {
      const channel = client.getChannel(user.channelId);
      const parent = channel?.parent !== undefined ? client.getChannel(channel.parent) : null;
      const channelPath = parent ? `${parent.name} / ${channel?.name}` : (channel?.name || 'unknown');
      addLogMessage(`{cyan-fg}↔{/cyan-fg} {bold}${user.name}{/bold} moved to {yellow-fg}${channelPath}{/yellow-fg}`);
    }
    updateTree();
    // If we moved, update status and re-setup whisper target
    if (user.session === client.session && user.channelId !== oldUser.channelId) {
      const channel = client.getChannel(user.channelId);
      setStatus(`Joined "${channel?.name}"`, 'green');
      // Update whisper target to new channel
      client.setupWhisperToCurrentChannel();
    }
  } catch (e) {
    logError('userUpdate handler', e);
  }
});

client.on('channelCreate', () => {
  try { updateTree(); } catch (e) { logError('channelCreate handler', e); }
});

client.on('channelRemove', () => {
  try { updateTree(); } catch (e) { logError('channelRemove handler', e); }
});

client.on('channelUpdate', () => {
  try { updateTree(); } catch (e) { logError('channelUpdate handler', e); }
});

client.on('userStartSpeaking', () => {
  try { updateTree(); } catch (e) { logError('userStartSpeaking handler', e); }
});

client.on('userStopSpeaking', () => {
  try { updateTree(); } catch (e) { logError('userStopSpeaking handler', e); }
});

client.on('audio', (session, opusData) => {
  try {
    // Forward to Discord if connected
    if (discordAudioStream) {
      // Restart player if it went idle (with debounce to avoid listener leak)
      if (discordPlayer && discordPlayer.state.status === AudioPlayerStatus.Idle && !discordPlayerRestarting) {
        discordPlayerRestarting = true;
        // Create fresh stream to avoid listener buildup
        discordAudioStream.cleanup();
        discordAudioStream = new DiscordAudioStream();
        const resource = createAudioResource(discordAudioStream, {
          inputType: StreamType.Raw,
          inlineVolume: false,
        });
        discordPlayer.play(resource);
      }
      // Push audio to current stream (with session for per-user decoder)
      discordAudioStream.pushOpusPacket(session, opusData);
    } else if (localSpeakerEnabled && localSpeaker) {
      // Get or create per-user decoder
      let entry = localDecoders.get(session);
      if (!entry) {
        entry = {
          decoder: new OpusScript(SAMPLE_RATE, 1, OpusScript.Application.AUDIO),
          lastTime: Date.now(),
        };
        localDecoders.set(session, entry);
      }
      entry.lastTime = Date.now();

      // Decode and write directly to speaker
      try {
        const pcmMono = entry.decoder.decode(opusData);
        if (pcmMono && pcmMono.length > 0) {
          // Convert mono Int16 to stereo (duplicate each sample)
          const monoSamples = pcmMono.length / 2;
          const stereoBuffer = Buffer.alloc(monoSamples * 4);
          for (let i = 0; i < monoSamples; i++) {
            const sample = pcmMono.readInt16LE ? pcmMono.readInt16LE(i * 2) :
                           (pcmMono[i * 2] | (pcmMono[i * 2 + 1] << 8));
            const signedSample = sample > 32767 ? sample - 65536 : sample;
            stereoBuffer.writeInt16LE(signedSample, i * 4);     // Left
            stereoBuffer.writeInt16LE(signedSample, i * 4 + 2); // Right
          }
          localSpeaker.write(stereoBuffer);
        }
      } catch (decodeErr) {
        logError('local audio decode', decodeErr);
      }
    }
  } catch (e) {
    logError('audio handler', e);
  }
});

// Focus the tree for keyboard navigation
treeBox.focus();

// Log if screen is destroyed unexpectedly
screen.on('destroy', () => {
  logError('SCREEN DESTROYED', new Error('Screen was destroyed'));
});

// Catch any rendering errors
screen.on('warning', (text: string) => {
  logError('SCREEN WARNING', text);
});

// Initial render
screen.render();

// Setup Discord if configured
async function setupDiscord(): Promise<void> {
  if (!discordConfig) return;

  logDebug('Setting up Discord connection...');
  setStatus('Connecting to Discord...', 'cyan');

  discordClient = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });

  discordClient.once(Events.ClientReady, async () => {
    if (!discordClient || !discordConfig) return;

    logDebug(`Discord logged in as ${discordClient.user?.tag}`);

    try {
      const guild = await discordClient.guilds.fetch(discordConfig.guildId);
      const channel = await guild.channels.fetch(discordConfig.channelId);

      if (!channel || !channel.isVoiceBased()) {
        logError('Discord setup', new Error(`Channel ${discordConfig.channelId} is not a voice channel`));
        setStatus('Discord: Invalid voice channel', 'red');
        return;
      }

      logDebug(`Joining Discord voice channel: ${channel.name}`);

      // Join voice channel
      discordConnection = joinVoiceChannel({
        channelId: discordConfig.channelId,
        guildId: discordConfig.guildId,
        adapterCreator: guild.voiceAdapterCreator,
      });

      discordConnection.on(VoiceConnectionStatus.Ready, () => {
        logDebug('Discord voice connection ready');
      });

      discordConnection.on(VoiceConnectionStatus.Disconnected, async () => {
        logDebug('Discord voice disconnected, attempting to reconnect...');
        try {
          await Promise.race([
            entersState(discordConnection!, VoiceConnectionStatus.Signalling, 5_000),
            entersState(discordConnection!, VoiceConnectionStatus.Connecting, 5_000),
          ]);
        } catch {
          logDebug('Discord reconnection failed');
          discordConnection?.destroy();
          discordConnection = null;
        }
      });

      discordConnection.on('error', (err) => {
        logError('Discord voice connection', err);
      });

      // Create audio stream and player
      discordAudioStream = new DiscordAudioStream();
      discordPlayer = createAudioPlayer();

      discordPlayer.on(AudioPlayerStatus.Playing, () => {
        logDebug('Discord audio player playing');
      });

      discordPlayer.on(AudioPlayerStatus.Idle, () => {
        logDebug('Discord audio player idle');
        discordPlayerRestarting = false; // Ready to restart when audio arrives
      });

      discordPlayer.on('error', (err) => {
        logError('Discord audio player', err);
      });

      // Subscribe and start playing
      discordConnection.subscribe(discordPlayer);

      const resource = createAudioResource(discordAudioStream, {
        inputType: StreamType.Raw,
        inlineVolume: false,
      });
      discordPlayer.play(resource);

      logDebug('Discord audio player started');

      // Now connect to Mumble
      connectMumble();

    } catch (err) {
      logError('Discord setup', err);
      setStatus('Discord connection failed', 'red');
    }
  });

  discordClient.on('error', (err) => {
    logError('Discord client', err);
  });

  await discordClient.login(discordConfig.token);
}

// Setup microphone encoder for push-to-talk
function setupMicrophone(): void {
  if (micEncoder) return; // Already setup

  try {
    // Use @evan/opus native encoder - OpusScript has encoding issues
    micEncoder = new OpusEncoder({
      sample_rate: MIC_SAMPLE_RATE,
      channels: MIC_CHANNELS,
      application: 'voip',  // Optimized for voice
    });
    // Match Mumble client settings
    micEncoder.bitrate = 24000;       // 24kbps - matches web-client
    micEncoder.complexity = 10;        // Max quality
    micEncoder.signal = 'voice';       // Optimize for voice
    micEncoder.vbr = true;             // Variable bitrate
    micEncoder.vbr_constraint = true;  // Constrained VBR
    micEncoder.packet_loss = 5;        // Expect ~5% packet loss, adds FEC
    micEncoder.dtx = false;            // Disable DTX
    logDebug(`Created Opus encoder (@evan/opus): ${MIC_SAMPLE_RATE}Hz, ${MIC_CHANNELS} channels, ${micEncoder.bitrate}bps`);
    addLogMessage('{green-fg}✓{/green-fg} Microphone ready (hold {bold}m{/bold} to talk)');
  } catch (err) {
    logError('Microphone setup', err);
    addLogMessage('{red-fg}✖{/red-fg} Microphone setup failed');
    micEncoder = null;
  }
}

/**
 * Drift-compensated send timer for microphone audio.
 * Uses absolute time to schedule frames, preventing cumulative drift.
 */
function startMicSendTimer(): void {
  micTalkStartTime = Date.now();
  micFrameCount = 0;

  function sendNextFrame() {
    if (!isTalking || !micEncoder) {
      micSendTimer = null;
      return;
    }

    // Check if we have enough audio in the buffer
    if (micBuffer.length >= MIC_ENCODE_BYTES) {
      try {
        // Copy PCM data to a fresh Int16Array (2 frames = 960 samples)
        const pcmInt16 = new Int16Array(MIC_ENCODE_SIZE);
        for (let i = 0; i < MIC_ENCODE_SIZE; i++) {
          pcmInt16[i] = micBuffer.readInt16LE(i * 2);
        }

        // Remove processed data from buffer
        micBuffer = micBuffer.subarray(MIC_ENCODE_BYTES);

        micFrameCount++;

        // Encode and send
        const encoded = micEncoder.encode(pcmInt16);
        if (encoded && encoded.length > 0) {
          client.sendAudio(Buffer.from(encoded), false, 1);
        }
      } catch (encErr) {
        logError('Mic encode', encErr);
      }
    }

    // Calculate delay until next frame should be sent (drift compensation)
    const nextExpectedTime = micTalkStartTime + (micFrameCount * MIC_FRAME_DURATION_MS);
    const delay = Math.max(1, nextExpectedTime - Date.now());

    // Schedule next frame
    micSendTimer = setTimeout(sendNextFrame, delay);
  }

  // Start immediately
  sendNextFrame();
}

function startTalking(): void {
  logDebug('=== startTalking called ===');
  if (isTalking) {
    logDebug('Already talking, ignoring');
    return;
  }
  if (!micEncoder) {
    logDebug('No mic encoder, cannot talk');
    addLogMessage('{red-fg}✖{/red-fg} Encoder not available');
    return;
  }

  isTalking = true;
  micBuffer = Buffer.alloc(0);

  // Spawn rec directly with small buffer for low latency
  // Buffer size of 1920 bytes = 20ms at 48kHz mono 16-bit
  logDebug('Starting rec process with small buffer...');
  micProcess = spawn('rec', [
    '-q',                    // Quiet
    '-b', '16',              // 16-bit
    '-r', String(MIC_SAMPLE_RATE),
    '-c', String(MIC_CHANNELS),
    '-e', 'signed-integer',
    '--endian', 'little',
    '--buffer', '1920',      // Small buffer for low latency (20ms)
    '-t', 'raw',
    '-',                     // Output to stdout
  ]);

  const maxBufferBytes = (MIC_MAX_BUFFER_MS / 1000) * MIC_SAMPLE_RATE * MIC_CHANNELS * MIC_BYTES_PER_SAMPLE;

  micProcess.stdout?.on('data', (data: Buffer) => {
    if (!isTalking) return;

    // Accumulate samples - the send timer will consume them
    micBuffer = Buffer.concat([micBuffer, data]);

    // Prevent buffer buildup - drop oldest samples if buffer too large
    if (micBuffer.length > maxBufferBytes) {
      const excess = micBuffer.length - maxBufferBytes;
      micBuffer = micBuffer.subarray(excess);
      logDebug(`Mic buffer overflow, dropped ${excess} bytes`);
    }
  });

  micProcess.on('error', (err: Error) => {
    logError('Mic process error', err);
  });

  // Start drift-compensated send timer
  startMicSendTimer();

  logDebug('Mic process started');

  setStatus('Transmitting...', 'red');
  addLogMessage('{yellow-fg}🎤{/yellow-fg} Transmitting...');
}

function stopTalking(): void {
  if (!isTalking) return;

  isTalking = false;

  // Stop the send timer
  if (micSendTimer) {
    clearTimeout(micSendTimer);
    micSendTimer = null;
  }

  if (micProcess) {
    micProcess.kill();
    micProcess = null;
  }

  // Send final packet with terminator if we have remaining data
  if (micBuffer.length > 0 && micEncoder) {
    try {
      // Pad to encode size (20ms = 960 samples)
      if (micBuffer.length < MIC_ENCODE_BYTES) {
        micBuffer = Buffer.concat([micBuffer, Buffer.alloc(MIC_ENCODE_BYTES - micBuffer.length)]);
      }
      const pcmInt16 = new Int16Array(MIC_ENCODE_SIZE);
      for (let i = 0; i < MIC_ENCODE_SIZE; i++) {
        pcmInt16[i] = micBuffer.readInt16LE(i * 2);
      }
      const encoded = micEncoder.encode(pcmInt16);
      if (encoded && encoded.length > 0) {
        client.sendAudio(Buffer.from(encoded), true, 1);
      }
    } catch (e) {
      // Ignore errors
    }
  }

  micBuffer = Buffer.alloc(0);

  const channel = client.self ? client.getChannel(client.self.channelId) : null;
  setStatus(`Connected - ${channel?.name || 'unknown'}`, 'green');
  addLogMessage('{gray-fg}🎤{/gray-fg} Stopped transmitting');
  logDebug('Stopped talking');
}

// Setup local speaker for audio playback (when Discord not configured)
function setupLocalSpeaker(): void {
  try {
    localSpeakerEnabled = true;

    // Create speaker with minimal buffering for low latency
    localSpeaker = new Speaker({
      channels: CHANNELS,
      bitDepth: BIT_DEPTH,
      sampleRate: SAMPLE_RATE,
      signed: true,
      lowWaterMark: 0,
      highWaterMark: 1920 * 4, // ~40ms buffer (960 samples * 2 channels * 2 bytes * 2 frames)
    });

    localSpeaker.on('error', (err: Error) => {
      logError('Local speaker', err);
    });

    localSpeaker.on('close', () => {
      localSpeaker = null;
    });

    logDebug('Local audio playback enabled (per-user decoders, low-latency)');
  } catch (err) {
    logError('Local speaker setup', err);
    localSpeakerEnabled = false;
  }
}

// Connect to Mumble
function connectMumble(): void {
  client
    .connect()
    .then(() => {
      // Connection initiated
    })
    .catch((error) => {
      setStatus(`Connection failed: ${error.message}`, 'red');
    });
}

// Start
if (discordConfig) {
  setupDiscord().catch((err) => {
    logError('Discord setup', err);
    setStatus('Discord setup failed', 'red');
    // Fall back to Mumble only with local speaker
    setupLocalSpeaker();
    connectMumble();
  });
} else {
  // No Discord - use local speaker for audio output
  setupLocalSpeaker();
  connectMumble();
}
