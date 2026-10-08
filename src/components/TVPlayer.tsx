import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Clock,
  CloudSun,
  Sparkles,
  ArrowLeft,
  CalendarClock,
  Layers,
  Repeat,
  HardDrive,
  Crown,
  Type,
  Music,
} from 'lucide-react';
import { Slide, Template, GlobalSettings } from '../types';
import { isSlideActiveNow, getEffectiveTime } from '../utils/scheduleUtils';
import { getOrGenerateTrackAudioUrl } from '../utils/audioTracks';

interface TVPlayerProps {
  slides: Slide[];
  templates: Template[];
  settings: GlobalSettings;
  onExitTVMode?: () => void;
  onOpenUsbExport?: () => void;
  onUpdateSettings?: (settings: GlobalSettings) => void;
  isStandalone?: boolean;
  isCloudSynced?: boolean;
  lastCloudUpdate?: string | null;
}

export const TVPlayer: React.FC<TVPlayerProps> = ({
  slides,
  templates,
  settings,
  onExitTVMode,
  onOpenUsbExport,
  onUpdateSettings,
  isStandalone = false,
  isCloudSynced = false,
  lastCloudUpdate = null,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [timeSlotLabel, setTimeSlotLabel] = useState('');
  const [localTextScale, setLocalTextScale] = useState<'standard' | 'large' | 'huge' | 'massive' | null>(null);
  const [showCloudUpdateToast, setShowCloudUpdateToast] = useState(false);

  // Trigger live cloud update feedback on TV screen
  const prevCloudUpdateRef = useRef<string | null>(lastCloudUpdate);
  useEffect(() => {
    if (lastCloudUpdate && prevCloudUpdateRef.current && lastCloudUpdate !== prevCloudUpdateRef.current) {
      setShowCloudUpdateToast(true);
      const timer = setTimeout(() => setShowCloudUpdateToast(false), 4000);
      return () => clearTimeout(timer);
    }
    prevCloudUpdateRef.current = lastCloudUpdate;
  }, [lastCloudUpdate]);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Background Music state & audio element reference
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [musicNeedsUserGesture, setMusicNeedsUserGesture] = useState(false);
  const [localMusicVolume, setLocalMusicVolume] = useState(settings.musicVolume ?? 0.7);

  // Filter slides eligible for display right now
  const activeEligibleSlides = useMemo(() => {
    return slides.filter((slide) => isSlideActiveNow(slide, settings));
  }, [slides, settings]);

  // Keep currentIndex in bounds if eligible slides list changes
  useEffect(() => {
    if (activeEligibleSlides.length === 0) {
      setCurrentIndex(0);
    } else if (currentIndex >= activeEligibleSlides.length) {
      setCurrentIndex(0);
    }
  }, [activeEligibleSlides.length, currentIndex]);

  const currentSlide = activeEligibleSlides[currentIndex] || null;

  // Resolve template for current slide
  const currentTemplate = useMemo(() => {
    if (!currentSlide) return templates[0] || null;
    return (
      templates.find((t) => t.id === currentSlide.templateId) ||
      templates.find((t) => t.id === settings.defaultTemplateId) ||
      templates[0]
    );
  }, [currentSlide, templates, settings.defaultTemplateId]);

  // Effective duration for current slide
  const slideDurationSeconds = useMemo(() => {
    if (!currentSlide) return settings.defaultDuration || 10;
    if (currentSlide.useCustomDuration && currentSlide.duration > 0) {
      return currentSlide.duration;
    }
    return settings.defaultDuration || 10;
  }, [currentSlide, settings.defaultDuration]);

  // Effective font scaling for current slide and TV screen
  const effectiveFontScale =
    localTextScale ||
    currentSlide?.fontSizeScale ||
    settings.globalTextScale ||
    'standard';

  const isSparse = Boolean(
    currentSlide &&
    !currentSlide.price &&
    (!currentSlide.highlights || currentSlide.highlights.length === 0)
  );

  const handleCycleFontScale = () => {
    const scales: ('standard' | 'large' | 'huge' | 'massive')[] = [
      'standard',
      'large',
      'huge',
      'massive',
    ];
    const nextIdx = (scales.indexOf(effectiveFontScale) + 1) % scales.length;
    const nextScale = scales[nextIdx];
    setLocalTextScale(nextScale);
    if (onUpdateSettings) {
      onUpdateSettings({ ...settings, globalTextScale: nextScale });
    }
  };

  // Clock updater & time slot label
  useEffect(() => {
    const updateTime = () => {
      const { formatted, hour } = getEffectiveTime(settings);
      setCurrentTimeStr(formatted);

      if (hour >= 7 && hour < 12) setTimeSlotLabel('MAÑANAS / DESAYUNOS');
      else if (hour >= 12 && hour < 16.5) setTimeSlotLabel('MEDIODÍA / ALMUERZOS');
      else if (hour >= 16.5 && hour < 20.5) setTimeSlotLabel('TARDES / MERIENDAS');
      else if (hour >= 20.5 || hour < 2) setTimeSlotLabel('NOCHES / CENAS');
      else setTimeSlotLabel('HORARIO CONTINUO');
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [settings]);

  // Handle slide advance
  const nextSlide = () => {
    if (activeEligibleSlides.length <= 1) {
      setProgress(0);
      return;
    }
    setCurrentIndex((prev) => {
      if (prev + 1 >= activeEligibleSlides.length) {
        return settings.loop ? 0 : prev;
      }
      return prev + 1;
    });
    setProgress(0);
  };

  const prevSlide = () => {
    if (activeEligibleSlides.length <= 1) return;
    setCurrentIndex((prev) => (prev === 0 ? activeEligibleSlides.length - 1 : prev - 1));
    setProgress(0);
  };

  // Timer progression and auto-advancement loop
  useEffect(() => {
    if (!isPlaying || activeEligibleSlides.length === 0) return;

    setProgress(0);
    const intervalMs = 100;
    const totalMs = Math.max(3000, slideDurationSeconds * 1000);
    let accumulatedMs = 0;

    const timer = setInterval(() => {
      accumulatedMs += intervalMs;
      const currentPct = Math.min(100, (accumulatedMs / totalMs) * 100);
      setProgress(currentPct);

      if (accumulatedMs >= totalMs) {
        clearInterval(timer);
        nextSlide();
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [currentIndex, isPlaying, slideDurationSeconds, activeEligibleSlides.length, settings.loop]);

  // Manage video playback if current slide is video
  useEffect(() => {
    if (currentSlide?.mediaType === 'video' && videoRef.current) {
      videoRef.current.currentTime = 0;
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [currentSlide, isPlaying]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not intercept keystrokes if the user is typing into an input, textarea, select, or editable element
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          target.closest('input, textarea, select, [contenteditable="true"]'))
      ) {
        return;
      }

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.key === 'ArrowRight') {
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        prevSlide();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        setIsMuted((prev) => !prev);
        toggleBackgroundMusic();
      } else if (e.key === 'Escape' && onExitTVMode && !document.fullscreenElement) {
        onExitTVMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeEligibleSlides.length, onExitTVMode, isMusicPlaying]);

  // Background Music playback manager
  useEffect(() => {
    if (!settings.enableBackgroundMusic) {
      if (bgAudioRef.current) {
        bgAudioRef.current.pause();
        bgAudioRef.current.currentTime = 0;
      }
      setIsMusicPlaying(false);
      setMusicNeedsUserGesture(false);
      return;
    }

    let isMounted = true;
    const trackUrl = settings.musicTrackUrl || 'track-acoustic-warm';

    const setupAndPlay = async () => {
      try {
        let resolvedUrl = trackUrl;
        if (trackUrl.startsWith('track-')) {
          resolvedUrl = await getOrGenerateTrackAudioUrl(trackUrl);
        }
        if (!isMounted) return;

        if (!bgAudioRef.current) {
          bgAudioRef.current = new Audio();
        }

        const audio = bgAudioRef.current;
        if (audio.src !== resolvedUrl) {
          audio.src = resolvedUrl;
        }
        audio.loop = settings.musicLoop !== false;
        audio.volume = localMusicVolume;

        try {
          await audio.play();
          if (isMounted) {
            setIsMusicPlaying(true);
            setMusicNeedsUserGesture(false);
          }
        } catch (playErr) {
          if (isMounted) {
            setMusicNeedsUserGesture(true);
            setIsMusicPlaying(false);
          }
        }
      } catch (err) {
        console.warn('Error configurando música de fondo en TV:', err);
      }
    };

    setupAndPlay();

    return () => {
      isMounted = false;
    };
  }, [settings.enableBackgroundMusic, settings.musicTrackUrl, settings.musicLoop]);

  // Sync volume changes
  useEffect(() => {
    if (bgAudioRef.current) {
      bgAudioRef.current.volume = localMusicVolume;
    }
  }, [localMusicVolume]);

  // Duck background music if current slide is playing a video with audio
  useEffect(() => {
    if (!bgAudioRef.current || !settings.enableBackgroundMusic) return;
    if (currentSlide?.mediaType === 'video' && !isMuted) {
      bgAudioRef.current.volume = localMusicVolume * 0.15; // Duck down
    } else {
      bgAudioRef.current.volume = localMusicVolume;
    }
  }, [currentSlide?.mediaType, isMuted, localMusicVolume, settings.enableBackgroundMusic]);

  // Cleanup audio on component unmount
  useEffect(() => {
    return () => {
      if (bgAudioRef.current) {
        bgAudioRef.current.pause();
        bgAudioRef.current.src = '';
        bgAudioRef.current = null;
      }
    };
  }, []);

  const handleStartMusicWithGesture = () => {
    if (bgAudioRef.current) {
      bgAudioRef.current.play().then(() => {
        setIsMusicPlaying(true);
        setMusicNeedsUserGesture(false);
      }).catch((e) => console.warn('Music play error:', e));
    }
  };

  const toggleBackgroundMusic = () => {
    if (!bgAudioRef.current) {
      if (onUpdateSettings) {
        onUpdateSettings({ ...settings, enableBackgroundMusic: true });
      }
      return;
    }

    if (isMusicPlaying) {
      bgAudioRef.current.pause();
      setIsMusicPlaying(false);
    } else {
      bgAudioRef.current.play().then(() => {
        setIsMusicPlaying(true);
        setMusicNeedsUserGesture(false);
      }).catch(() => {
        setMusicNeedsUserGesture(true);
      });
    }
  };

  // Auto-hide controls after inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3500);
  };

  const currentMediaUrl = currentSlide
    ? currentSlide.useCutout && currentSlide.mediaCutoutUrl
      ? currentSlide.mediaCutoutUrl
      : currentSlide.mediaUrl
    : '';

  const isExclusiveLogo = currentSlide?.layoutType === 'exclusive-logo';
  const shouldHideHeader = settings.showStoreHeader !== true || (isExclusiveLogo && currentSlide?.hideHeader);
  const shouldHideTicker = (settings.showTicker !== true && settings.showProgressBar !== true) || (isExclusiveLogo && currentSlide?.hideTicker);

  // Background computation for OLED black, radial glow or template
  let activeBg = currentTemplate?.bgGradient || '#0a0a0c';
  if (isExclusiveLogo && currentSlide?.exclusiveBgType === 'pure-black') {
    activeBg = '#000000';
  } else if (isExclusiveLogo && currentSlide?.exclusiveBgType === 'radial-glow') {
    const glowColor = currentTemplate?.accentColor || '#f59e0b';
    activeBg = `radial-gradient(circle at center, ${glowColor}25 0%, #050508 70%)`;
  }

  return (
    <div
      id="tv-player-container"
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`relative w-full h-full bg-black select-none overflow-hidden flex flex-col justify-between ${
        isFullscreen ? 'fixed inset-0 z-50' : 'min-h-[560px] rounded-2xl shadow-2xl border border-neutral-800'
      }`}
      style={{
        background: activeBg,
      }}
    >
      {/* Background ambient lighting effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-1/4 -right-1/4 w-3/4 h-3/4 rounded-full blur-3xl opacity-20 transition-all duration-1000"
          style={{ backgroundColor: currentTemplate?.accentColor || '#f59e0b' }}
        />
        <div
          className="absolute -bottom-1/4 -left-1/4 w-2/3 h-2/3 rounded-full blur-3xl opacity-15 transition-all duration-1000"
          style={{ backgroundColor: currentTemplate?.badgeBg || '#ef4444' }}
        />
      </div>

      {/* TOP BAR: Store Brand, Live Clock, Time Slot & Weather */}
      {!shouldHideHeader && (
        <header className="relative z-20 px-8 py-5 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent backdrop-blur-sm transition-all duration-500">
          <div className="flex items-center space-x-4">
            {settings.storeLogoUrl ? (
              <img
                src={settings.storeLogoUrl}
                alt="Logo"
                className="h-10 w-auto max-w-[140px] object-contain rounded drop-shadow"
              />
            ) : (
              <div className="flex items-center space-x-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg font-bold text-lg"
                  style={{
                    backgroundColor: currentTemplate?.accentColor || '#f59e0b',
                    color: '#000000',
                  }}
                >
                  TV
                </div>
                <div>
                  <h1 className="text-white font-extrabold text-xl tracking-wider uppercase drop-shadow-md">
                    {settings.storeName || 'MI MOSTRADOR TV'}
                  </h1>
                  {settings.storeTagline && (
                    <p className="text-xs text-neutral-300 tracking-wide font-medium">
                      {settings.storeTagline}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Time Slot Tag */}
            <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-white/90">
              <CalendarClock className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold tracking-wide">{timeSlotLabel}</span>
              {settings.timeSimulationMode && (
                <span className="ml-1 text-[10px] bg-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded">
                  Simulado
                </span>
              )}
            </div>
          </div>

          {/* Right Info: Weather & Real-time Clock */}
          <div className="flex items-center space-x-6">
            {settings.showWeather && (
              <div className="hidden md:flex items-center space-x-2 text-white/90 bg-white/10 px-3.5 py-1.5 rounded-full border border-white/10 backdrop-blur-md text-sm">
                <CloudSun className="w-4 h-4 text-amber-300" />
                <span className="font-medium">{settings.weatherCity}</span>
                <span className="font-bold text-amber-300">{settings.weatherTemp}</span>
              </div>
            )}

            {settings.showClock && (
              <div className="flex items-center space-x-2.5 bg-black/60 px-4 py-1.5 rounded-full border border-white/15 backdrop-blur-md">
                <Clock className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="text-white font-mono font-bold text-lg tracking-wider">
                  {currentTimeStr}
                </span>
              </div>
            )}

            {/* Slide count indicator */}
            <div className="hidden lg:flex items-center space-x-1 text-xs text-neutral-300 bg-white/10 px-3 py-1.5 rounded-full">
              <Layers className="w-3.5 h-3.5 text-sky-400 mr-1" />
              <span className="font-bold text-white">
                {activeEligibleSlides.length > 0 ? currentIndex + 1 : 0}
              </span>
              <span>/</span>
              <span>{activeEligibleSlides.length}</span>
            </div>
          </div>
        </header>
      )}

      {/* MAIN CONTENT AREA: Animated Slides */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-2 overflow-hidden">
        {activeEligibleSlides.length === 0 ? (
          <div className="text-center max-w-lg p-10 rounded-3xl bg-neutral-900/80 border border-neutral-700/60 backdrop-blur-xl shadow-2xl">
            <CalendarClock className="w-16 h-16 mx-auto mb-4 text-amber-400 animate-bounce" />
            <h2 className="text-2xl font-bold text-white mb-2">
              Sin emisiones programadas en este momento
            </h2>
            <p className="text-neutral-400 text-sm mb-6 leading-relaxed">
              Las diapositivas tienen programados horarios específicos. En el momento actual (
              {currentTimeStr}) no hay diapositivas activas configuradas para esta franja.
            </p>
            <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold">
              <Sparkles className="w-4 h-4" />
              <span>Puedes cambiar la hora o simular franjas en la barra de control</span>
            </div>
          </div>
        ) : currentSlide ? (
          isExclusiveLogo ? (
            /* EXCLUSIVE LOGO / DIAPOSITIVA LIBRE PARA TV */
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide.id}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: settings.transitionSpeed || 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="w-full h-full flex flex-col items-center justify-center relative select-none p-4"
              >
                {/* Glow Halo behind logo */}
                {currentSlide.showHaloGlow !== false && (
                  <div
                    className="absolute rounded-full blur-3xl pointer-events-none animate-glow-ring transition-all duration-1000"
                    style={{
                      width: `${Math.min(95, (currentSlide.logoScale || 90) + 10)}%`,
                      height: `${Math.min(94, (currentSlide.logoScale || 90) + 12)}%`,
                      backgroundColor: currentTemplate?.accentColor || '#f59e0b',
                      opacity: 0.35,
                    }}
                  />
                )}

                {/* Scaled Logo Container adapted to TV screen */}
                <div
                  className="relative flex items-center justify-center transition-all duration-300 animate-float-product"
                  style={{
                    width: `${currentSlide.logoScale || 90}%`,
                    height: currentSlide.showSubtitleUnderLogo && currentSlide.subtitle
                      ? `${Math.max(30, (currentSlide.logoScale || 90) * 0.82)}%`
                      : `${currentSlide.logoScale || 90}%`,
                    maxHeight: currentSlide.showSubtitleUnderLogo && currentSlide.subtitle ? '82%' : '94%',
                  }}
                >
                  {currentMediaUrl ? (
                    <motion.img
                      src={currentMediaUrl}
                      alt={currentSlide.title || settings.storeName || 'Logo'}
                      initial={{ scale: 0.94 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.7 }}
                      className={`w-full h-full ${
                        currentSlide.logoFit === 'cover' ? 'object-cover rounded-3xl' : 'object-contain'
                      } ${
                        currentSlide.useCutout
                          ? 'filter drop-shadow-[0_25px_50px_rgba(0,0,0,0.85)]'
                          : 'filter drop-shadow-2xl rounded-2xl'
                      }`}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-8 rounded-3xl border-2 border-dashed border-white/20 bg-black/40 backdrop-blur-md">
                      <Crown className="w-16 h-16 text-amber-400 mb-3" />
                      <span className="text-3xl sm:text-5xl font-black text-white drop-shadow-lg tracking-wider">
                        {settings.storeName || 'TU LOGO AQUÍ'}
                      </span>
                      <span className="text-xs text-neutral-400 mt-2">
                        Edita esta diapositiva para subir la imagen de tu logotipo
                      </span>
                    </div>
                  )}
                </div>

                {/* Subtitle / Slogan under logo */}
                {currentSlide.showSubtitleUnderLogo && (currentSlide.subtitle || settings.storeTagline) && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.6 }}
                    className="mt-6 text-center max-w-5xl px-6"
                  >
                    <p
                      className={`font-black tracking-wide text-neutral-100 drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] ${
                        effectiveFontScale === 'massive'
                          ? 'text-3xl sm:text-5xl lg:text-6xl xl:text-7xl'
                          : effectiveFontScale === 'huge'
                          ? 'text-2xl sm:text-4xl lg:text-5xl xl:text-6xl'
                          : effectiveFontScale === 'large'
                          ? 'text-xl sm:text-3xl lg:text-4xl xl:text-5xl'
                          : 'text-xl sm:text-3xl lg:text-4xl'
                      }`}
                    >
                      {currentSlide.subtitle || settings.storeTagline}
                    </p>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          ) : (
            /* STANDARD PRODUCT / COMMERCIAL PROMO SLIDE */
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide.id}
                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.04, y: -10 }}
                transition={{ duration: settings.transitionSpeed || 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="w-full h-full max-w-[98vw] 2xl:max-w-[1900px] mx-auto flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-10 px-2 sm:px-4 lg:px-6"
              >
                {/* Media Visual Column (Left/Floating - Expansive Full Height) */}
                <div className="relative w-full lg:w-[50%] h-[420px] sm:h-[620px] lg:h-[92vh] max-h-[1020px] flex items-center justify-center">
                  {/* Glow ring under product */}
                  <div
                    className="absolute w-80 h-80 sm:w-[480px] sm:h-[480px] rounded-full blur-3xl opacity-40 animate-glow-ring transition-all duration-700 pointer-events-none"
                    style={{ backgroundColor: currentTemplate?.accentColor || '#f59e0b' }}
                  />

                  {currentSlide.mediaType === 'video' ? (
                    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl border border-white/20">
                      <video
                        ref={videoRef}
                        src={currentSlide.mediaUrl}
                        autoPlay
                        loop
                        muted={isMuted}
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => setIsMuted(!isMuted)}
                        className="absolute bottom-4 right-4 p-2.5 rounded-full bg-black/70 text-white hover:bg-black/90 transition shadow-lg backdrop-blur-md"
                        title={isMuted ? 'Activar sonido' : 'Silenciar'}
                      >
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
                      </button>
                    </div>
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center p-1 sm:p-2">
                      <motion.img
                        src={currentMediaUrl}
                        alt={currentSlide.title}
                        initial={{ scale: 0.9, rotate: -1 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={`max-w-full max-h-full w-auto h-auto object-contain filter drop-shadow-[0_24px_50px_rgba(0,0,0,0.75)] animate-float-product transition-all ${
                          currentSlide.useCutout ? 'scale-110 hover:scale-115' : 'rounded-3xl scale-105'
                        }`}
                      />
                    </div>
                  )}
                </div>

                {/* Informational Column (Right - Expansive) */}
                <div
                  className={`w-full lg:w-[48%] flex flex-col justify-center text-left ${
                    effectiveFontScale === 'massive'
                      ? 'space-y-6 sm:space-y-8'
                      : effectiveFontScale === 'huge'
                      ? 'space-y-5 sm:space-y-7'
                      : 'space-y-4 sm:space-y-6'
                  }`}
                >
                  {/* Badge with McDonald's Shimmer Sweep */}
                  <div className="flex items-center space-x-3">
                    <div className="relative overflow-hidden inline-flex rounded-xl shadow-md">
                      <span
                        className={`inline-flex items-center uppercase tracking-wider ${
                          effectiveFontScale === 'massive'
                            ? 'px-6 py-2.5 sm:py-3 rounded-xl font-black text-base sm:text-lg lg:text-xl'
                            : effectiveFontScale === 'huge'
                            ? 'px-5 py-2 sm:py-2.5 rounded-xl font-black text-sm sm:text-base lg:text-lg'
                            : effectiveFontScale === 'large'
                            ? 'px-4 py-2 rounded-lg font-black text-xs sm:text-base'
                            : 'px-4 py-2 rounded-lg font-black text-xs sm:text-sm'
                        }`}
                        style={{
                          backgroundColor: currentSlide.badgeColor || currentTemplate?.badgeBg || '#d97706',
                          color: currentTemplate?.badgeText || '#ffffff',
                        }}
                      >
                        {currentSlide.badge || 'PROMO ESPECIAL'}
                      </span>
                      {/* McDonald's Shimmer Sheen */}
                      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-shimmer-sweep" />
                    </div>

                    {currentSlide.category && (
                      <span
                        className={`uppercase tracking-widest text-neutral-400 font-semibold border-l border-neutral-700 pl-3 ${
                          effectiveFontScale === 'massive'
                            ? 'text-sm sm:text-base'
                            : effectiveFontScale === 'huge'
                            ? 'text-xs sm:text-sm'
                            : 'text-xs sm:text-sm'
                        }`}
                      >
                        {currentSlide.category}
                      </span>
                    )}
                  </div>

                  {/* Headline (Enlarged) */}
                  <h2
                    className={`font-black tracking-tight leading-tight text-white drop-shadow-xl ${
                      currentTemplate?.fontHeading || 'font-sans'
                    } ${
                      effectiveFontScale === 'massive'
                        ? 'text-5xl sm:text-7xl lg:text-8xl xl:text-9xl leading-[1.03]'
                        : effectiveFontScale === 'huge'
                        ? 'text-4xl sm:text-6xl lg:text-7xl xl:text-8xl leading-[1.05]'
                        : effectiveFontScale === 'large'
                        ? 'text-4xl sm:text-6xl lg:text-7xl'
                        : isSparse
                        ? 'text-4xl sm:text-6xl lg:text-7xl xl:text-8xl'
                        : 'text-3xl sm:text-5xl lg:text-6xl font-extrabold'
                    }`}
                  >
                    {currentSlide.title}
                  </h2>

                  {/* Subtitle (Enlarged) */}
                  {currentSlide.subtitle && (
                    <p
                      className={`leading-relaxed max-w-3xl drop-shadow-md ${
                        effectiveFontScale === 'massive'
                          ? 'text-2xl sm:text-3xl lg:text-4xl text-neutral-100 font-semibold'
                          : effectiveFontScale === 'huge'
                          ? 'text-xl sm:text-2xl lg:text-3xl text-neutral-200 font-medium'
                          : effectiveFontScale === 'large'
                          ? 'text-lg sm:text-xl lg:text-2xl text-neutral-200 font-medium'
                          : isSparse
                          ? 'text-xl sm:text-2xl lg:text-3xl text-neutral-200 font-medium'
                          : 'text-lg sm:text-xl text-neutral-300 font-normal'
                      }`}
                    >
                      {currentSlide.subtitle}
                    </p>
                  )}

                  {/* Bullet Points / Highlights (Enlarged) */}
                  {currentSlide.highlights && currentSlide.highlights.length > 0 && (
                    <ul className="space-y-2.5 pt-1 pb-1">
                      {currentSlide.highlights.map((point, idx) => (
                        <li
                          key={idx}
                          className={`flex items-center space-x-3 ${
                            effectiveFontScale === 'massive'
                              ? 'text-xl sm:text-2xl lg:text-3xl text-neutral-100 font-medium'
                              : effectiveFontScale === 'huge'
                              ? 'text-lg sm:text-xl lg:text-2xl text-neutral-200 font-medium'
                              : 'text-base sm:text-lg lg:text-xl text-neutral-200 font-medium'
                          }`}
                        >
                          <span
                            className={`${
                              effectiveFontScale === 'massive' ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'
                            } rounded-full flex-shrink-0`}
                            style={{ backgroundColor: currentTemplate?.accentColor || '#f59e0b' }}
                          />
                          <span className="font-semibold">{point}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Price and CTA Block (Enlarged) */}
                  <div className="flex flex-wrap items-center gap-4 sm:gap-8 pt-2">
                    {currentSlide.price && (
                      <div className="flex items-baseline space-x-3.5 animate-price-pulse">
                        <span
                          className={`font-black tracking-tight drop-shadow-xl ${
                            effectiveFontScale === 'massive'
                              ? 'text-6xl sm:text-8xl lg:text-9xl'
                              : effectiveFontScale === 'huge'
                              ? 'text-5xl sm:text-7xl lg:text-8xl'
                              : effectiveFontScale === 'large'
                              ? 'text-4xl sm:text-6xl lg:text-7xl'
                              : 'text-4xl sm:text-6xl'
                          }`}
                          style={{ color: currentTemplate?.priceColor || '#fbbf24' }}
                        >
                          {currentSlide.price}
                        </span>
                        {currentSlide.originalPrice && (
                          <span
                            className={`line-through font-semibold text-neutral-400 ${
                              effectiveFontScale === 'massive'
                                ? 'text-2xl sm:text-4xl'
                                : effectiveFontScale === 'huge'
                                ? 'text-xl sm:text-3xl'
                                : 'text-xl sm:text-2xl'
                            }`}
                          >
                            {currentSlide.originalPrice}
                          </span>
                        )}
                      </div>
                    )}

                    {currentSlide.ctaText && (
                      <div
                        className={`relative overflow-hidden shadow-2xl flex items-center space-x-2 transition-transform hover:scale-105 ${
                          effectiveFontScale === 'massive'
                            ? 'px-9 py-4 rounded-2xl font-black text-xl sm:text-2xl'
                            : effectiveFontScale === 'huge'
                            ? 'px-8 py-3.5 rounded-xl font-extrabold text-lg sm:text-xl'
                            : effectiveFontScale === 'large'
                            ? 'px-7 py-3 rounded-xl font-bold text-base sm:text-lg'
                            : 'px-6 py-3 rounded-xl font-bold text-sm sm:text-base'
                        }`}
                        style={{
                          backgroundColor: currentTemplate?.accentColor || '#f59e0b',
                          color: '#000000',
                        }}
                      >
                        <span>{currentSlide.ctaText}</span>
                        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-shimmer-sweep" />
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          )
        ) : null}
      </main>

      {/* BOTTOM SECTION: Progress Bar & Scrolling Ticker */}
      {!shouldHideTicker && (
        <footer className="relative z-20 w-full bg-gradient-to-t from-black via-black/90 to-transparent transition-all duration-500">
          {/* Progress Bar (Visual time left on this slide) */}
          {settings.showProgressBar && (
            <div className="w-full h-1.5 bg-white/10 overflow-hidden">
              <motion.div
                className="h-full transition-all ease-linear"
                style={{
                  width: `${progress}%`,
                  backgroundColor: currentTemplate?.accentColor || '#f59e0b',
                }}
              />
            </div>
          )}

          {/* Ticker / Marquee Banner */}
          {settings.showTicker && (
            <div className="relative py-2.5 px-6 bg-black/80 border-t border-white/10 flex items-center overflow-hidden">
              <div className="flex items-center space-x-2 mr-4 flex-shrink-0 z-10 bg-black/90 pr-3">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                  INFO & OFERTAS
                </span>
              </div>

              <div className="overflow-hidden whitespace-nowrap flex-1 relative">
                <motion.div
                  className="inline-block text-sm sm:text-base font-semibold text-neutral-200 tracking-wide"
                  animate={{ x: ['100%', '-100%'] }}
                  transition={{
                    repeat: Infinity,
                    ease: 'linear',
                    duration: settings.tickerSpeed || 25,
                  }}
                >
                  {currentSlide?.tickerText || settings.globalTickerText}
                </motion.div>
              </div>
            </div>
          )}
        </footer>
      )}

      {/* FLOATING CONTROLS (Auto-hides on inactivity) */}
      <div
        className={`absolute top-20 right-8 z-40 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-neutral-900/90 backdrop-blur-xl border border-neutral-700/70 rounded-2xl p-2 shadow-2xl flex items-center space-x-1 text-white">
          <button
            onClick={prevSlide}
            className="p-2 hover:bg-white/10 rounded-xl transition"
            title="Diapositiva anterior (Flecha Izquierda)"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl transition font-bold"
            title={isPlaying ? 'Pausar bucle (Espacio)' : 'Reanudar bucle (Espacio)'}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>

          <button
            onClick={nextSlide}
            className="p-2 hover:bg-white/10 rounded-xl transition"
            title="Siguiente diapositiva (Flecha Derecha)"
          >
            <SkipForward className="w-5 h-5" />
          </button>

          <div className="h-6 w-px bg-white/20 mx-1" />

          {/* Loop toggle indicator */}
          <div
            className={`p-2 rounded-xl transition ${
              settings.loop ? 'text-emerald-400' : 'text-neutral-500'
            }`}
            title={settings.loop ? 'Bucle continuo activado' : 'Bucle desactivado'}
          >
            <Repeat className="w-4 h-4" />
          </div>

          {/* Quick Font Size Switcher for TV */}
          <button
            onClick={handleCycleFontScale}
            className="px-2.5 py-1.5 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 bg-amber-500/10 rounded-xl transition flex items-center space-x-1"
            title={`Tamaño de letra en TV: ${
              effectiveFontScale === 'massive'
                ? 'Gigante (+85%)'
                : effectiveFontScale === 'huge'
                ? 'Extra Grande (+50%)'
                : effectiveFontScale === 'large'
                ? 'Grande (+25%)'
                : 'Estándar'
            }. Haz clic para agrandar más la letra.`}
          >
            <Type className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-black">
              {effectiveFontScale === 'massive'
                ? 'A+++'
                : effectiveFontScale === 'huge'
                ? 'A++'
                : effectiveFontScale === 'large'
                ? 'A+'
                : 'A'}
            </span>
          </button>

          {/* Background Music Toggle for TV */}
          <button
            onClick={toggleBackgroundMusic}
            className={`px-2.5 py-1.5 rounded-xl transition flex items-center space-x-1.5 border ${
              isMusicPlaying
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'hover:bg-white/10 text-neutral-400 hover:text-white border-transparent'
            }`}
            title={
              isMusicPlaying
                ? `Música de fondo activa (${settings.musicTrackName || 'Música'}) · Clic para silenciar (M)`
                : 'Activar música de fondo en la TV (M)'
            }
          >
            <Music className={`w-3.5 h-3.5 ${isMusicPlaying ? 'text-amber-400 animate-pulse' : 'text-neutral-400'}`} />
            <span className="text-[11px] font-bold">
              {isMusicPlaying ? 'Música ON' : 'Música'}
            </span>
          </button>

          {onOpenUsbExport && (
            <button
              onClick={onOpenUsbExport}
              className="p-2 hover:bg-emerald-500/20 text-emerald-400 rounded-xl transition"
              title="Descargar para Pendrive / USB para TV"
            >
              <HardDrive className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-white/10 rounded-xl transition text-neutral-300 hover:text-white"
            title="Pantalla Completa (F)"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>

          {onExitTVMode && (
            <>
              <div className="h-6 w-px bg-white/20 mx-1" />
              <button
                onClick={onExitTVMode}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold rounded-xl transition flex items-center space-x-1.5"
                title="Volver a la Gestión"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Panel</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cloud Live Sync Indicator / Toast when changes come from PC */}
      <AnimatePresence>
        {showCloudUpdateToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="absolute top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full bg-emerald-600/95 text-white font-bold text-xs sm:text-sm shadow-2xl backdrop-blur-md flex items-center space-x-2 border border-emerald-300/40"
          >
            <Sparkles className="w-4 h-4 text-emerald-200 animate-spin" />
            <span>¡Contenido actualizado en vivo desde tu PC!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating gesture unlock prompt when browser autoplay requires user click or remote button */}
      {musicNeedsUserGesture && settings.enableBackgroundMusic && (
        <button
          onClick={handleStartMusicWithGesture}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full bg-amber-500 hover:bg-amber-400 text-black font-black text-xs sm:text-sm shadow-2xl flex items-center space-x-2.5 animate-bounce border-2 border-amber-300 transition-transform hover:scale-105"
        >
          <Music className="w-4 h-4 animate-pulse text-black" />
          <span>Pulsa OK en el control remoto o toca la pantalla para activar la música 🎵</span>
        </button>
      )}
    </div>
  );
};
