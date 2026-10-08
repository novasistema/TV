export interface MusicTrack {
  id: string;
  name: string;
  category: string;
  description: string;
  bpm: number;
  mood: string;
  isCustom?: boolean;
  dataUrl?: string;
}

export const BUILT_IN_MUSIC_TRACKS: MusicTrack[] = [
  {
    id: 'track-acoustic-warm',
    name: 'Café & Comercio Acogedor',
    category: 'Acústico & Tranquilo',
    description: 'Acordes cálidos de guitarra y piano suave. Ideal para cafeterías, panaderías y tiendas boutique.',
    bpm: 96,
    mood: 'Cálido, sereno y agradable',
  },
  {
    id: 'track-retail-upbeat',
    name: 'Retail & Comercio Dinámico',
    category: 'Comercial & Alegre',
    description: 'Ritmo alegre con marimba y campanas comerciales. Perfecto para negocios con flujo continuo de clientes.',
    bpm: 112,
    mood: 'Optimista, fresco y dinámico',
  },
  {
    id: 'track-promo-energy',
    name: 'Ferretería & Energía Pro',
    category: 'Moderno & Activo',
    description: 'Bajo rítmico y arpegios brillantes con pulsación activa. Excelente para ferreterías, tecnología y promociones.',
    bpm: 120,
    mood: 'Profesional, seguro y dinámico',
  },
  {
    id: 'track-chill-lounge',
    name: 'Lounge Moderno & Relax',
    category: 'Lounge & Chillout',
    description: 'Acordes elegantes estilo Rhodes con suave ambiente envolvente. Ideal para restaurantes y comercios modernos.',
    bpm: 88,
    mood: 'Elegante, relajado y sofisticado',
  },
];

// In-memory cache for synthesized audio tracks so they generate in milliseconds once
const synthesizedAudioCache = new Map<string, string>();

/**
 * Procedurally generates a warm, harmonious 16-30 second seamless stereo audio loop (WAV)
 * using the Web Audio API OfflineAudioContext.
 * 100% offline, 0 network dependencies, 0 CORS issues, pristine 44.1kHz stereo audio.
 */
