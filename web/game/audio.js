// SFX are decoded once. Voice has its own cancellable source, never an SFX pool.
export class AudioSystem {
  constructor() {
    this.buffers = new Map();
    this.active = new Set();
    this.voiceToken = 0;
    this.voice = null;
    this.enabled = true;
    this.failures = [];
  }
  async unlock() {
    this.context ||= new (globalThis.AudioContext ||
      globalThis.webkitAudioContext)();
    await this.context.resume();
    this.loading ||= this.preload();
    return this.loading;
  }
  async preload() {
    const manifest = await fetch("assets/audio/sfx/manifest.json").then((r) =>
      r.json(),
    );
    await Promise.all(
      Object.entries(manifest).map(async ([key, url]) => {
        try {
          const bytes = await fetch(url).then((r) => r.arrayBuffer());
          this.buffers.set(key, await this.context.decodeAudioData(bytes));
        } catch (e) {
          this.failures.push(key);
          console.warn("Audio:", key, e);
        }
      }),
    );
  }
  play(key, { volume = 0.35, position, listener, pitch = 1 } = {}) {
    if (
      !this.enabled ||
      !this.context ||
      this.context.state !== "running" ||
      !this.buffers.has(key) ||
      this.active.size >= 20
    )
      return;
    let distance = position && listener ? position.distanceTo(listener) : 0;
    if (distance > 25) return;
    const source = this.context.createBufferSource(),
      gain = this.context.createGain();
    source.buffer = this.buffers.get(key);
    source.playbackRate.value = pitch;
    gain.gain.value = volume / (1 + distance * 0.18);
    source.connect(gain);
    gain.connect(this.context.destination);
    this.active.add(source);
    source.onended = () => {
      this.active.delete(source);
      source.disconnect();
      gain.disconnect();
    };
    source.start();
    return source;
  }
  stopVoice() {
    this.voiceToken++;
    if (this.voice) {
      this.voice.pause();
      this.voice.removeAttribute("src");
      this.voice.load();
      this.voice = null;
    }
    globalThis.speechSynthesis?.cancel();
  }
  speak(text, id, speaker = "cody") {
    this.stopVoice();
    if (speaker !== "cody") return;
    if (id) {
      const voice = new Audio(`assets/audio/voice/${id}.mp3`);
      this.voice = voice;
      voice.volume = 0.9;
      voice.play().catch((e) => {
        if (this.voice === voice) {
          console.warn("Voice unavailable", id, e);
          this.fallback(text);
        }
      });
    } else this.fallback(text);
  }
  fallback(text) {
    if (!globalThis.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 1.05;
    globalThis.speechSynthesis.speak(u);
  }
  stop() {
    this.stopVoice();
    for (const s of this.active) {
      try {
        s.stop();
      } catch {}
    }
    this.active.clear();
  }
}
