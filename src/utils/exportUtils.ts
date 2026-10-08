import JSZip from 'jszip';
import fixWebmDuration from 'fix-webm-duration';
import { Slide, Template, GlobalSettings } from '../types';
import { isSlideActiveNow } from './scheduleUtils';
import { getOrGenerateTrackAudioUrl } from './audioTracks';

/**
 * Safely creates an rgba() string from any hex (#rgb, #rrggbb, #rrggbbaa) or rgb() color
 * with a strictly clamped alpha between 0 and 1 to prevent Canvas 2D SyntaxErrors.
 */
export function safeColorWithAlpha(color: string | undefined, alpha: number): string {
  const safeAlpha = Math.max(0, Math.min(1, isNaN(alpha) ? 1 : alpha));
  if (!color || typeof color !== 'string') {
    return `rgba(245, 158, 11, ${safeAlpha})`;
  }
  const clean = color.trim();
  if (clean.startsWith('#')) {
    const hex = clean.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16) || 245;
      const g = parseInt(hex[1] + hex[1], 16) || 158;
      const b = parseInt(hex[2] + hex[2], 16) || 11;
      return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
    } else if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16) || 245;
      const g = parseInt(hex.slice(2, 4), 16) || 158;
      const b = parseInt(hex.slice(4, 6), 16) || 11;
      return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
    }
  } else if (clean.startsWith('rgb')) {
    const match = clean.match(/\d+/g);
    if (match && match.length >= 3) {
      return `rgba(${match[0]}, ${match[1]}, ${match[2]}, ${safeAlpha})`;
    }
  }
  return `rgba(245, 158, 11, ${safeAlpha})`;
}

export interface ProjectBackupData {
  version: string;
  exportDate: string;
  storeName: string;
  slides: Slide[];
  templates: Template[];
  settings: GlobalSettings;
  categories: string[];
}

/**
 * Downloads a complete JSON backup of the project (slides, templates, settings, categories)
 * to allow the user to save their work, take it to another computer or phone, and resume anytime.
 */
