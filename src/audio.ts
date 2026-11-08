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
const MUSIC = {
  title: {file: 'music-title', gain: 0.34},
  battle: {file: 'music-battle', gain: 0.28},
  chapter: {file:'music-chapter',gain:.31,loopStart:5.714288,loopEnd:74.285744},
  final: {file:'music-final-boss',gain:.31,loopStart:5.454544,loopEnd:70.909072},
  defeat: {file: 'music-defeat', gain: 0.36},
  ending: {file: 'music-ending', gain: 0.34},
  interlude: {file: 'music-interlude', gain: 0.36, loopStart: 0, loopEnd: 50.52633333333333}
} as const;
type MusicScene = keyof typeof MUSIC;
let scene: MusicScene | 'silent' = 'title';
let pendingScene: MusicScene | undefined;
let music: {scene: MusicScene; source: AudioBufferSourceNode; gain: GainNode} | undefined;

const KEY = 'hollow-oath.audio';
const embedded = (globalThis as typeof globalThis & {HOLLOW_AUDIO?: Record<string, string>}).HOLLOW_AUDIO;
const supportsOgg = Boolean(document.createElement('audio').canPlayType('audio/ogg; codecs="vorbis"'));
let context: AudioContext | undefined;
let master: GainNode | undefined;
let musicBus: GainNode | undefined;
let effectsBus: GainNode | undefined;
const buffers = new Map<string, Promise<AudioBuffer | undefined>>();
const voices = new Set<AudioBufferSourceNode>();
const lastPlayed = new Map<Cue, number>();
const clampVolume = (value: number, fallback = 60) => Number.isFinite(value) ? Math.round(Math.max(0, Math.min(100, value))) : fallback;
let settings = {muted: false, musicVolume: 60, effectsVolume: 60};
try {
  const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  if (typeof stored?.muted === 'boolean') settings.muted = stored.muted;
  const legacy = clampVolume(stored?.volume);
  settings.musicVolume = clampVolume(stored?.musicVolume, legacy);
  settings.effectsVolume = clampVolume(stored?.effectsVolume, legacy);
} catch { /* Keep defaults if storage is unavailable. */ }

export const audioSettings = () => settings;

export function configureAudio(muted: boolean, musicVolume: number, effectsVolume: number): void {
  settings = {muted, musicVolume: clampVolume(musicVolume, settings.musicVolume), effectsVolume: clampVolume(effectsVolume, settings.effectsVolume)};
  try { localStorage.setItem(KEY, JSON.stringify(settings)); }
  catch { /* Audio settings still apply to the current session. */ }
  if (muted || settings.effectsVolume === 0) stopSounds();
  if (context) {
    master?.gain.setTargetAtTime(muted ? 0 : 1, context.currentTime, .015);
    musicBus?.gain.setTargetAtTime(settings.musicVolume / 100, context.currentTime, .015);
    effectsBus?.gain.setTargetAtTime(settings.effectsVolume / 100, context.currentTime, .015);
    void refreshMusic();
  }
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

export const audioActive = () => context?.state === 'running' && !settings.muted && (settings.musicVolume > 0 || settings.effectsVolume > 0);

export async function unlockAudio(): Promise<void> {
  if (settings.muted || (!settings.musicVolume && !settings.effectsVolume) || document.hidden) return;
  const Audio = window.AudioContext ?? (window as Window & {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
  if (!Audio) return;
  try {
    if (!context) {
      context = new Audio();
      master = context.createGain();
      master.gain.value = 1;
      musicBus = context.createGain();
      musicBus.gain.value = settings.musicVolume / 100;
      musicBus.connect(master);
      effectsBus = context.createGain();
      effectsBus.gain.value = settings.effectsVolume / 100;
      effectsBus.connect(master);
      master.connect(context.destination);
      for (const name of Object.values(SOUNDS).flat()) void load(name);
    }
    if (context.state !== 'running') await context.resume();
    void refreshMusic();
  } catch { /* The game remains playable when audio is unavailable. */ }
}

export function setMusic(next: MusicScene | 'silent'): void {
  if (scene === next) return;
  scene = next;
  if (music && context) {
    const at = context.currentTime;
    music.gain.gain.cancelScheduledValues(at);
    music.gain.gain.setTargetAtTime(0, at, 0.065);
    if (next === 'silent') music.gain.gain.setValueAtTime(0, at);
    music.source.stop(next === 'silent' ? at : at + 0.30);
    music = undefined;
  }
  void refreshMusic();
}

export function preloadMusic(next: MusicScene): void {
  if(context && settings.musicVolume>0 && !settings.muted)void load(MUSIC[next].file);
}
async function refreshMusic(): Promise<void> {
  const requested = scene;
  if (requested === 'silent' || !context || !musicBus || !settings.musicVolume || !audioActive() || document.hidden ||
      music?.scene === requested || pendingScene === requested) return;
  pendingScene = requested;
  const track = MUSIC[requested];
  const buffer = await load(track.file);
  if (pendingScene === requested) pendingScene = undefined;
  if (!buffer || !context || !musicBus || !settings.musicVolume || !audioActive() || document.hidden ||
      requested !== scene || music?.scene === requested) return;
  const source = context.createBufferSource();
  const gain = context.createGain();
  const at = context.currentTime;
  source.buffer = buffer;
  source.loop = true;
  // The battle master is exactly 192 quarter notes at 150 BPM.
  if (requested === 'battle') source.loopEnd = Math.min(buffer.duration, 76.8);
  if ('loopStart' in track) {
    source.loopStart=track.loopStart;
    source.loopEnd=Math.min(buffer.duration,track.loopEnd);
  }
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(track.gain, at + 0.24);
  source.connect(gain);
  gain.connect(musicBus);
  source.onended = () => { source.disconnect(); gain.disconnect(); };
  music = {scene: requested, source, gain};
  source.start();
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
  } else if (context && !settings.muted && (settings.musicVolume || settings.effectsVolume)) void unlockAudio();
}

export async function playSound(cue: Cue, preview = false): Promise<void> {
  if (!context || !effectsBus || settings.muted || !settings.effectsVolume || document.hidden) return;
  const now = performance.now();
  if (now - (lastPlayed.get(cue) ?? -Infinity) < (cue === 'block' ? 550 : 110)) return;
  lastPlayed.set(cue, now);
  const names = SOUNDS[cue];
  const version = revision;
  const buffer = await load(names[Math.floor(Math.random() * names.length)]!);
  if (!buffer || revision !== version || context.state !== 'running' ||
      settings.muted || !settings.effectsVolume || document.hidden || (!preview && performance.now() - now > 320)) return;
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
  volume.connect(effectsBus!);
  voices.add(voice);
  voice.onended = () => { voices.delete(voice); voice.disconnect(); volume.disconnect(); };
  voice.start();
}