export async function getOrGenerateTrackAudioUrl(trackId: string): Promise<string> {
  if (synthesizedAudioCache.has(trackId)) {
    return synthesizedAudioCache.get(trackId)!;
  }

  const sampleRate = 44100;
  let duration = 16; // 16 seconds loop
  if (trackId === 'track-retail-upbeat') duration = 16;
  if (trackId === 'track-promo-energy') duration = 16;
  if (trackId === 'track-chill-lounge') duration = 20;

  const totalSamples = sampleRate * duration;
  const AudioCtxClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  if (!AudioCtxClass) {
    throw new Error('Web Audio OfflineAudioContext no soportado en este navegador.');
  }

  const offlineCtx = new AudioCtxClass(2, totalSamples, sampleRate);

  // Master compressor / limiter for commercial polish
  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.knee.value = 8;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.15;
  compressor.connect(offlineCtx.destination);

  // Reverb simulation (stereo delay comb filter)
  const delayL = offlineCtx.createDelay();
  const delayR = offlineCtx.createDelay();
  delayL.delayTime.value = 0.22;
  delayR.delayTime.value = 0.33;
  const delayFeedback = offlineCtx.createGain();
  delayFeedback.gain.value = 0.24;
  delayL.connect(delayFeedback);
  delayFeedback.connect(delayR);
  delayR.connect(compressor);

  // Helper note frequencies (equal temperament, A4 = 440)
  const noteFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

  // Helper: play pluck / chime / piano note
  const playTone = (
    midi: number,
    startTime: number,
    toneDuration: number,
    vol = 0.15,
    type: OscillatorType = 'triangle',
    pan = 0
  ) => {
    if (startTime >= duration) return;
    const osc = offlineCtx.createOscillator();
    const gain = offlineCtx.createGain();
    const panner = offlineCtx.createStereoPanner ? offlineCtx.createStereoPanner() : null;

    osc.type = type;
    osc.frequency.setValueAtTime(noteFreq(midi), startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    // Smooth attack
    gain.gain.exponentialRampToValueAtTime(vol, startTime + 0.02);
    // Natural decay
    gain.gain.exponentialRampToValueAtTime(vol * 0.4, startTime + 0.12);
    // Tail
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + toneDuration);

    osc.connect(gain);
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner);
      panner.connect(compressor);
      panner.connect(delayL);
    } else {
      gain.connect(compressor);
      gain.connect(delayL);
    }

    osc.start(startTime);
    osc.stop(startTime + toneDuration + 0.05);
  };

  // Helper: soft percussion brush/shaker
  const playPercussion = (startTime: number, vol = 0.04) => {
    if (startTime >= duration) return;
    const bufferSize = sampleRate * 0.06;
    const noiseBuffer = offlineCtx.createBuffer(1, bufferSize, sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = offlineCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = offlineCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 3500;

    const gain = offlineCtx.createGain();
    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.055);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(compressor);

    whiteNoise.start(startTime);
    whiteNoise.stop(startTime + 0.06);
  };

  if (trackId === 'track-acoustic-warm') {
    // 4-bar progression in G Major (G - D - Em - C) repeating twice
    // G Major: G3, B3, D4, G4 | D: D3, F#3, A3, D4 | Em: E3, G3, B3, E4 | C: C3, E3, G3, C4
    const chords = [
      [55, 59, 62, 67], // G
      [50, 57, 62, 66], // D
      [52, 55, 59, 64], // Em
      [48, 55, 60, 64], // C
    ];

    const barLen = 2.0; // 2 seconds per chord = 8s cycle x 2 = 16s
    for (let cycle = 0; cycle < 2; cycle++) {
      chords.forEach((chord, chordIdx) => {
        const chordStart = cycle * 8 + chordIdx * barLen;
        // Bass note
        playTone(chord[0] - 12, chordStart, 1.8, 0.18, 'sine', -0.2);

        // Arpeggios (Guitar / warm Rhodes picking)
        const arpegPattern = [0, 1, 2, 3, 2, 1, 3, 2];
        arpegPattern.forEach((noteIdx, step) => {
          const t = chordStart + step * (barLen / 8);
          const pan = (step % 2 === 0 ? 0.35 : -0.35);
          playTone(chord[noteIdx], t, 0.55, 0.12, 'triangle', pan);
        });

        // Gentle acoustic shaker on beats
        for (let b = 0; b < 4; b++) {
          playPercussion(chordStart + b * 0.5, b % 2 === 1 ? 0.035 : 0.02);
        }
      });
    }
  } else if (trackId === 'track-retail-upbeat') {
    // Cheerful, upbeat retail commercial progression (C - Am - F - G)
    const chords = [
      [48, 60, 64, 67, 72], // C
      [45, 57, 60, 64, 69], // Am
      [41, 53, 57, 60, 65], // F
      [43, 55, 59, 62, 67], // G
    ];

    const barLen = 2.0;
    for (let cycle = 0; cycle < 2; cycle++) {
      chords.forEach((chord, chordIdx) => {
        const chordStart = cycle * 8 + chordIdx * barLen;
        // Bouncy bass
        playTone(chord[0] - 12, chordStart, 0.4, 0.22, 'triangle', 0);
        playTone(chord[0] - 12, chordStart + 0.5, 0.3, 0.16, 'triangle', 0);
        playTone(chord[0] - 5, chordStart + 1.0, 0.35, 0.18, 'triangle', 0);
        playTone(chord[0] - 12, chordStart + 1.5, 0.3, 0.16, 'triangle', 0);

        // Marimba / Bell chords
        [0, 0.5, 1.0, 1.5].forEach((beat, bIdx) => {
          chord.slice(1, 4).forEach((n, nIdx) => {
            playTone(n, chordStart + beat, 0.35, 0.08, 'sine', (nIdx - 1) * 0.4);
          });
        });

        // Cheerful melodic accent chime
        const melodyPitches = [72, 74, 76, 79];
        playTone(melodyPitches[chordIdx % melodyPitches.length], chordStart + 0.75, 0.5, 0.12, 'sine', 0.25);

        // Shakers on 8th notes
        for (let s = 0; s < 8; s++) {
          playPercussion(chordStart + s * 0.25, s % 2 === 1 ? 0.045 : 0.02);
        }
      });
    }
  } else if (trackId === 'track-promo-energy') {
    // Dynamic driving commercial loop (D - A - Bm - G)
    const chords = [
      [50, 57, 62, 66], // D
      [45, 52, 57, 61], // A
      [47, 54, 59, 62], // Bm
      [43, 50, 55, 59], // G
    ];

    const barLen = 2.0;
    for (let cycle = 0; cycle < 2; cycle++) {
      chords.forEach((chord, chordIdx) => {
        const chordStart = cycle * 8 + chordIdx * barLen;
        // Driving solid bass
        for (let b = 0; b < 4; b++) {
          playTone(chord[0] - 12, chordStart + b * 0.5, 0.38, 0.22, 'sawtooth', 0);
        }

        // Crisp synth arpeggios
        const arpNotes = [chord[1], chord[2], chord[3], chord[2], chord[3] + 12, chord[2], chord[1], chord[2]];
        arpNotes.forEach((n, step) => {
          playTone(n, chordStart + step * 0.25, 0.22, 0.09, 'triangle', (step % 2 === 0 ? 0.3 : -0.3));
        });

        // Rhythmic shakers
        for (let s = 0; s < 8; s++) {
          playPercussion(chordStart + s * 0.25, s % 4 === 2 ? 0.05 : 0.025);
        }
      });
    }
  } else {
    // track-chill-lounge (Smooth Rhodes jazzy chords in F Major / Dm7)
    const chords = [
      [41, 53, 57, 60, 64], // Fmaj7
      [38, 50, 53, 57, 60], // Dm7
      [43, 52, 55, 58, 62], // Gm7
      [36, 48, 52, 55, 58], // C7
    ];

    const barLen = 2.5; // 10s x 2 = 20s
    for (let cycle = 0; cycle < 2; cycle++) {
      chords.forEach((chord, chordIdx) => {
        const chordStart = cycle * 10 + chordIdx * barLen;
        // Deep sub bass
        playTone(chord[0] - 12, chordStart, 2.3, 0.20, 'sine', 0);

        // Warm Rhodes velvet chord
        chord.slice(1).forEach((n, idx) => {
          playTone(n, chordStart + 0.02 * idx, 2.2, 0.08, 'sine', (idx - 1.5) * 0.3);
        });

        // Soft gentle syncopation
        playTone(chord[chord.length - 1] + 2, chordStart + 1.25, 0.8, 0.06, 'triangle', 0.2);

        for (let b = 0; b < 5; b++) {
          playPercussion(chordStart + b * 0.5, 0.018);
        }
      });
    }
  }

  // Render the audio graph to AudioBuffer
  const renderedBuffer = await offlineCtx.startRendering();

  // Convert AudioBuffer to standard WAV Blob & Data URL
  const wavBlob = audioBufferToWavBlob(renderedBuffer);
  const dataUrl = URL.createObjectURL(wavBlob);

  synthesizedAudioCache.set(trackId, dataUrl);
  return dataUrl;
}

/**
 * Converts a Web Audio AudioBuffer to a valid RIFF 16-bit PCM WAV Blob.
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const numSamples = buffer.length * numChannels;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const dataByteCount = numSamples * bytesPerSample;
  const wavBuffer = new ArrayBuffer(44 + dataByteCount);
  const view = new DataView(wavBuffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + dataByteCount, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, format, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * blockAlign, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, bitDepth, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, dataByteCount, true);

  // Write interleaved PCM samples
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      // Convert float [-1, 1] to 16-bit signed integer [-32768, 32767]
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