export function exportProjectBackupJson(
  slides: Slide[],
  templates: Template[],
  settings: GlobalSettings,
  categories: string[]
): void {
  const backup: ProjectBackupData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    storeName: settings.storeName || 'Mi-Negocio',
    slides,
    templates,
    settings,
    categories,
  };

  const jsonString = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const cleanName = (settings.storeName || 'Proyecto')
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, '_')
    .slice(0, 30);
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `${cleanName}_backup_${dateStr}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parses and validates an uploaded project backup JSON file.
 */
export async function parseProjectBackupFile(file: File): Promise<ProjectBackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || typeof parsed !== 'object') {
          throw new Error('El archivo no tiene un formato válido.');
        }

        if (!Array.isArray(parsed.slides)) {
          throw new Error('El archivo no contiene diapositivas válidas.');
        }

        resolve({
          version: parsed.version || '1.0',
          exportDate: parsed.exportDate || new Date().toISOString(),
          storeName: parsed.storeName || parsed.settings?.storeName || 'Ferretería',
          slides: parsed.slides,
          templates: Array.isArray(parsed.templates) ? parsed.templates : [],
          settings: parsed.settings || {},
          categories: Array.isArray(parsed.categories) ? parsed.categories : [],
        });
      } catch (err: any) {
        reject(new Error(err?.message || 'Error al leer el archivo JSON de respaldo.'));
      }
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
    reader.readAsText(file);
  });
}

/**
 * Generates a completely standalone, offline-capable HTML5 player file
 * that can be opened in any Smart TV browser, TV stick, or PC directly from a USB pendrive.
 */
export function generateStandaloneHtml(
  slides: Slide[],
  templates: Template[],
  settings: GlobalSettings
): string {
  const serializedSlides = JSON.stringify(slides);
  const serializedTemplates = JSON.stringify(templates);
  const serializedSettings = JSON.stringify(settings);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${settings.storeName || 'DisplayTV Signage'} - Pantalla Mostrador</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
      -webkit-user-select: none;
    }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #fff;
    }
    #tv-stage {
      position: relative;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: background 0.8s ease;
    }
    /* Top Bar */
    .top-bar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      z-index: 20;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem 2.5rem;
      background: linear-gradient(to bottom, rgba(0,0,0,0.6), transparent);
    }
    .store-brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .store-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #f59e0b;
      box-shadow: 0 0 12px #f59e0b;
    }
    .store-name {
      font-size: 1.25rem;
      font-weight: 900;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      text-shadow: 0 2px 4px rgba(0,0,0,0.8);
    }
    .store-tagline {
      font-size: 0.85rem;
      color: rgba(255,255,255,0.7);
    }
    .live-widgets {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: rgba(0,0,0,0.4);
      backdrop-filter: blur(8px);
      padding: 0.5rem 1.25rem;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.15);
      font-weight: 700;
      font-size: 0.95rem;
    }
    /* Main Slide Stage */
    .slide-container {
      position: relative;
      flex: 1;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4rem 5rem;
      z-index: 10;
      opacity: 0;
      transform: scale(0.98);
      transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .slide-container.active {
      opacity: 1;
      transform: scale(1);
    }
    .content-column {
      flex: 1;
      max-width: 55%;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      z-index: 12;
    }
    .badge-pill {
      display: inline-block;
      align-self: flex-start;
      padding: 0.4rem 1.25rem;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    }
    .slide-title {
      font-size: 3.5rem;
      font-weight: 900;
      line-height: 1.08;
      text-shadow: 0 4px 16px rgba(0,0,0,0.8);
    }
    .slide-subtitle {
      font-size: 1.5rem;
      color: rgba(255,255,255,0.85);
      line-height: 1.4;
      text-shadow: 0 2px 8px rgba(0,0,0,0.8);
    }
    .highlights-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 0.5rem;
    }
    .highlight-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 1.15rem;
      font-weight: 600;
      color: rgba(255,255,255,0.9);
      text-shadow: 0 2px 6px rgba(0,0,0,0.8);
    }
    .highlight-bullet {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #f59e0b;
      box-shadow: 0 0 8px #f59e0b;
    }
    .price-row {
      display: flex;
      align-items: baseline;
      gap: 1.5rem;
      margin-top: 1rem;
    }
    .main-price {
      font-size: 4rem;
      font-weight: 950;
      line-height: 1;
      text-shadow: 0 4px 20px rgba(0,0,0,0.7);
    }
    .original-price {
      font-size: 2rem;
      color: rgba(255,255,255,0.4);
      text-decoration: line-through;
    }
    .cta-button {
      display: inline-flex;
      align-self: flex-start;
      padding: 0.85rem 2rem;
      border-radius: 999px;
      background: #fff;
      color: #000;
      font-size: 1.1rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      box-shadow: 0 8px 25px rgba(0,0,0,0.5);
      margin-top: 0.5rem;
    }
    .media-column {
      flex: 1;
      max-width: 45%;
      height: 70vh;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .media-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      filter: drop-shadow(0 20px 40px rgba(0,0,0,0.6));
      animation: floatSmooth 6s ease-in-out infinite;
    }
    .media-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 1.5rem;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    }
    @keyframes floatSmooth {
      0%, 100% { transform: translateY(0px) scale(1); }
      50% { transform: translateY(-12px) scale(1.02); }
    }
    /* Bottom Bar & Ticker */
    .bottom-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 20;
    }
    .progress-bar-container {
      width: 100%;
      height: 6px;
      background: rgba(255,255,255,0.15);
    }
    .progress-bar-fill {
      height: 100%;
      width: 0%;
      background: #f59e0b;
      transition: width 0.1s linear;
    }
    .ticker-bar {
      width: 100%;
      background: rgba(0,0,0,0.85);
      border-top: 1px solid rgba(255,255,255,0.1);
      padding: 0.75rem 0;
      overflow: hidden;
      white-space: nowrap;
      display: flex;
      align-items: center;
    }
    .ticker-content {
      display: inline-block;
      white-space: nowrap;
      animation: marquee 25s linear infinite;
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: rgba(255,255,255,0.9);
    }
    @keyframes marquee {
      0% { transform: translateX(100vw); }
      100% { transform: translateX(-100%); }
    }
    /* Controls hint (hidden after 5s) */
    .keyboard-hint {
      position: absolute;
      top: 1rem;
      right: 1rem;
      z-index: 30;
      background: rgba(0,0,0,0.6);
      padding: 0.4rem 0.8rem;
      border-radius: 8px;
      font-size: 0.75rem;
      color: rgba(255,255,255,0.6);
      pointer-events: none;
      transition: opacity 1s;
    }
    .fullscreen-btn {
      position: absolute;
      bottom: 4rem;
      right: 2rem;
      z-index: 40;
      background: rgba(0,0,0,0.6);
      border: 1px solid rgba(255,255,255,0.3);
      color: #fff;
      padding: 0.6rem 1rem;
      border-radius: 999px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: bold;
      opacity: 0.4;
      transition: opacity 0.2s;
    }
    .fullscreen-btn:hover {
      opacity: 1;
    }
  </style>
</head>
<body>
  <div id="tv-stage">
    <!-- Top Bar -->
    <div class="top-bar">
      <div class="store-brand">
        <div class="store-dot"></div>
        <div>
          <div class="store-name" id="store-name">${settings.storeName || 'MI COMERCIO'}</div>
          <div class="store-tagline" id="store-tagline">${settings.storeTagline || 'OFERTAS & ESPECIALIDADES'}</div>
        </div>
      </div>
      <div class="live-widgets">
        <span id="live-clock">--:--</span>
        ${settings.showWeather ? `
        <span style="opacity:0.4;">|</span>
        <span id="live-weather">${settings.weatherCity} (${settings.weatherTemp})</span>
        ` : ''}
      </div>
    </div>

    <!-- Active Slide Container -->
    <div class="slide-container active" id="slide-stage">
      <div class="content-column">
        <div class="badge-pill" id="slide-badge">OFERTA</div>
        <h1 class="slide-title" id="slide-title">Cargando Mostrador...</h1>
        <p class="slide-subtitle" id="slide-subtitle"></p>
        <div class="highlights-list" id="slide-highlights"></div>
        <div class="price-row">
          <div class="main-price" id="slide-price"></div>
          <div class="original-price" id="slide-original-price"></div>
        </div>
        <div class="cta-button" id="slide-cta">Pídelo Ahora</div>
      </div>

      <div class="media-column" id="media-wrapper">
        <img class="media-img" id="slide-image" alt="Producto" />
        <video class="media-video" id="slide-video" muted loop playsinline style="display:none;"></video>
      </div>
    </div>

    <!-- Bottom Bar & Progress -->
    <div class="bottom-bar">
      <div class="progress-bar-container">
        <div class="progress-bar-fill" id="progress-bar"></div>
      </div>
      <div class="ticker-bar">
        <div class="ticker-content" id="ticker-text">Bienvenido · Consulta nuestras ofertas del día</div>
      </div>
    </div>

    <div class="keyboard-hint" id="keyboard-hint">F: Pantalla Completa | Espacio: Pausa | Flechas: Navegar</div>
    <button class="fullscreen-btn" id="fs-btn">⛶ Pantalla Completa</button>
  </div>

  <script>
    const SLIDES = ${serializedSlides};
    const TEMPLATES = ${serializedTemplates};
    const SETTINGS = ${serializedSettings};

    let currentIndex = 0;
    let isPaused = false;
    let timer = null;
    let progressTimer = null;
    let currentDuration = 10;
    let elapsedSeconds = 0;

    // Helper: Check schedule active
    function isSlideActive(slide) {
      if (!slide.active) return false;
      if (!slide.schedule || !slide.schedule.enabled) return true;
      const now = new Date();
      const currentDay = now.getDay();
      if (slide.schedule.daysOfWeek && !slide.schedule.daysOfWeek.includes(currentDay)) {
        return false;
      }
      const hour = now.getHours();
      const minute = now.getMinutes();
      const currentTotalMin = hour * 60 + minute;
      const slot = slide.schedule.timeSlot;

      if (slot === 'morning') return currentTotalMin >= 7 * 60 && currentTotalMin < 12 * 60;
      if (slot === 'lunch') return currentTotalMin >= 12 * 60 && currentTotalMin < 16.5 * 60;
      if (slot === 'afternoon') return currentTotalMin >= 16.5 * 60 && currentTotalMin < 20.5 * 60;
      if (slot === 'evening') return currentTotalMin >= 20.5 * 60 || currentTotalMin < 2 * 60;
      if (slot === 'custom' && slide.schedule.customStart && slide.schedule.customEnd) {
        const [sh, sm] = slide.schedule.customStart.split(':').map(Number);
        const [eh, em] = slide.schedule.customEnd.split(':').map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        return currentTotalMin >= startMin && currentTotalMin <= endMin;
      }
      return true;
    }

    function getActiveSlides() {
      const active = SLIDES.filter(isSlideActive);
      return active.length > 0 ? active : SLIDES;
    }

    function renderSlide(index) {
      const activeSlides = getActiveSlides();
      if (index >= activeSlides.length) index = 0;
      if (index < 0) index = activeSlides.length - 1;
      currentIndex = index;

      const slide = activeSlides[currentIndex];
      const template = TEMPLATES.find(t => t.id === slide.templateId) || TEMPLATES[0];

      // Transition fade
      const stage = document.getElementById('slide-stage');
      const tvStage = document.getElementById('tv-stage');
      stage.classList.remove('active');

      setTimeout(() => {
        // Set background gradient
        tvStage.style.background = template.bgGradient || '#0f172a';

        // Badge
        const badgeEl = document.getElementById('slide-badge');
        badgeEl.textContent = slide.badge;
        badgeEl.style.backgroundColor = slide.badgeColor || template.badgeBg || '#f59e0b';
        badgeEl.style.color = template.badgeText || '#000';

        // Titles
        document.getElementById('slide-title').textContent = slide.title;
        document.getElementById('slide-subtitle').textContent = slide.subtitle || '';

        // Highlights
        const hlContainer = document.getElementById('slide-highlights');
        hlContainer.innerHTML = '';
        if (slide.highlights && slide.highlights.length > 0) {
          slide.highlights.forEach(h => {
            const row = document.createElement('div');
            row.className = 'highlight-item';
            row.innerHTML = '<div class="highlight-bullet" style="background:' + template.accentColor + '; box-shadow:0 0 8px ' + template.accentColor + ';"></div><span>' + h + '</span>';
            hlContainer.appendChild(row);
          });
        }

        // Price
        const priceEl = document.getElementById('slide-price');
        priceEl.textContent = slide.price || '';
        priceEl.style.color = template.priceColor || '#f59e0b';

        const origEl = document.getElementById('slide-original-price');
        origEl.textContent = slide.originalPrice || '';

        // CTA
        const ctaEl = document.getElementById('slide-cta');
        ctaEl.textContent = slide.ctaText || 'Pídelo ahora';
        ctaEl.style.backgroundColor = template.accentColor || '#fff';

        // Media (Image or Video)
        const imgEl = document.getElementById('slide-image');
        const vidEl = document.getElementById('slide-video');
        const mediaSource = slide.useCutout && slide.mediaCutoutUrl ? slide.mediaCutoutUrl : slide.mediaUrl;

        if (slide.mediaType === 'video') {
          imgEl.style.display = 'none';
          vidEl.style.display = 'block';
          vidEl.src = mediaSource;
          vidEl.currentTime = 0;
          vidEl.play().catch(() => {});
        } else {
          vidEl.pause();
          vidEl.style.display = 'none';
          imgEl.style.display = 'block';
          imgEl.src = mediaSource;
        }

        // Ticker
        const tickerEl = document.getElementById('ticker-text');
        tickerEl.textContent = slide.tickerText || SETTINGS.globalTickerText || '';

        // Duration
        currentDuration = slide.useCustomDuration ? slide.duration : SETTINGS.defaultDuration;
        elapsedSeconds = 0;

        stage.classList.add('active');
        restartTimers();
      }, 300);
    }

    function nextSlide() {
      const activeSlides = getActiveSlides();
      let nextIdx = currentIndex + 1;
      if (nextIdx >= activeSlides.length) {
        if (SETTINGS.loop) {
          nextIdx = 0;
        } else {
          return; // Stop at end if loop disabled
        }
      }
      renderSlide(nextIdx);
    }

    function prevSlide() {
      const activeSlides = getActiveSlides();
      let prevIdx = currentIndex - 1;
      if (prevIdx < 0) prevIdx = activeSlides.length - 1;
      renderSlide(prevIdx);
    }

    function restartTimers() {
      clearInterval(timer);
      clearInterval(progressTimer);
      if (isPaused) return;

      const progressEl = document.getElementById('progress-bar');
      const stepMs = 100;
      const totalMs = currentDuration * 1000;
      let currentMs = 0;

      progressTimer = setInterval(() => {
        if (isPaused) return;
        currentMs += stepMs;
        const pct = Math.min(100, (currentMs / totalMs) * 100);
        progressEl.style.width = pct + '%';

        if (currentMs >= totalMs) {
          clearInterval(progressTimer);
          nextSlide();
        }
      }, stepMs);
    }

    // Live Clock updater
    function updateClock() {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const clockEl = document.getElementById('live-clock');
      if (clockEl) clockEl.textContent = h + ':' + m;
    }
    setInterval(updateClock, 1000);
    updateClock();

    // Fullscreen trigger
    function toggleFullScreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
      }
    }

    document.getElementById('fs-btn').addEventListener('click', toggleFullScreen);

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        isPaused = !isPaused;
      } else if (e.code === 'ArrowRight') {
        nextSlide();
      } else if (e.code === 'ArrowLeft') {
        prevSlide();
      } else if (e.code === 'KeyF') {
        toggleFullScreen();
      }
    });

    // Fade out hint after 6s
    setTimeout(() => {
      const hint = document.getElementById('keyboard-hint');
      if (hint) hint.style.opacity = '0';
    }, 6000);

    // Initial render
    renderSlide(0);
  </script>
</body>
</html>`;
}

