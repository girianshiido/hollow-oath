const SOUNDS = {
  steel: ['steel-1', 'steel-2', 'steel-3'],
  hurt: ['hurt'],
  ember: ['ember'],
  rime: ['rime'],
  storm: ['storm'],
  heal: ['heal'],
  block: ['block'],
  seal: ['seal'],
  reward: ['reward'],
  fallen: ['fallen']
} as const;
type Cue = keyof typeof SOUNDS;
const LEVELS: Record<Cue, number> = {
  steel: 0.65, hurt: 0.63, ember: 0.83, rime: 0.78, storm: 0.72,
  heal: 0.69, block: 0.45, seal: 0.61, reward: 0.69, fallen: 0.7
};
const KEY = 'hollow-oath.audio';
const embedded = (globalThis as typeof globalThis & {HOLLOW_AUDIO?: Record<string, string>}).HOLLOW_AUDIO;
const supportsOgg = Boolean(document.createElement('audio').canPlayType('audio/ogg; codecs="vorbis"'));
let context: AudioContext | undefined;
let master: GainNode | undefined;
const buffers = new Map<string, Promise<AudioBuffer | undefined>>();
const voices = new Set<AudioBufferSourceNode>();
const lastPlayed = new Map<Cue, number>();
let settings = {muted: false, volume: 60};
try {
  const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  if (typeof stored?.muted === 'boolean') settings.muted = stored.muted;
  if (Number.isFinite(stored?.volume)) settings.volume = Math.round(Math.max(0, Math.min(100, stored.volume)));
} catch { /* Keep defaults if storage is unavailable. */ }

export const audioSettings = () => settings;

export function configureAudio(muted: boolean, volume: number): void {
  settings = {muted, volume};
  try { localStorage.setItem(KEY, JSON.stringify(settings)); }
  catch { /* Audio settings still apply to the current session. */ }
  if (muted || volume === 0) stopSounds();
  if (context && master) master.gain.setTargetAtTime(muted ? 0 : volume / 100, context.currentTime, 0.015);
}

function load(name: string): Promise<AudioBuffer | undefined> {
  const existing = buffers.get(name);
  if (existing) return existing;
  async function decode(extension: 'ogg' | 'm4a'): Promise<AudioBuffer> {
    const filename = name + '.' + extension;
    const response = await fetch(embedded?.[filename] ?? new URL('audio/' + filename, document.baseURI));
    if (!response.ok) throw new Error('Audio unavailable');
    return context!.decodeAudioData(await response.arrayBuffer());
  }
  const ready = (supportsOgg ? decode('ogg').catch(() => decode('m4a')) : decode('m4a'))
    .catch(() => { buffers.delete(name); return undefined; });
  buffers.set(name, ready);
  return ready;
}

export function unlockAudio(): void {
  if (settings.muted || !settings.volume || document.hidden) return;
  const Audio = window.AudioContext ?? (window as Window & {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
  if (!Audio) return;
  try {
    if (!context) {
      context = new Audio();
      master = context.createGain();
      master.gain.value = settings.volume / 100;
      master.connect(context.destination);
      for (const name of Object.values(SOUNDS).flat()) void load(name);
    }
    if (context.state !== 'running') void context.resume().catch(() => {});
  } catch { /* The game remains playable when audio is unavailable. */ }
}

let revision = 0;
export function stopSounds(): void {
  revision++;
  for (const voice of voices) voice.stop();
  voices.clear();
  lastPlayed.clear();
}

export function backgroundAudio(): void {
  if (document.hidden) {
    stopSounds();
    void context?.suspend().catch(() => {});
  } else if (context && !settings.muted && settings.volume) void context.resume().catch(() => {});
}

export async function playSound(cue: Cue, preview = false): Promise<void> {
  if (!context || !master || settings.muted || !settings.volume || document.hidden) return;
  const now = performance.now();
  if (now - (lastPlayed.get(cue) ?? -Infinity) < (cue === 'block' ? 550 : 110)) return;
  lastPlayed.set(cue, now);
  const names = SOUNDS[cue];
  const version = revision;
  const buffer = await load(names[Math.floor(Math.random() * names.length)]!);
  if (!buffer || revision !== version || context.state !== 'running' ||
      settings.muted || !settings.volume || document.hidden || (!preview && performance.now() - now > 320)) return;
  if (voices.size >= 5) {
    const oldest = voices.values().next().value;
    if (oldest) { oldest.stop(); voices.delete(oldest); }
  }
  const voice = context.createBufferSource();
  const volume = context.createGain();
  voice.buffer = buffer;
  voice.playbackRate.value = 0.96 + Math.random() * 0.08;
  volume.gain.value = LEVELS[cue];
  voice.connect(volume);
  volume.connect(master);
  voices.add(voice);
  voice.onended = () => { voices.delete(voice); voice.disconnect(); volume.disconnect(); };
  voice.start();
}