/**
 * Robustly and safely loads an image for HTML5 Canvas rendering.
 * Works with base64 data URLs (PC/mobile uploads), blob URLs, and external web URLs (with CORS handling and fallback).
 * Never throws or leaves a blank canvas.
 */
export async function loadSlideImageSafe(url: string | undefined): Promise<HTMLImageElement | null> {
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  const trimmed = url.trim();

  // 1. Check if the URL is a video (e.g. mp4, webm, or sample video URL)
  const isVideo =
    trimmed.endsWith('.mp4') ||
    trimmed.endsWith('.webm') ||
    trimmed.includes('/sample/ForBigger') ||
    trimmed.includes('commondatastorage.googleapis.com');

  if (isVideo) {
    return new Promise((resolve) => {
      const vid = document.createElement('video');
      vid.crossOrigin = 'anonymous';
      vid.muted = true;
      vid.preload = 'metadata';
      const timeout = setTimeout(() => {
        vid.src = '';
        resolve(null);
      }, 2500);

      vid.onloadeddata = () => {
        try {
          vid.currentTime = 0.5;
        } catch {
          clearTimeout(timeout);
          resolve(null);
        }
      };

      vid.onseeked = () => {
        clearTimeout(timeout);
        try {
          const offCanvas = document.createElement('canvas');
          const targetW = Math.max(1280, vid.videoWidth || 1920);
          const targetH = Math.max(720, vid.videoHeight || 1080);
          offCanvas.width = targetW;
          offCanvas.height = targetH;
          const offCtx = offCanvas.getContext('2d');
          if (offCtx) {
            offCtx.imageSmoothingEnabled = true;
            offCtx.imageSmoothingQuality = 'high';
            offCtx.drawImage(vid, 0, 0, targetW, targetH);
            const shotImg = new Image();
            shotImg.onload = async () => {
              try { if (shotImg.decode) await shotImg.decode(); } catch {}
              resolve(shotImg);
            };
            shotImg.onerror = () => resolve(null);
            shotImg.src = offCanvas.toDataURL('image/jpeg', 0.95);
            return;
          }
        } catch {
          // ignore
        }
        resolve(null);
      };

      vid.onerror = () => {
        clearTimeout(timeout);
        resolve(null);
      };

      vid.src = trimmed;
    });
  }

  // Helper to ensure image is decompressed into memory before canvas draw
  const decodeAndResolve = async (img: HTMLImageElement, res: (val: HTMLImageElement | null) => void) => {
    try {
      if (typeof img.decode === 'function') {
        await img.decode();
      }
    } catch {
      // Ignored
    }
    res(img);
  };

  // 2. Local base64 or blob URLs (direct from device or camera, 100% offline, no CORS issues)
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return new Promise((resolve) => {
      const img = new Image();
      const timeout = setTimeout(() => resolve(null), 2500);
      img.onload = () => {
        clearTimeout(timeout);
        decodeAndResolve(img, resolve);
      };
      img.onerror = () => {
        clearTimeout(timeout);
        resolve(null);
      };
      img.src = trimmed;
    });
  }

  // 3. External HTTP/HTTPS URLs with strict 3.5s timeout to prevent hanging exports
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 3500);

    const corsImg = new Image();
    corsImg.crossOrigin = 'anonymous';
    corsImg.onload = () => {
      clearTimeout(timer);
      decodeAndResolve(corsImg, resolve);
    };

    corsImg.onerror = async () => {
      // Fallback: Fetch as Blob and create Object URL
      try {
        const res = await fetch(trimmed, { mode: 'cors' });
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const blobImg = new Image();
        blobImg.onload = () => {
          clearTimeout(timer);
          decodeAndResolve(blobImg, resolve);
        };
        blobImg.onerror = () => {
          clearTimeout(timer);
          resolve(null);
        };
        blobImg.src = blobUrl;
      } catch {
        // Last attempt: standard image load without crossOrigin
        const fallbackImg = new Image();
        fallbackImg.onload = () => {
          clearTimeout(timer);
          decodeAndResolve(fallbackImg, resolve);
        };
        fallbackImg.onerror = () => {
          clearTimeout(timer);
          resolve(null);
        };
        fallbackImg.src = trimmed;
      }
    };

    corsImg.src = trimmed;
  });
}

export interface DrawFrameOptions {
  width?: number; // default 1920
  height?: number; // default 1080
  progressPct?: number; // 0 to 1
  tickerOffset?: number; // horizontal translation in pixels
  fadeAlpha?: number; // 0 to 1 for cross-fade
  preloadedImage?: HTMLImageElement | null;
  timeStr?: string;
  isNextSlideFade?: boolean;
  elapsedSeconds?: number;
  slideDurationSeconds?: number;
}

// Commercial broadcast easing functions
function easeOutCubic(t: number): number {
  const clampT = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - clampT, 3);
}

function easeOutBack(t: number): number {
  const clampT = Math.max(0, Math.min(1, t));
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(clampT - 1, 3) + c1 * Math.pow(clampT - 1, 2);
}

/**
 * Draws a pixel-perfect 1920x1080 promotional slide frame onto a canvas,
 * with eye-catching commercial animations (McDonald's / Fast-Food style)
 * including floating breathing products, gleaming badge sweeps, price impact pulses, and particle ambience.
 */
export function drawSlideFrame(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  template: Template,
  settings: GlobalSettings,
  options: DrawFrameOptions = {}
): void {
  const width = options.width || 1920;
  const height = options.height || 1080;
  const progressPct = Math.max(0, Math.min(1, options.progressPct ?? 1));
  const tickerOffset = options.tickerOffset || 0;
  const fadeAlpha = Math.max(0, Math.min(1, options.fadeAlpha ?? 1));
  const preloadedImage = options.preloadedImage;
  const elapsedSec =
    options.elapsedSeconds !== undefined
      ? options.elapsedSeconds
      : progressPct * (options.slideDurationSeconds || 6);

  ctx.save();
  ctx.globalAlpha = fadeAlpha;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // -------------------------------------------------------------
  // 1. Background (Gradient + Industrial/Commercial Theme Match)
  // -------------------------------------------------------------
  const grad = ctx.createRadialGradient(
    width * 0.45,
    height * 0.45,
    100,
    width * 0.5,
    height * 0.5,
    width * 0.75
  );

  const tId = template.id || '';
  const theme = template.theme;
  const accentColor = template.accentColor || '#f59e0b';

  if (tId === 'tpl-hardware-dewalt' || tId.includes('dewalt')) {
    grad.addColorStop(0, '#24252a');
    grad.addColorStop(0.5, '#16171b');
    grad.addColorStop(1, '#090a0d');
  } else if (tId === 'tpl-hardware-bosch' || tId.includes('bosch')) {
    grad.addColorStop(0, '#0e233d');
    grad.addColorStop(0.55, '#071322');
    grad.addColorStop(1, '#03080e');
  } else if (tId === 'tpl-hardware-milwaukee' || tId.includes('milwaukee')) {
    grad.addColorStop(0, '#2b0707');
    grad.addColorStop(0.55, '#140303');
    grad.addColorStop(1, '#080101');
  } else if (tId === 'tpl-hardware-stanley' || tId.includes('stanley')) {
    grad.addColorStop(0, '#1c1d23');
    grad.addColorStop(0.55, '#111216');
    grad.addColorStop(1, '#0a0a0c');
  } else if (theme === 'gourmet-warm') {
    grad.addColorStop(0, '#2e180d');
    grad.addColorStop(0.55, '#160b05');
    grad.addColorStop(1, '#0b0502');
  } else if (theme === 'flash-sale') {
    grad.addColorStop(0, '#420b0b');
    grad.addColorStop(0.55, '#1e0505');
    grad.addColorStop(1, '#0c0202');
  } else if (theme === 'fresh-minimal') {
    grad.addColorStop(0, '#042d23');
    grad.addColorStop(0.55, '#061a15');
    grad.addColorStop(1, '#020b08');
  } else if (theme === 'dark-luxury') {
    grad.addColorStop(0, '#141824');
    grad.addColorStop(0.55, '#0b0d14');
    grad.addColorStop(1, '#05060a');
  } else {
    grad.addColorStop(0, '#18181b');
    grad.addColorStop(0.55, '#0f0f11');
    grad.addColorStop(1, '#070708');
  }

  const isExclusiveLogo = slide.layoutType === 'exclusive-logo';
  // Respect settings to hide header (e.g. ferreteria top bar) and bottom ticker/progress bar
  const shouldHideHeader = settings.showStoreHeader !== true || (isExclusiveLogo && Boolean(slide.hideHeader));
  const shouldHideTicker = (settings.showTicker !== true && settings.showProgressBar !== true) || (isExclusiveLogo && Boolean(slide.hideTicker));
  const topOffset = shouldHideHeader ? 0 : 100;
  const bottomOffset = shouldHideTicker ? 0 : 72;
  const availableH = height - topOffset - bottomOffset;

  if (isExclusiveLogo && slide.exclusiveBgType === 'pure-black') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
  } else if (isExclusiveLogo && slide.exclusiveBgType === 'radial-glow') {
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, width * 0.7);
    bgGrad.addColorStop(0, safeColorWithAlpha(accentColor, 0.22));
    bgGrad.addColorStop(0.65, '#06060a');
    bgGrad.addColorStop(1, '#000000');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // -------------------------------------------------------------
  // Ambient Lighting & Floating Commercial Sparkles (McDonald's Broadcast Style)
  // -------------------------------------------------------------
  ctx.save();
  for (let i = 0; i < 14; i++) {
    const seed = i * 137.5;
    const px = (seed * 21.7 + Math.sin(elapsedSec * 0.7 + i) * 70) % width;
    const py = height - ((elapsedSec * 38 + seed * 8.5) % (height - 130)) - 70;
    const pSize = 2.5 + (i % 3) * 2;
    const pAlpha = Math.max(0, Math.min(1, (0.12 + 0.12 * Math.sin(elapsedSec * 2.2 + i)) * fadeAlpha));
    ctx.fillStyle = `rgba(255, 215, 110, ${pAlpha})`;
    ctx.beginPath();
    ctx.arc(px, py, pSize, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // -------------------------------------------------------------
  // 2. Large Atmospheric Ambient Lighting Halo behind product (Standard mode)
  // -------------------------------------------------------------
  if (!isExclusiveLogo) {
    const haloCenterX = width * 0.29;
    const haloCenterY = topOffset + availableH / 2;
    const haloPulse = 1 + Math.sin(elapsedSec * 2.4) * 0.14;
    const haloRadius = (shouldHideHeader && shouldHideTicker ? 490 : 420) * haloPulse;

    const haloAlphaMid = Math.max(0, Math.min(1, (0.28 + 0.10 * Math.sin(elapsedSec * 2.0)) * fadeAlpha));
    const haloGrad = ctx.createRadialGradient(
      haloCenterX,
      haloCenterY,
      35,
      haloCenterX,
      haloCenterY,
      haloRadius
    );
    haloGrad.addColorStop(0, safeColorWithAlpha(accentColor, 0.28 * fadeAlpha));
    haloGrad.addColorStop(0.65, safeColorWithAlpha(accentColor, haloAlphaMid));
    haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(haloCenterX, haloCenterY, haloRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // -------------------------------------------------------------
  // 3. Top Header Bar (Store Name, Logo, Clock)
  // -------------------------------------------------------------
  if (!shouldHideHeader) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(0, 0, width, 100);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 100);
    ctx.lineTo(width, 100);
    ctx.stroke();

    // Store Brand Emblem (TV pill or custom Logo)
    ctx.fillStyle = accentColor;
    roundRect(ctx, 70, 24, 52, 52, 14);
    ctx.fill();

    ctx.font = '900 24px sans-serif';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText('TV', 96, 59);
    ctx.textAlign = 'left';

    // Store Name
    ctx.font = '900 28px sans-serif';
    const storeTitle = (settings.storeName || 'MI MOSTRADOR TV').toUpperCase();
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillText(storeTitle, 140, 58);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(storeTitle, 138, 56);

    // Store Tagline
    if (settings.storeTagline) {
      ctx.font = '500 16px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.fillText(settings.storeTagline, 138, 80);
    }

    // Center Category Pill (if slide has a category)
    if (slide.category) {
      ctx.font = '700 15px sans-serif';
      const catText = slide.category.toUpperCase();
      const catW = ctx.measureText(catText).width + 36;
      const catX = width * 0.48 - catW / 2;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
      roundRect(ctx, catX, 28, catW, 44, 22);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 1;
      roundRect(ctx, catX, 28, catW, 44, 22);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillText(catText, catX + 18, 56);
    }

    // Right Side Live Digital Clock (Capsule Pill)
    const now = new Date();
    const timeStr =
      options.timeStr ||
      `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const clockX = width - 210;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    roundRect(ctx, clockX, 26, 140, 48, 24);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    roundRect(ctx, clockX, 26, 140, 48, 24);
    ctx.stroke();

    // Green active pulse indicator dot
    const clockDotPulse = 1 + Math.sin(elapsedSec * 4.0) * 0.25;
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(clockX + 26, 50, 6 * clockDotPulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(timeStr, clockX + 44, 57);
  }

  if (isExclusiveLogo) {
    // -------------------------------------------------------------
    // EXCLUSIVE LOGO / DIAPOSITIVA LIBRE LAYOUT (Full HD 1080p Animated)
    // -------------------------------------------------------------
    const topOffset = shouldHideHeader ? 0 : 100;
    const bottomOffset = shouldHideTicker ? 0 : 72;
    const availableH = height - topOffset - bottomOffset;
    const centerX = width / 2;
    const centerY = topOffset + availableH / 2;

    const scalePercent = Math.max(20, Math.min(100, slide.logoScale || 90)) / 100;
    const hasSubtitle = Boolean(slide.showSubtitleUnderLogo && (slide.subtitle || settings.storeTagline));

    // Logo Box constraints (Expansive to fill up to 95% of TV screen)
    const maxBoxW = width * 0.95 * scalePercent;
    const maxBoxH = (hasSubtitle ? availableH * 0.82 : availableH * 0.94) * scalePercent;

    // Commercial Logo Motion
    const logoEnterT = Math.min(1, elapsedSec / 0.85);
    const logoScaleEnter = 0.88 + 0.12 * easeOutBack(logoEnterT);
    const logoAlpha = easeOutCubic(logoEnterT) * fadeAlpha;
    const logoFloatY = Math.sin(elapsedSec * 1.8) * 7;
    const logoBreathe = 1 + Math.sin(elapsedSec * 1.5) * 0.025;

    // Ambient Halo Glow
    if (slide.showHaloGlow !== false) {
      const haloR = Math.max(maxBoxW, maxBoxH) * 0.65 * (1 + Math.sin(elapsedSec * 2.0) * 0.1);
      const logoHaloGrad = ctx.createRadialGradient(
        centerX,
        centerY - (hasSubtitle ? 30 : 0) + logoFloatY,
        20,
        centerX,
        centerY - (hasSubtitle ? 30 : 0) + logoFloatY,
        haloR
      );
      logoHaloGrad.addColorStop(0, accentColor + '50');
      logoHaloGrad.addColorStop(0.7, accentColor + '12');
      logoHaloGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = logoHaloGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY - (hasSubtitle ? 30 : 0) + logoFloatY, haloR, 0, Math.PI * 2);
      ctx.fill();
    }

    if (preloadedImage && preloadedImage.width > 0) {
      const imgW = preloadedImage.width;
      const imgH = preloadedImage.height;
      const isCover = slide.logoFit === 'cover';

      let drawW: number;
      let drawH: number;

      if (isCover) {
        const coverScale = Math.max(maxBoxW / imgW, maxBoxH / imgH);
        drawW = imgW * coverScale;
        drawH = imgH * coverScale;
      } else {
        const containScale = Math.min(maxBoxW / imgW, maxBoxH / imgH);
        drawW = imgW * containScale;
        drawH = imgH * containScale;
      }

      ctx.save();
      ctx.translate(centerX, centerY - (hasSubtitle ? 30 : 0) + logoFloatY);
      ctx.scale(logoScaleEnter * logoBreathe, logoScaleEnter * logoBreathe);
      ctx.globalAlpha = logoAlpha;

      // Soft drop shadow without expensive shadowBlur
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      roundRect(ctx, -drawW / 2 + 6, -drawH / 2 + 10, drawW, drawH, 24);
      ctx.fill();

      if (isCover) {
        roundRect(ctx, -maxBoxW / 2, -maxBoxH / 2, maxBoxW, maxBoxH, 32);
        ctx.clip();
      }

      ctx.drawImage(preloadedImage, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    } else {
      // Clean fallback emblem if no image uploaded yet
      ctx.save();
      ctx.translate(centerX, centerY - (hasSubtitle ? 160 : 130) + logoFloatY);
      ctx.scale(logoScaleEnter, logoScaleEnter);
      ctx.globalAlpha = logoAlpha;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      roundRect(ctx, -350, 0, 700, 260, 28);
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 3;
      roundRect(ctx, -350, 0, 700, 260, 28);
      ctx.stroke();

      ctx.font = '900 52px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText((slide.title || settings.storeName || 'MI EMPRESA').toUpperCase(), 0, 140);
      ctx.restore();
    }

    // Subtitle / Slogan under logo
    if (hasSubtitle) {
      const sloganEnterT = Math.min(1, Math.max(0, (elapsedSec - 0.2) / 0.65));
      const sloganOffsetY = (1 - easeOutCubic(sloganEnterT)) * 24;
      const sloganAlpha = easeOutCubic(sloganEnterT) * fadeAlpha;

      const subText = slide.subtitle || settings.storeTagline || '';
      const effectiveScale = slide.fontSizeScale || settings.globalTextScale || 'standard';
      const fontMultiplier =
        effectiveScale === 'massive'
          ? 1.85
          : effectiveScale === 'huge'
          ? 1.5
          : effectiveScale === 'large'
          ? 1.25
          : 1.0;
      const sloganFontSize = Math.round(36 * fontMultiplier);

      ctx.save();
      ctx.globalAlpha = sloganAlpha;
      ctx.font = `700 ${sloganFontSize}px sans-serif`;
      ctx.textAlign = 'center';
      const subY = centerY + (maxBoxH / 2) + Math.round(sloganFontSize * 0.7) + sloganOffsetY;
      const finalSloganY = Math.min(height - bottomOffset - 35, subY);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillText(subText, centerX + 2, finalSloganY + 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fillText(subText, centerX, finalSloganY);
      ctx.restore();
    }
  } else {
    // -------------------------------------------------------------
    // 4. Product Image Column (Left Side - Large Commercial Hero)
    // -------------------------------------------------------------
    const mediaAreaCenterX = width * 0.29;
    const mediaAreaCenterY = topOffset + availableH / 2;
    const maxImgW = shouldHideHeader && shouldHideTicker ? 950 : 860;
    const maxImgH = shouldHideHeader && shouldHideTicker ? 970 : 780;

    // Commercial Entrance Animation (0s to 0.75s)
    const enterT = Math.min(1, elapsedSec / 0.75);
    const enterScale = 0.82 + 0.18 * easeOutBack(enterT);
    const enterAlpha = easeOutCubic(enterT);
    const enterY = (1 - easeOutCubic(enterT)) * 36;

    // Continuous McDonald's Floating & Breathing
    const floatY = Math.sin(elapsedSec * 2.2) * 8.5;
    const floatScale = 1 + Math.sin(elapsedSec * 1.8) * 0.024;
    const floatTilt = Math.sin(elapsedSec * 1.4) * 0.012; // ~0.7 degrees gentle tilt

    const currentProductScale = enterScale * floatScale;
    const currentProductY = enterY + floatY;
    const currentProductAlpha = enterAlpha * fadeAlpha;

    if (preloadedImage && preloadedImage.width > 0) {
      const baseScale = Math.min(
        maxImgW / preloadedImage.width,
        maxImgH / preloadedImage.height,
        2.5
      );
      const drawW = preloadedImage.width * baseScale;
      const drawH = preloadedImage.height * baseScale;

      ctx.save();
      ctx.translate(mediaAreaCenterX, mediaAreaCenterY + currentProductY);
      ctx.rotate(floatTilt);
      ctx.scale(currentProductScale, currentProductScale);
      ctx.globalAlpha = currentProductAlpha;

      if (slide.useCutout) {
        // Floating cutout product with realistic soft elliptical ground shadow (instant, smooth 60fps)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.ellipse(0, drawH / 2 + 10, drawW * 0.42, 18, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.drawImage(preloadedImage, -drawW / 2, -drawH / 2, drawW, drawH);

        // "✦ SIN FONDO" badge
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        roundRect(ctx, -drawW / 2 + 12, drawH / 2 - 40, 130, 30, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        roundRect(ctx, -drawW / 2 + 12, drawH / 2 - 40, 130, 30, 6);
        ctx.stroke();
        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = '#34d399';
        ctx.fillText('✦ SIN FONDO', -drawW / 2 + 24, drawH / 2 - 20);
      } else {
        // Clean photo card container with crisp drop shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        roundRect(ctx, -drawW / 2 + 6, -drawH / 2 + 10, drawW, drawH, 24);
        ctx.fill();

        ctx.save();
        roundRect(ctx, -drawW / 2, -drawH / 2, drawW, drawH, 24);
        ctx.clip();
        ctx.drawImage(preloadedImage, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 2.5;
        roundRect(ctx, -drawW / 2, -drawH / 2, drawW, drawH, 24);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      // Stylized promo placeholder if no photo was assigned
      ctx.save();
      ctx.translate(mediaAreaCenterX, mediaAreaCenterY + currentProductY);
      ctx.scale(currentProductScale, currentProductScale);
      ctx.globalAlpha = currentProductAlpha;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      roundRect(ctx, -320, -240, 640, 480, 28);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 2;
      roundRect(ctx, -320, -240, 640, 480, 28);
      ctx.stroke();

      ctx.font = '900 56px sans-serif';
      ctx.fillStyle = accentColor;
      ctx.textAlign = 'center';
      ctx.fillText('★ PROMO ★', 0, 0);

      ctx.font = '600 24px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText(slide.title.slice(0, 35), 0, 50);
      ctx.textAlign = 'left';
      ctx.restore();
    }

    // -------------------------------------------------------------
    // 5. Promotional Text & Price Column (Right Side Animated - Expansive)
    // -------------------------------------------------------------
    const effectiveScale = slide.fontSizeScale || settings.globalTextScale || 'standard';
    const fontMultiplier =
      effectiveScale === 'massive'
        ? 1.95
        : effectiveScale === 'huge'
        ? 1.6
        : effectiveScale === 'large'
        ? 1.3
        : 1.1;

    const textX = width * 0.50;
    const maxTextW = width * 0.46;
    let textY = shouldHideHeader
      ? (effectiveScale === 'massive' ? 75 : effectiveScale === 'huge' ? 85 : 95)
      : (effectiveScale === 'massive' ? 140 : effectiveScale === 'huge' ? 150 : 160);

    // Badge Pill with McDonald's Shimmer Sweep
    const badgeText = (slide.badge || 'PROMO ESPECIAL').toUpperCase();
    const badgeFontSize = Math.round(
      22 * (effectiveScale === 'massive' ? 1.4 : effectiveScale === 'huge' ? 1.25 : effectiveScale === 'large' ? 1.15 : 1)
    );
    ctx.font = `900 ${badgeFontSize}px sans-serif`;
    const badgeW = ctx.measureText(badgeText).width + 42;
    const badgeH = Math.round(44 * (fontMultiplier > 1 ? 1.15 : 1));

    const badgeEnterT = Math.min(1, Math.max(0, (elapsedSec - 0.08) / 0.45));
    const badgeScale = badgeEnterT === 0 ? 0 : 0.6 + 0.4 * easeOutBack(badgeEnterT);
    const badgeAlpha = easeOutCubic(badgeEnterT) * fadeAlpha;

    ctx.save();
    ctx.translate(textX, textY);
    ctx.scale(badgeScale, badgeScale);
    ctx.globalAlpha = badgeAlpha;

    ctx.fillStyle = slide.badgeColor || template.badgeBg || accentColor;
    roundRect(ctx, 0, 0, badgeW, badgeH, 12);
    ctx.fill();

    ctx.fillStyle = template.badgeText || '#ffffff';
    ctx.fillText(badgeText, 20, badgeFontSize + 9);

    // McDonald's Signature Shimmer Sweep
    const shimmerCycle = (elapsedSec % 2.5) / 0.55;
    if (shimmerCycle >= 0 && shimmerCycle <= 1) {
      const shineX = -35 + shimmerCycle * (badgeW + 70);
      ctx.save();
      roundRect(ctx, 0, 0, badgeW, badgeH, 12);
      ctx.clip();
      const shineGrad = ctx.createLinearGradient(shineX - 25, 0, shineX + 25, badgeH);
      shineGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      shineGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.88)');
      shineGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = shineGrad;
      ctx.fillRect(0, 0, badgeW, badgeH);
      ctx.restore();
    }
    ctx.restore();

    textY += badgeH + 28;

    // Slide Headline / Title Slide-In (Enlarged)
    const titleEnterT = Math.min(1, Math.max(0, (elapsedSec - 0.12) / 0.55));
    const titleOffsetX = (1 - easeOutCubic(titleEnterT)) * 42;
    const titleAlpha = easeOutCubic(titleEnterT) * fadeAlpha;

    const isSparse = !slide.price && (!slide.highlights || slide.highlights.length === 0);
    const baseTitleSize = isSparse ? 80 : 66;
    const titleFontSize = Math.round(baseTitleSize * fontMultiplier);
    const lineSpacing = Math.round(titleFontSize * 1.15);

    ctx.save();
    ctx.translate(titleOffsetX, 0);
    ctx.globalAlpha = titleAlpha;
    ctx.font = `900 ${titleFontSize}px sans-serif`;

    const words = (slide.title || 'Promoción Especial').split(' ');
    let currentLine = '';
    let lineCount = 0;

    for (let n = 0; n < words.length; n++) {
      const testLine = currentLine ? currentLine + ' ' + words[n] : words[n];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxTextW && n > 0 && lineCount < 2) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillText(currentLine, textX + 3, textY + 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(currentLine, textX, textY);
        currentLine = words[n];
        textY += lineSpacing;
        lineCount++;
      } else {
        currentLine = testLine;
      }
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillText(currentLine, textX + 3, textY + 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(currentLine, textX, textY);
    ctx.restore();

    textY += Math.round(titleFontSize * 0.84);

    // Subtitle / Commercial benefit Slide-In (Enlarged)
    if (slide.subtitle) {
      const subEnterT = Math.min(1, Math.max(0, (elapsedSec - 0.22) / 0.55));
      const subOffsetX = (1 - easeOutCubic(subEnterT)) * 36;
      const subAlpha = easeOutCubic(subEnterT) * fadeAlpha;

      const subFontSize = Math.round((isSparse ? 34 : 30) * fontMultiplier);
      const subLineSpacing = Math.round(subFontSize * 1.35);

      ctx.save();
      ctx.translate(subOffsetX, 0);
      ctx.globalAlpha = subAlpha;
      ctx.font = `500 ${subFontSize}px sans-serif`;

      const subWords = slide.subtitle.split(' ');
      let subLine = '';
      let subLines = 0;
      for (let i = 0; i < subWords.length; i++) {
        const testSub = subLine ? subLine + ' ' + subWords[i] : subWords[i];
        if (ctx.measureText(testSub).width > maxTextW && i > 0 && subLines < 2) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
          ctx.fillText(subLine, textX + 2, textY + 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
          ctx.fillText(subLine, textX, textY);
          subLine = subWords[i];
          textY += subLineSpacing;
          subLines++;
        } else {
          subLine = testSub;
        }
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillText(subLine, textX + 2, textY + 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.fillText(subLine, textX, textY);
      ctx.restore();

      textY += Math.round(subFontSize * 1.3);
    }

    // Highlights Bullets (Up to 3 items) with Sequential Stagger (Enlarged)
    if (slide.highlights && slide.highlights.length > 0) {
      const items = slide.highlights.slice(0, 3);
      const bulletFontSize = Math.round(25 * fontMultiplier);
      const bulletSpacing = Math.round(bulletFontSize * 1.55);
      items.forEach((point, idx) => {
        if (!point || !point.trim()) return;
        const itemEnterT = Math.min(1, Math.max(0, (elapsedSec - 0.32 - idx * 0.12) / 0.45));
        const itemOffsetX = (1 - easeOutCubic(itemEnterT)) * 30;
        const itemAlpha = easeOutCubic(itemEnterT) * fadeAlpha;

        ctx.save();
        ctx.translate(itemOffsetX, 0);
        ctx.globalAlpha = itemAlpha;

        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.arc(textX + 10, textY - 8, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = `600 ${bulletFontSize}px sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillText(point.trim(), textX + 30, textY);
        ctx.restore();

        textY += bulletSpacing;
      });
      textY += 14;
    }

    // Big Price Tag + Original Price (McDonald's Pop & Rhythmic Heartbeat Pulse - Enlarged)
    const priceY = Math.max(textY + 20, height - 240);
    if (slide.price) {
      const priceFontSize = Math.round(92 * fontMultiplier);
      const priceEnterT = Math.min(1, Math.max(0, (elapsedSec - 0.32) / 0.5));
      const priceScaleEnter = priceEnterT === 0 ? 0 : 0.6 + 0.4 * easeOutBack(priceEnterT);

      // Periodic commercial heartbeat pulse every 2.6s
      const pricePulseCycle = (elapsedSec % 2.6) / 0.5;
      const pricePulse = pricePulseCycle <= 1 ? 1 + Math.sin(pricePulseCycle * Math.PI) * 0.08 : 1;
      const totalScaledPrice = priceScaleEnter * pricePulse;
      const priceAlpha = easeOutCubic(priceEnterT) * fadeAlpha;

      ctx.save();
      ctx.translate(textX, priceY);
      ctx.scale(totalScaledPrice, totalScaledPrice);
      ctx.globalAlpha = priceAlpha;

      ctx.font = `950 ${priceFontSize}px sans-serif`;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillText(slide.price, 3, 3);
      ctx.fillStyle = template.priceColor || accentColor;
      ctx.fillText(slide.price, 0, 0);

      const priceW = ctx.measureText(slide.price).width;

      if (slide.originalPrice) {
        const origX = priceW + 30;
        const origFontSize = Math.round(38 * fontMultiplier);
        const origEnterT = Math.min(1, Math.max(0, (elapsedSec - 0.45) / 0.45));
        const origAlpha = easeOutCubic(origEnterT) * fadeAlpha;

        ctx.save();
        ctx.globalAlpha = origAlpha;
        ctx.font = `600 ${origFontSize}px sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.fillText(slide.originalPrice, origX, -14);

        // Dynamic strikethrough slash drawing from left to right
        const strikeProgress = Math.min(1, Math.max(0, (elapsedSec - 0.65) / 0.35));
        if (strikeProgress > 0) {
          const origW = ctx.measureText(slide.originalPrice).width;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(origX - 4, -28);
          ctx.lineTo(origX - 4 + (origW + 8) * strikeProgress, -28);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.restore();
    }

    // Call to Action Pill Button with Shimmer Sweep (Enlarged)
    if (slide.ctaText) {
      const ctaY = priceY + 40;
      const ctaText = slide.ctaText.toUpperCase();
      const ctaFontSize = Math.round(24 * (fontMultiplier > 1 ? 1.25 : 1));
      ctx.font = `900 ${ctaFontSize}px sans-serif`;
      const ctaW = ctx.measureText(ctaText).width + 60;
      const ctaH = Math.round(56 * (fontMultiplier > 1 ? 1.2 : 1));

      const ctaEnterT = Math.min(1, Math.max(0, (elapsedSec - 0.45) / 0.5));
      const ctaScale = ctaEnterT === 0 ? 0 : 0.6 + 0.4 * easeOutBack(ctaEnterT);
      const ctaPulse = 1 + Math.sin(elapsedSec * 3.0) * 0.025;
      const totalCtaScale = ctaScale * ctaPulse;
      const ctaAlpha = easeOutCubic(ctaEnterT) * fadeAlpha;

      ctx.save();
      ctx.translate(textX + ctaW / 2, ctaY + ctaH / 2);
      ctx.scale(totalCtaScale, totalCtaScale);
      ctx.globalAlpha = ctaAlpha;

      ctx.fillStyle = accentColor;
      roundRect(ctx, -ctaW / 2, -ctaH / 2, ctaW, ctaH, 24);
      ctx.fill();

      ctx.fillStyle = '#000000';
      ctx.fillText(ctaText, -ctaW / 2 + 25, -ctaH / 2 + ctaFontSize + 11);

      // Button shimmer sweep
      const ctaShimmerCycle = (elapsedSec % 2.8) / 0.6;
      if (ctaShimmerCycle >= 0 && ctaShimmerCycle <= 1) {
        const ctaShineX = -ctaW / 2 - 30 + ctaShimmerCycle * (ctaW + 60);
        ctx.save();
        roundRect(ctx, -ctaW / 2, -ctaH / 2, ctaW, ctaH, 24);
        ctx.clip();
        const ctaShineGrad = ctx.createLinearGradient(ctaShineX - 20, -ctaH / 2, ctaShineX + 20, ctaH / 2);
        ctaShineGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        ctaShineGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.75)');
        ctaShineGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = ctaShineGrad;
        ctx.fillRect(-ctaW / 2, -ctaH / 2, ctaW, ctaH);
        ctx.restore();
      }
      ctx.restore();
    }
  } // Closes the `else` branch of standard product slide layout

  // -------------------------------------------------------------
  // 6. Bottom Bar (Progress Bar + Ticker Banner)
  // -------------------------------------------------------------
  if (!shouldHideTicker) {
    // Dynamic Progress Bar (Indicates remaining slide time in TV mode)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(0, height - 72, width, 6);

    ctx.fillStyle = accentColor;
    ctx.fillRect(0, height - 72, width * progressPct, 6);

    // Bottom Ticker Marquee Bar
    ctx.fillStyle = 'rgba(6, 6, 8, 0.95)';
    ctx.fillRect(0, height - 66, width, 66);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 66);
    ctx.lineTo(width, height - 66);
    ctx.stroke();

    // Left Fixed Tag: Pulsing Red Dot + "INFO & OFERTAS"
    ctx.fillStyle = 'rgba(12, 12, 16, 0.95)';
    ctx.fillRect(0, height - 66, 220, 66);

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(42, height - 33, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '900 16px sans-serif';
    ctx.fillStyle = accentColor;
    ctx.fillText('INFO & OFERTAS', 62, height - 28);

    // Marquee Sliding Text
    ctx.save();
    ctx.beginPath();
    ctx.rect(225, height - 66, width - 240, 66);
    ctx.clip();

    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#ffffff';

    const rawTicker =
      slide.tickerText ||
      settings.globalTickerText ||
      '✦ Consultá promociones especiales en el mostrador ✦ Descuentos exclusivos ✦';
    const fullTicker = `✦  ${rawTicker}   ✦   ${settings.storeName || ''}   `;

    // Draw scrolling ticker loop filling the entire screen width
    const tickerTextWidth = Math.max(200, ctx.measureText(fullTicker).width);
    const modOffset = tickerOffset % tickerTextWidth;
    let drawX = 230 - modOffset;
    while (drawX < width) {
      ctx.fillText(fullTicker, drawX, height - 26);
      drawX += tickerTextWidth;
    }
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Renders an individual slide onto a high-definition 1920x1080 canvas,
 * returning a pristine JPG data URL suitable for TV photo slideshow playback.
 */
export async function renderSlideToCanvas(
  slide: Slide,
  template: Template,
  settings: GlobalSettings,
  width = 1920,
  height = 1080
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');

  // Safely load the slide product photo (works with data URLs, PC/phone photos, or web URLs)
  const mediaSrc = slide.useCutout && slide.mediaCutoutUrl ? slide.mediaCutoutUrl : slide.mediaUrl;
  const preloadedImage = await loadSlideImageSafe(mediaSrc);

  drawSlideFrame(ctx, slide, template, settings, {
    width,
    height,
    progressPct: 1,
    tickerOffset: 0,
    fadeAlpha: 1,
    preloadedImage,
    elapsedSeconds: 2.5,
    slideDurationSeconds: 6,
  });

  return canvas.toDataURL('image/jpeg', 0.95);
}

export interface VideoExportOptions {
  secondsPerSlide?: number; // default 6s
  loops?: number; // default 1
  fps?: number; // default 30
  onProgress?: (progressPct: number, statusMessage: string) => void;
  onFramePreview?: (canvas: HTMLCanvasElement) => void;
  signal?: AbortSignal;
  useSlideCustomDurations?: boolean;
  selectedSlideIds?: string[];
  includeAudio?: boolean;
  audioTrackUrl?: string;
  audioVolume?: number;
}

export interface VideoExportResult {
  blob: Blob;
  filename: string;
  mimeType: string;
  isMp4: boolean;
  durationSeconds: number;
}

/**
 * Generates an ultra-crisp Full HD (1920x1080) Video file (MP4 / WebM) of the carousel.
 * Master-clock real-time synchronization guarantees 100% natural playback speed
 * on all television players and prevents slow-motion lag or missing slides.
 */
export async function generateTvVideoBlob(
  slides: Slide[],
  templates: Template[],
  settings: GlobalSettings,
  options: VideoExportOptions = {}
): Promise<VideoExportResult> {
  const fps = options.fps || 30;
  const secondsPerSlide = Math.max(3, options.secondsPerSlide || 6);
  const loops = Math.max(1, options.loops || 1);
  const onProgress = options.onProgress;
  const onFramePreview = options.onFramePreview;
  const signal = options.signal;

  // Filter by selectedSlideIds if provided; otherwise render all slides passed in
  let slidesToRender = slides;
  if (options.selectedSlideIds && options.selectedSlideIds.length > 0) {
    const idSet = new Set(options.selectedSlideIds);
    const filtered = slides.filter((s) => idSet.has(s.id));
    if (filtered.length > 0) {
      slidesToRender = filtered;
    }
  }

  if (slidesToRender.length === 0) {
    throw new Error('No hay diapositivas para exportar a video.');
  }

  // 1. Preload ALL product images to guarantee 100% render fidelity (no missing products)
  onProgress?.(4, 'Precargando fotos del mostrador y optimizando para TV...');
  const imageMap = new Map<string, HTMLImageElement | null>();

  for (let i = 0; i < slidesToRender.length; i++) {
    const s = slidesToRender[i];
    const src = s.useCutout && s.mediaCutoutUrl ? s.mediaCutoutUrl : s.mediaUrl;
    const img = await loadSlideImageSafe(src);
    imageMap.set(s.id, img);
    onProgress?.(
      4 + Math.floor(((i + 1) / slidesToRender.length) * 8),
      `Optimizando imagen ${i + 1} de ${slidesToRender.length}...`
    );
  }

  // Calculate duration per slide
  const slideDurations: number[] = slidesToRender.map((s) => {
    if (options.useSlideCustomDurations && s.useCustomDuration && s.duration && s.duration >= 3) {
      return s.duration;
    }
    return secondsPerSlide;
  });
  const loopDuration = slideDurations.reduce((a, b) => a + b, 0);
  const totalDurationSeconds = loopDuration * loops;

  // 2. Setup 1920x1080 Full HD Canvas & Capture Stream
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('No se pudo inicializar el renderizador 2D');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Secondary canvas for seamless cross-fade transitions without black flashes or overwrites
  const transitionCanvas = document.createElement('canvas');
  transitionCanvas.width = 1920;
  transitionCanvas.height = 1080;
  const transitionCtx = transitionCanvas.getContext('2d', { alpha: false });
  if (transitionCtx) {
    transitionCtx.imageSmoothingEnabled = true;
    transitionCtx.imageSmoothingQuality = 'high';
  }

  // Check supported Video MIME types
  let mimeType = 'video/webm';
  let isMp4 = false;

  if (typeof MediaRecorder !== 'undefined') {
    if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
      mimeType = 'video/mp4;codecs=avc1';
      isMp4 = true;
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
      isMp4 = true;
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
      mimeType = 'video/webm;codecs=vp9';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
      mimeType = 'video/webm;codecs=vp8';
    }
  }

  const stream = canvas.captureStream(fps);

  // Audio setup for background music in video export
  const shouldIncludeAudio = options.includeAudio ?? settings.enableBackgroundMusic;
  const audioTrackIdOrUrl = options.audioTrackUrl || settings.musicTrackUrl;
  let audioContext: AudioContext | null = null;
  let audioElement: HTMLAudioElement | null = null;

  if (shouldIncludeAudio && audioTrackIdOrUrl) {
    try {
      onProgress?.(13, 'Preparando música de fondo para el video...');
      let resolvedAudioUrl = audioTrackIdOrUrl;
      if (audioTrackIdOrUrl.startsWith('track-')) {
        resolvedAudioUrl = await getOrGenerateTrackAudioUrl(audioTrackIdOrUrl);
      }

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
        const audioDestination = audioContext.createMediaStreamDestination();
        audioElement = new Audio(resolvedAudioUrl);
        audioElement.loop = true;
        audioElement.crossOrigin = 'anonymous';
        audioElement.volume = Math.max(0, Math.min(1, options.audioVolume ?? settings.musicVolume ?? 0.7));

        const sourceNode = audioContext.createMediaElementSource(audioElement);
        sourceNode.connect(audioDestination);

        const audioTracks = audioDestination.stream.getAudioTracks();
        if (audioTracks.length > 0) {
          stream.addTrack(audioTracks[0]);
        }
      }
    } catch (audioErr) {
      console.warn('No se pudo enlazar pista de audio al video:', audioErr);
    }
  }

  const chunks: Blob[] = [];
  // 20 Mbps bitrate guarantees razor-sharp Full HD video on large television screens
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 20000000,
  });

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  // Draw initial frame before starting recorder so stream has content immediately
  const firstSlide = slidesToRender[0];
  const firstTpl = templates.find((t) => t.id === firstSlide.templateId) || templates[0];
  drawSlideFrame(ctx, firstSlide, firstTpl, settings, {
    width: 1920,
    height: 1080,
    progressPct: 0,
    tickerOffset: 0,
    fadeAlpha: 1,
    preloadedImage: imageMap.get(firstSlide.id) || null,
    elapsedSeconds: 0,
    slideDurationSeconds: slideDurations[0],
  });

  recorder.start(100);

  if (audioElement) {
    audioElement.play().catch((e) => console.warn('Audio play error in export:', e));
  }

  // 3. Real-Time Master Clock Rendering Loop (1:1 with Real-World Seconds)
  // Guarantees natural commercial broadcast playback speed (NEVER slow motion or stretched)
  await new Promise<void>((resolve, reject) => {
    const startTime = performance.now();
    const totalDurationMs = totalDurationSeconds * 1000;
    let lastPreviewTime = 0;
    let isScheduled = false;

    function renderTick() {
      isScheduled = false;

      if (signal?.aborted) {
        recorder.stop();
        reject(new Error('Exportación de video cancelada por el usuario'));
        return;
      }

      const now = performance.now();
      const elapsedMs = now - startTime;

      if (elapsedMs >= totalDurationMs) {
        resolve();
        return;
      }

      // Exact 1:1 real-time second progression (Prevents any slow-motion lag)
      const totalElapsedSec = elapsedMs / 1000;
      const progressRatio = Math.min(1, elapsedMs / totalDurationMs);

      // Determine active slide index based on cumulative duration
      const cycleElapsed = totalElapsedSec % loopDuration;
      let accumulated = 0;
      let slideIdx = 0;
      let currentSlideElapsed = 0;
      let currentSlideDuration = slideDurations[0];

      for (let i = 0; i < slidesToRender.length; i++) {
        const dur = slideDurations[i];
        if (accumulated + dur > cycleElapsed || i === slidesToRender.length - 1) {
          slideIdx = i;
          currentSlideElapsed = cycleElapsed - accumulated;
          currentSlideDuration = dur;
          break;
        }
        accumulated += dur;
      }

      const currentSlide = slidesToRender[slideIdx];
      const nextSlideIdx = (slideIdx + 1) % slidesToRender.length;
      const nextSlide = slidesToRender[nextSlideIdx];

      const currentTpl =
        templates.find((t) => t.id === currentSlide.templateId) || templates[0];
      const nextTpl =
        templates.find((t) => t.id === nextSlide.templateId) || templates[0];

      const currentImg = imageMap.get(currentSlide.id) || null;
      const nextImg = imageMap.get(nextSlide.id) || null;

      const progressPct = Math.min(1, currentSlideElapsed / currentSlideDuration);
      // Ticker moves at dynamic commercial speed (160 px/s)
      const tickerOffset = totalElapsedSec * 160;

      // 0.6s cross-fade transition before slide end
      const transitionDuration = Math.min(0.6, currentSlideDuration * 0.25);
      const isTransition =
        slidesToRender.length > 1 &&
        currentSlideElapsed >= currentSlideDuration - transitionDuration;

      try {
        if (isTransition && transitionCtx) {
          const t =
            (currentSlideElapsed - (currentSlideDuration - transitionDuration)) /
            transitionDuration;
          const easeT = Math.max(0, Math.min(1, t * t * (3 - 2 * t)));

          // Draw current slide onto main canvas
          drawSlideFrame(ctx, currentSlide, currentTpl, settings, {
            width: 1920,
            height: 1080,
            progressPct,
            tickerOffset,
            fadeAlpha: 1,
            preloadedImage: currentImg,
            elapsedSeconds: currentSlideElapsed,
            slideDurationSeconds: currentSlideDuration,
          });

          // Draw next slide onto transition canvas
          drawSlideFrame(transitionCtx, nextSlide, nextTpl, settings, {
            width: 1920,
            height: 1080,
            progressPct: 0,
            tickerOffset,
            fadeAlpha: 1,
            preloadedImage: nextImg,
            elapsedSeconds: 0,
            slideDurationSeconds: slideDurations[nextSlideIdx],
          });

          // Dissolve next slide smoothly over current slide
          ctx.save();
          ctx.globalAlpha = easeT;
          ctx.drawImage(transitionCanvas, 0, 0);
          ctx.restore();
        } else {
          // Normal display frame with full motion
          drawSlideFrame(ctx, currentSlide, currentTpl, settings, {
            width: 1920,
            height: 1080,
            progressPct,
            tickerOffset,
            fadeAlpha: 1,
            preloadedImage: currentImg,
            elapsedSeconds: currentSlideElapsed,
            slideDurationSeconds: currentSlideDuration,
          });
        }
      } catch (err) {
        console.warn('Frame render error caught in renderTick:', err);
      }

      // Live preview and progress notification throttled to ~1 time per 500ms
      if (now - lastPreviewTime > 500) {
        lastPreviewTime = now;
        onFramePreview?.(canvas);
        const pct = Math.min(95, 12 + Math.floor(progressRatio * 83));
        onProgress?.(
          pct,
          `Grabando Diapositiva ${slideIdx + 1}/${slidesToRender.length}: "${currentSlide.title.slice(0, 20)}" (${pct}%)...`
        );
      }

      // Schedule next tick with requestAnimationFrame for 60fps smooth hardware sync
      if (!isScheduled) {
        isScheduled = true;
        if (document.hidden) {
          setTimeout(renderTick, 1000 / fps);
        } else {
          requestAnimationFrame(renderTick);
        }
      }
    }

    renderTick();
  });

  // Short pause to ensure final frames are ingested into recorder chunks
  await new Promise((r) => setTimeout(r, 200));

  // 4. Finalize Recorder & Build File
  onProgress?.(96, 'Finalizando grabación del video...');

  const rawVideoBlob = await new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
      }
      const blob = new Blob(chunks, { type: mimeType });
      resolve(blob);
    };
    recorder.stop();
  });

  // Repair WebM duration and index cues if needed
  let patchedBlob = rawVideoBlob;
  if (!isMp4) {
    onProgress?.(97, 'Reparando duración y metadatos del video...');
    try {
      patchedBlob = await fixWebmDuration(rawVideoBlob, totalDurationSeconds * 1000);
    } catch (err) {
      console.warn('fixWebmDuration error:', err);
    }
  }

  // Convert to real universal MP4 via server FFmpeg for maximum TV compatibility
  let finalBlob = patchedBlob;
  let finalIsMp4 = isMp4;
  let finalMimeType = isMp4 ? mimeType : 'video/webm';

  if (!isMp4) {
    try {
      onProgress?.(98, 'Convirtiendo a MP4 universal para TV (H.264)...');
      const res = await fetch('/api/video/convert-to-mp4', {
        method: 'POST',
        headers: { 'Content-Type': 'video/webm' },
        body: patchedBlob,
      });

      if (res.ok) {
        const mp4Blob = await res.blob();
        if (mp4Blob.size > 2000) {
          finalBlob = mp4Blob;
          finalIsMp4 = true;
          finalMimeType = 'video/mp4';
        }
      }
    } catch (err) {
      console.warn('Server MP4 conversion skipped/failed, using patched WebM:', err);
    }
  }

  const cleanStore = (settings.storeName || 'MOSTRADOR')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .slice(0, 24);

  const ext = finalIsMp4 ? 'mp4' : 'webm';
  const filename = `VIDEO_CARRUSEL_TV_${cleanStore}.${ext}`;

  onProgress?.(100, '¡Video generado con éxito!');

  return {
    blob: finalBlob,
    filename,
    mimeType: finalMimeType,
    isMp4: finalIsMp4,
    durationSeconds: totalDurationSeconds,
  };
}

/**
 * Creates a complete ZIP package ready to extract into a USB pendrive.
 */
export async function generateUsbZipPackage(
  slides: Slide[],
  templates: Template[],
  settings: GlobalSettings,
  onProgress?: (progress: number, status: string) => void
): Promise<Blob> {
  const zip = new JSZip();

  // 1. Generate 1080p slide images for native TV photo slideshows
  onProgress?.(10, 'Generando imágenes 1080p Full HD con diseño para TV...');
  const imgFolder = zip.folder('FOTOS_1080P_PARA_TV');
  const activeSlides = slides.filter((s) => s.active);
  const slidesToRender = activeSlides.length > 0 ? activeSlides : slides;

  for (let i = 0; i < slidesToRender.length; i++) {
    const s = slidesToRender[i];
    const tpl = templates.find((t) => t.id === s.templateId) || templates[0];
    const pct = 15 + Math.floor((i / slidesToRender.length) * 70);
    onProgress?.(pct, `Renderizando cartel Full HD ${i + 1} de ${slidesToRender.length}...`);

    try {
      const dataUrl = await renderSlideToCanvas(s, tpl, settings, 1920, 1080);
      const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
      const paddedNum = String(i + 1).padStart(2, '0');
      const cleanTitle = s.title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 20);
      imgFolder?.file(`${paddedNum}_${cleanTitle}.jpg`, base64Data, { base64: true });
    } catch (err) {
      console.error('Error rendering slide image for zip:', err);
    }
  }

  // 2. Instructions file
  onProgress?.(90, 'Creando guía para la televisión...');
  const instructions = `=====================================================
  GUÍA PARA REPRODUCIR EN CUALQUIER TELEVISIÓN POR USB
=====================================================
Establecimiento: ${settings.storeName || 'Mi Negocio'}
Fecha: ${new Date().toLocaleDateString()}

¿POR QUÉ LA TELE DECÍA "ARCHIVO NO COMPATIBLE"?
Las televisiones tradicionales y Smart TVs solo pueden reproducir
VIDEOS (MP4) o FOTOS (JPG) desde la entrada USB. No pueden ejecutar
páginas web (.html) ni archivos comprimidos (.zip).

CÓMO VERLO EN TU TV:
-----------------------------------------------------
OPCIÓN 1: CARPETA DE FOTOS (100% COMPATIBLE)
-----------------------------------------------------
1. Copia los archivos de la carpeta "FOTOS_1080P_PARA_TV" directamente a tu pendrive.
2. Enchufa el pendrive en la TV.
3. Con el mando de la tele, selecciona "USB" -> "Fotos / Imágenes".
4. Abre la primera foto y presiona "Menú" u "Opciones" en el control remoto:
   - Activa "Presentación" o "Pase de diapositivas".
   - Activa "Repetir / Bucle" (para que no se detenga).
   - Elige el tiempo por foto (ej: 8 o 10 segundos).

OPCIÓN 2: VIDEO MP4 EN BUCLE
-----------------------------------------------------
Desde la aplicación web, puedes pulsar "Descargar como Video MP4".
Copia ese video al pendrive, ábrelo en "Videos" en la TV y pon "Repetir todo".
=====================================================`;

  zip.file('LEER_INSTRUCCIONES_TV.txt', instructions);

  onProgress?.(95, 'Comprimiendo archivo ZIP para el pendrive...');
  const content = await zip.generateAsync({ type: 'blob' }, (metadata) => {
    onProgress?.(95 + Math.floor(metadata.percent * 0.05), 'Finalizando descarga...');
  });

  return content;
}

/**
 * Helper to draw rounded rectangle in canvas
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
