import React, { useState, useRef } from 'react';
import {
  X,
  HardDrive,
  Download,
  FileCode,
  Image as ImageIcon,
  Tv,
  Check,
  AlertCircle,
  Video,
  Sparkles,
  Info,
  FolderArchive,
  Play,
  RefreshCw,
  Clock,
  Film,
  CheckCircle2,
  Music,
  Volume2,
  Square,
  Upload,
} from 'lucide-react';
import { Slide, Template, GlobalSettings } from '../types';
import {
  generateStandaloneHtml,
  generateUsbZipPackage,
  renderSlideToCanvas,
  generateTvVideoBlob,
  VideoExportResult,
} from '../utils/exportUtils';
import { BUILT_IN_MUSIC_TRACKS, getOrGenerateTrackAudioUrl } from '../utils/audioTracks';

interface UsbExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  slides: Slide[];
  templates: Template[];
  settings: GlobalSettings;
}

export const UsbExportModal: React.FC<UsbExportModalProps> = ({
  isOpen,
  onClose,
  slides,
  templates,
  settings,
}) => {
  // Default to 'video' tab as requested by the user to avoid "Archivo no compatible" on TV
  const [activeTab, setActiveTab] = useState<'video' | 'images' | 'package' | 'html' | 'guide'>('video');

  // Video Export States
  const [secondsPerSlide, setSecondsPerSlide] = useState(4);
  const [loops, setLoops] = useState(1);
  const [selectedSlideIds, setSelectedSlideIds] = useState<Set<string>>(() => new Set(slides.map((s) => s.id)));
  const [useCustomSlideDurations, setUseCustomSlideDurations] = useState(false);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [videoProgressPct, setVideoProgressPct] = useState(0);
  const [videoStatusMessage, setVideoStatusMessage] = useState('');
  const [videoResult, setVideoResult] = useState<VideoExportResult | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  // Sync selected slides if slides change or modal is opened
  React.useEffect(() => {
    if (slides && slides.length > 0) {
      setSelectedSlideIds((prev) => {
        const next = new Set<string>();
        // Keep existing selections that still exist
        slides.forEach((s) => {
          if (prev.size === 0 || prev.has(s.id)) {
            next.add(s.id);
          }
        });
        // If empty, select all
        if (next.size === 0) {
          slides.forEach((s) => next.add(s.id));
        }
        return next;
      });
    }
  }, [slides, isOpen]);

  // General Zip / HTML States
  const [isProcessingZip, setIsProcessingZip] = useState(false);
  const [zipProgressPct, setZipProgressPct] = useState(0);
  const [zipStatusMessage, setZipStatusMessage] = useState('');
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const abortControllerHolder = useRef<AbortController | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Background Audio settings for Video export
  const [includeVideoAudio, setIncludeVideoAudio] = useState(Boolean(settings.enableBackgroundMusic));
  const [videoAudioTrackUrl, setVideoAudioTrackUrl] = useState(settings.musicTrackUrl || 'track-acoustic-warm');
  const [videoAudioTrackName, setVideoAudioTrackName] = useState(settings.musicTrackName || 'Café & Comercio Acogedor');
  const [videoAudioVolume, setVideoAudioVolume] = useState(settings.musicVolume ?? 0.7);
  const [previewingAudioId, setPreviewingAudioId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const customAudioInputRef = useRef<HTMLInputElement | null>(null);

  const stopPreviewAudio = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      previewAudioRef.current = null;
    }
    setPreviewingAudioId(null);
  };

  const handleTogglePreviewAudio = async (trackId: string, trackUrl?: string) => {
    if (previewingAudioId === trackId) {
      stopPreviewAudio();
      return;
    }

    stopPreviewAudio();
    setPreviewingAudioId(trackId);

    try {
      let resolvedUrl = trackUrl || trackId;
      if (trackId.startsWith('track-')) {
        resolvedUrl = await getOrGenerateTrackAudioUrl(trackId);
      }
      const audio = new Audio(resolvedUrl);
      audio.loop = true;
      audio.volume = videoAudioVolume;
      previewAudioRef.current = audio;
      await audio.play();
    } catch (err) {
      console.warn('Error testing audio track:', err);
      stopPreviewAudio();
    }
  };

  const handleUploadCustomAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        setVideoAudioTrackUrl(reader.result);
        setVideoAudioTrackName(cleanName);
        setIncludeVideoAudio(true);
      }
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  const activeSlides = slides.filter((s) => s.active);
  const selectedSlides = slides.filter((s) => selectedSlideIds.has(s.id));

  // Calculate accurate video duration considering custom or uniform durations
  const estimatedVideoDuration = selectedSlides.reduce((acc, s) => {
    const dur = useCustomSlideDurations && s.useCustomDuration && s.duration && s.duration >= 3
      ? s.duration
      : secondsPerSlide;
    return acc + dur * loops;
  }, 0);

  const toggleSlideSelection = (id: string) => {
    setSelectedSlideIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) {
          next.delete(id);
        }
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllSlides = () => {
    setSelectedSlideIds(new Set(slides.map((s) => s.id)));
  };

  const selectOnlyActiveSlides = () => {
    const activeIds = slides.filter((s) => s.active).map((s) => s.id);
    if (activeIds.length > 0) {
      setSelectedSlideIds(new Set(activeIds));
    } else {
      setSelectedSlideIds(new Set(slides.map((s) => s.id)));
    }
  };

  // 1. Generate & Export as Video (MP4/WebM)
  const handleGenerateVideo = async () => {
    if (selectedSlides.length === 0) return;

    setIsVideoRecording(true);
    setVideoProgressPct(2);
    setVideoStatusMessage('Inicializando motor de renderizado de video Full HD...');
    setVideoResult(null);
    setVideoPreviewUrl(null);
    setDownloadSuccess(null);

    stopPreviewAudio();
    abortControllerHolder.current = new AbortController();

    try {
      const result = await generateTvVideoBlob(slides, templates, settings, {
        secondsPerSlide,
        loops,
        fps: 30,
        selectedSlideIds: Array.from(selectedSlideIds),
        useSlideCustomDurations: useCustomSlideDurations,
        includeAudio: includeVideoAudio,
        audioTrackUrl: videoAudioTrackUrl,
        audioVolume: videoAudioVolume,
        signal: abortControllerHolder.current.signal,
        onProgress: (pct, msg) => {
          setVideoProgressPct(pct);
          setVideoStatusMessage(msg);
        },
        onFramePreview: (canvas) => {
          // Draw frame preview in mini canvas
          if (previewCanvasRef.current) {
            const previewCtx = previewCanvasRef.current.getContext('2d');
            if (previewCtx) {
              previewCtx.drawImage(
                canvas,
                0,
                0,
                previewCanvasRef.current.width,
                previewCanvasRef.current.height
              );
            }
          }
        },
      });

      setVideoResult(result);
      const url = URL.createObjectURL(result.blob);
      setVideoPreviewUrl(url);
      setDownloadSuccess('¡Video generado con éxito! Puedes probarlo abajo y descargarlo para tu USB.');
    } catch (err: any) {
      if (err.message && err.message.includes('cancelada')) {
        setVideoStatusMessage('Grabación cancelada.');
      } else {
        console.error('Error generating TV video:', err);
        setVideoStatusMessage('Error al generar el video: ' + (err.message || 'Error desconocido'));
      }
    } finally {
      setIsVideoRecording(false);
    }
  };

  const handleCancelVideo = () => {
    if (abortControllerHolder.current) {
      abortControllerHolder.current.abort();
    }
    setIsVideoRecording(false);
  };

  const handleDownloadVideoFile = () => {
    if (!videoResult || !videoPreviewUrl) return;
    const a = document.createElement('a');
    a.href = videoPreviewUrl;
    a.download = videoResult.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 2. Download Complete USB ZIP
  const handleDownloadZip = async () => {
    setIsProcessingZip(true);
    setZipProgressPct(5);
    setZipStatusMessage('Iniciando exportación para USB...');
    setDownloadSuccess(null);

    try {
      const blob = await generateUsbZipPackage(
        slides,
        templates,
        settings,
        (pct, status) => {
          setZipProgressPct(pct);
          setZipStatusMessage(status);
        }
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CARRUSEL_TV_PENDRIVE_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadSuccess('¡Paquete ZIP descargado! Descomprime el contenido directamente en tu pendrive.');
    } catch (err: any) {
      console.error('Error generating USB package:', err);
      setZipStatusMessage('Error al generar el archivo: ' + err.message);
    } finally {
      setIsProcessingZip(false);
    }
  };

  // 3. Download Standalone HTML5 file
  const handleDownloadHtmlOnly = () => {
    try {
      const htmlContent = generateStandaloneHtml(slides, templates, settings);
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'PANTALLA_MOSTRADOR_TV.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadSuccess('¡Archivo PANTALLA_MOSTRADOR_TV.html descargado! Válido para televisores con navegador web o TV Box.');
    } catch (err: any) {
      console.error('Error downloading HTML:', err);
    }
  };

  // 4. Download Single Slide Image
  const handleDownloadSingleImage = async (slide: Slide, index: number) => {
    const tpl = templates.find((t) => t.id === slide.templateId) || templates[0];
    try {
      const dataUrl = await renderSlideToCanvas(slide, tpl, settings, 1920, 1080);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `TV_${String(index + 1).padStart(2, '0')}_${slide.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading single image:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-neutral-100 my-auto">
        {/* Header */}
        <div className="px-6 py-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/90">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-yellow-400 flex items-center justify-center text-black shadow-lg">
              <Film className="w-6 h-6 text-black" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Exportar para Televisión / USB
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase tracking-wider">
                  Solución 100% Compatible TV
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Genera un video en bucle o carteles Full HD para proyectar en cualquier televisor sin errores de formato.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              stopPreviewAudio();
              onClose();
            }}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-neutral-800 bg-neutral-950/60 px-6 gap-2 text-sm overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab('video');
              setDownloadSuccess(null);
            }}
            className={`py-3.5 px-4 font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'video'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>🎬 Descargar como Video para TV (MP4)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('images');
              setDownloadSuccess(null);
            }}
            className={`py-3.5 px-4 font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'images'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Carteles Full HD (JPG)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('package');
              setDownloadSuccess(null);
            }}
            className={`py-3.5 px-4 font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'package'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FolderArchive className="w-4 h-4" />
            <span>Paquete ZIP</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('html');
              setDownloadSuccess(null);
            }}
            className={`py-3.5 px-4 font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'html'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>Web Offline (HTML)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('guide');
              setDownloadSuccess(null);
            }}
            className={`py-3.5 px-4 font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'guide'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>Ayuda TV</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[72vh] overflow-y-auto">
          {/* TAB 1: VIDEO EXPORT (PRIMARY SOLUTION FOR "ARCHIVO NO COMPATIBLE") */}
          {activeTab === 'video' && (
            <div className="space-y-6">
              {/* Explanatory Banner: Why the TV said "Archivo no compatible" */}
              <div className="p-5 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-transparent rounded-2xl border border-amber-500/30 space-y-3">
                <div className="flex items-start space-x-3.5">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 flex-shrink-0">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      ¿Por qué la televisión decía "Archivo no compatible"?
                    </h3>
                    <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                      Los puertos USB de los televisores (Samsung, LG, Philips, TCL, etc.) solo pueden reproducir{' '}
                      <strong className="text-amber-300">Videos (MP4)</strong> o{' '}
                      <strong className="text-amber-300">Fotos (JPG)</strong>. No pueden ejecutar páginas web (.html) ni archivos ZIP.
                    </p>
                    <p className="text-xs text-emerald-400 font-semibold mt-1.5">
                      ✓ Al descargarlo como <strong>VIDEO</strong>, tu televisor lo reproducirá directamente a pantalla completa con todas las animaciones de cartelera digital profesional.
                    </p>
                    <div className="mt-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 animate-spin" style={{ animationDuration: '6s' }} />
                      <span>
                        <strong>Animaciones Estilo Cadena / McDonald's activas:</strong> El video incluye flotación continua del producto, destellos de brillo sobre las promociones, pulso rítmico en los precios y transiciones cinematográficas.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Video Configuration Options */}
              <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-neutral-300 block mb-1.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      Duración por Diapositiva
                    </label>
                    <select
                      value={secondsPerSlide}
                      onChange={(e) => setSecondsPerSlide(Number(e.target.value))}
                      disabled={isVideoRecording || useCustomSlideDurations}
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 transition disabled:opacity-50 font-medium"
                    >
                      <option value={3}>3 segundos (Rápido y Dinámico)</option>
                      <option value={4}>4 segundos (Comercial Ágil - Recomendado)</option>
                      <option value={5}>5 segundos (Estándar TV)</option>
                      <option value={6}>6 segundos (Pausado)</option>
                      <option value={8}>8 segundos (Detallado)</option>
                      <option value={10}>10 segundos (Tranquilo)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-300 block mb-1.5 flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                      Ciclos en el Archivo
                    </label>
                    <select
                      value={loops}
                      onChange={(e) => setLoops(Number(e.target.value))}
                      disabled={isVideoRecording}
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 transition"
                    >
                      <option value={1}>1 ciclo del carrusel</option>
                      <option value={2}>2 ciclos (Doble duración)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-300 block mb-1.5 flex items-center gap-1.5">
                      <Film className="w-3.5 h-3.5 text-amber-400" />
                      Resumen del Video
                    </label>
                    <div className="px-3 py-2 bg-neutral-900/60 rounded-xl border border-neutral-800 text-xs text-neutral-300 flex items-center justify-between">
                      <span className="font-semibold text-white">{selectedSlides.length} diapositivas</span>
                      <span className="font-mono text-amber-400 font-bold">~{estimatedVideoDuration}s</span>
                    </div>
                  </div>
                </div>

                {/* Custom duration checkbox */}
                <div className="pt-1 flex items-center justify-between border-t border-neutral-800/80">
                  <label className="flex items-center space-x-2.5 cursor-pointer text-xs text-neutral-300 hover:text-white transition select-none">
                    <input
                      type="checkbox"
                      checked={useCustomSlideDurations}
                      onChange={(e) => setUseCustomSlideDurations(e.target.checked)}
                      disabled={isVideoRecording}
                      className="rounded border-neutral-700 text-amber-500 focus:ring-amber-500 h-4 w-4 bg-neutral-900"
                    />
                    <span>Respetar duración individual si está personalizada en la diapositiva</span>
                  </label>
                  <span className="text-[11px] text-neutral-400 font-mono">
                    {Math.floor(estimatedVideoDuration / 60)}m {estimatedVideoDuration % 60}s totales
                  </span>
                </div>
              </div>

              {/* Background Music Options for MP4 Video */}
              <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeVideoAudio}
                      onChange={(e) => setIncludeVideoAudio(e.target.checked)}
                      disabled={isVideoRecording}
                      className="rounded border-neutral-700 text-amber-500 focus:ring-amber-500 h-4 w-4 bg-neutral-900 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Music className="w-3.5 h-3.5 text-amber-400" />
                        Incluir Música de Fondo en el Video MP4 para USB
                      </span>
                      <span className="text-[11px] text-neutral-400 block mt-0.5">
                        El video resultante se exportará con pista de audio estéreo lista para sonar en la televisión.
                      </span>
                    </div>
                  </label>

                  {includeVideoAudio && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                      Audio Activado
                    </span>
                  )}
                </div>

                {includeVideoAudio && (
                  <div className="space-y-3 pt-2.5 border-t border-neutral-800/80 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {BUILT_IN_MUSIC_TRACKS.map((t) => {
                        const isSelected = videoAudioTrackUrl === t.id;
                        const isPreviewing = previewingAudioId === t.id;
                        return (
                          <div
                            key={t.id}
                            className={`p-2.5 rounded-xl border transition flex items-center justify-between ${
                              isSelected
                                ? 'bg-amber-500/15 border-amber-500 text-white shadow-sm'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                            }`}
                          >
                            <div
                              onClick={() => {
                                setVideoAudioTrackUrl(t.id);
                                setVideoAudioTrackName(t.name);
                              }}
                              className="cursor-pointer flex-1"
                            >
                              <div className="flex items-center space-x-1.5">
                                <span className="font-bold text-xs text-white">{t.name}</span>
                                {isSelected && <Check className="w-3 h-3 text-amber-400" />}
                              </div>
                              <span className="text-[10px] text-neutral-400">{t.category}</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleTogglePreviewAudio(t.id)}
                              className={`p-1.5 rounded-lg transition text-xs ${
                                isPreviewing
                                  ? 'bg-amber-500 text-black font-bold'
                                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                              }`}
                              title={isPreviewing ? 'Detener prueba' : 'Escuchar prueba'}
                            >
                              {isPreviewing ? (
                                <Square className="w-3 h-3 fill-current" />
                              ) : (
                                <Play className="w-3 h-3 fill-current" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Custom MP3 upload or selected info */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-neutral-900/60 rounded-xl border border-neutral-800 text-xs">
                      <div className="text-neutral-300">
                        {videoAudioTrackUrl && !videoAudioTrackUrl.startsWith('track-') ? (
                          <span className="text-emerald-400 font-semibold">
                            ✓ Audio propio cargado: {videoAudioTrackName}
                          </span>
                        ) : (
                          <span>Pista activa: <strong className="text-white">{videoAudioTrackName}</strong></span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          ref={customAudioInputRef}
                          type="file"
                          accept="audio/*"
                          onChange={handleUploadCustomAudio}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => customAudioInputRef.current?.click()}
                          className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold transition flex items-center space-x-1"
                        >
                          <Upload className="w-3 h-3" />
                          <span>Cargar otro MP3</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SLIDE SELECTION PANEL - Solves missing slides complaint */}
              <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-amber-400" />
                      Diapositivas a Incluir en el Video ({selectedSlides.length} de {slides.length})
                    </h4>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Marca las diapositivas que deben aparecer en el video. Por defecto están todas incluidas.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={selectAllSlides}
                      disabled={isVideoRecording}
                      className="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white rounded-lg text-xs font-semibold border border-neutral-700 transition"
                    >
                      ✓ Todas ({slides.length})
                    </button>
                    <button
                      type="button"
                      onClick={selectOnlyActiveSlides}
                      disabled={isVideoRecording}
                      className="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white rounded-lg text-xs font-semibold border border-neutral-700 transition"
                    >
                      Solo Activas ({activeSlides.length})
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                  {slides.map((slide, idx) => {
                    const isSelected = selectedSlideIds.has(slide.id);
                    const tpl = templates.find((t) => t.id === slide.templateId) || templates[0];
                    const imgUrl = slide.useCutout && slide.mediaCutoutUrl ? slide.mediaCutoutUrl : slide.mediaUrl;
                    const durationText = useCustomSlideDurations && slide.useCustomDuration && slide.duration
                      ? `${slide.duration}s`
                      : `${secondsPerSlide}s`;

                    return (
                      <div
                        key={slide.id}
                        onClick={() => !isVideoRecording && toggleSlideSelection(slide.id)}
                        className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center space-x-3 ${
                          isSelected
                            ? 'bg-neutral-900 border-amber-500/60 shadow-sm'
                            : 'bg-neutral-950/60 border-neutral-800/80 opacity-50 hover:opacity-80'
                        }`}
                      >
                        {/* Checkbox */}
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border transition ${
                            isSelected
                              ? 'bg-amber-500 border-amber-400 text-black'
                              : 'bg-neutral-800 border-neutral-700 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>

                        {/* Thumbnail */}
                        <div
                          className="w-12 h-8 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner"
                          style={{ background: tpl.bgGradient }}
                        >
                          {imgUrl ? (
                            <img src={imgUrl} alt="" className="max-h-full max-w-full object-contain" />
                          ) : (
                            <span className="text-[9px] font-bold text-white/50">TV</span>
                          )}
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-white truncate block">
                              #{idx + 1} {slide.title || 'Sin título'}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-amber-400 flex-shrink-0">
                              {durationText}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-neutral-400">
                            <span className="truncate">{slide.price || 'Sin precio'}</span>
                            {!slide.active && (
                              <span className="text-neutral-400 bg-neutral-800 px-1 py-0.2 rounded text-[9px]">
                                Inactiva en web
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Real-time Recording Status & Live Progress */}
              {isVideoRecording && (
                <div className="p-5 bg-neutral-950 rounded-2xl border border-amber-500/40 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                      </span>
                      <span className="text-white font-bold">{videoStatusMessage}</span>
                    </div>
                    <span className="font-mono text-amber-400 font-extrabold text-sm">{videoProgressPct}%</span>
                  </div>

                  <div className="w-full bg-neutral-800 rounded-full h-3 overflow-hidden shadow-inner">
                    <div
                      className="bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${videoProgressPct}%` }}
                    />
                  </div>

                  {/* Live Canvas Preview of video frame being recorded */}
                  <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                    <div className="w-full sm:w-48 aspect-video rounded-xl bg-black border border-neutral-700 overflow-hidden shadow-md flex-shrink-0">
                      <canvas
                        ref={previewCanvasRef}
                        width={320}
                        height={180}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-xs text-neutral-400 space-y-1 flex-1">
                      <p className="text-white font-semibold">Generando video Full HD 1080p en tiempo real...</p>
                      <p>
                        Se están grabando los fondos, las fotos de tus productos sin fondo, precios, reloj digital y el cintillo en movimiento.
                      </p>
                      <button
                        onClick={handleCancelVideo}
                        className="mt-2 text-xs text-red-400 hover:text-red-300 underline font-medium"
                      >
                        Cancelar grabación
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Generated Video Player Preview & Download Button */}
              {videoPreviewUrl && !isVideoRecording && (
                <div className="p-5 bg-neutral-950 rounded-2xl border border-emerald-500/40 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-emerald-400">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-sm font-bold">¡Video Full HD generado con éxito!</span>
                    </div>
                    <span className="text-xs text-neutral-400 font-mono">1920x1080 · 30 FPS · MP4</span>
                  </div>

                  {/* Embedded Video Player */}
                  <div className="w-full aspect-video rounded-2xl bg-black overflow-hidden border border-neutral-800 shadow-2xl">
                    <video
                      src={videoPreviewUrl}
                      controls
                      autoPlay
                      loop
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleDownloadVideoFile}
                      className="w-full sm:flex-1 py-3.5 px-6 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-extrabold text-sm rounded-2xl shadow-xl flex items-center justify-center space-x-2 transition"
                    >
                      <Download className="w-5 h-5" />
                      <span>💾 Descargar Video para el Pendrive (.mp4)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleGenerateVideo}
                      className="w-full sm:w-auto py-3.5 px-5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-2xl border border-neutral-700 flex items-center justify-center gap-2 transition"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Regenerar Video</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Initial Action Button (if not generated yet) */}
              {!videoPreviewUrl && !isVideoRecording && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleGenerateVideo}
                    disabled={isVideoRecording}
                    className="w-full py-4 px-6 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400 hover:from-amber-400 hover:via-orange-400 hover:to-yellow-300 text-black font-black text-sm rounded-2xl shadow-2xl flex items-center justify-center space-x-2.5 transition transform active:scale-[0.99]"
                  >
                    <Play className="w-5 h-5 fill-black" />
                    <span>▶ Generar y Descargar Video MP4 para USB</span>
                  </button>
                </div>
              )}

              {/* Clear TV Usage Instructions */}
              <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 text-xs text-neutral-400 space-y-2">
                <span className="font-bold text-neutral-200 block uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Tv className="w-3.5 h-3.5 text-amber-400" />
                  Instrucciones sencillas para ver el video en la televisión:
                </span>
                <ol className="list-decimal list-inside space-y-1.5 leading-relaxed pl-1">
                  <li>Copia el archivo de video descargado a cualquier memoria USB (pendrive).</li>
                  <li>Enchufa el pendrive en cualquier puerto USB de tu televisión.</li>
                  <li>
                    En el mando a distancia de la TV, presiona <strong>"Source" / "Entradas"</strong> y entra en <strong>"USB / Videos"</strong>.
                  </li>
                  <li>
                    Selecciona el video y activa la opción <strong>"Repetir todo" / "Bucle / Loop"</strong> en el reproductor de la tele para que funcione continuamente todo el día.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 2: FULL HD SLIDE POSTER IMAGES */}
          {activeTab === 'images' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Carteles Full HD Listos para TV (1920x1080)
                  </h4>
                  <p className="text-xs text-neutral-400">
                    Descarga cada cartel individualmente con el fondo, producto, precio y cintillo incorporados para el visor de fotos de tu TV.
                  </p>
                </div>

                <button
                  onClick={handleDownloadZip}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-amber-400 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-neutral-700"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Todas en ZIP</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {slides.map((slide, index) => {
                  const tpl = templates.find((t) => t.id === slide.templateId) || templates[0];
                  return (
                    <div
                      key={slide.id}
                      className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800 flex items-center justify-between gap-3 hover:border-neutral-700 transition"
                    >
                      <div className="flex items-center space-x-3 overflow-hidden">
                        <div
                          className="w-16 h-10 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner"
                          style={{ background: tpl.bgGradient }}
                        >
                          <img
                            src={slide.useCutout && slide.mediaCutoutUrl ? slide.mediaCutoutUrl : slide.mediaUrl}
                            alt=""
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div className="truncate">
                          <span className="text-xs font-bold text-white block truncate">
                            {slide.title}
                          </span>
                          <span className="text-[10px] text-neutral-400 block font-mono">
                            Diapositiva #{index + 1} · {slide.price || 'Sin precio'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDownloadSingleImage(slide, index)}
                        className="p-2.5 bg-neutral-800 hover:bg-amber-500 text-amber-400 hover:text-black rounded-xl transition flex-shrink-0"
                        title="Descargar cartel Full HD 1080p"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: COMPLETE USB ZIP PACKAGE */}
          {activeTab === 'package' && (
            <div className="space-y-5">
              <div className="p-5 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent rounded-2xl border border-amber-500/30 space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 flex-shrink-0">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Paquete con Todos los Formatos en un solo archivo ZIP
                    </h3>
                    <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                      Descarga una carpeta comprimida que contiene los carteles 1080p, el reproductor web autónomo y la guía de instrucciones.
                    </p>
                  </div>
                </div>
              </div>

              {isProcessingZip && (
                <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-300 font-medium">{zipStatusMessage}</span>
                    <span className="font-mono text-amber-400 font-bold">{zipProgressPct}%</span>
                  </div>
                  <div className="w-full bg-neutral-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-orange-400 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${zipProgressPct}%` }}
                    />
                  </div>
                </div>
              )}

              {downloadSuccess && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                  <Check className="w-5 h-5 flex-shrink-0" />
                  <span>{downloadSuccess}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleDownloadZip}
                disabled={isProcessingZip}
                className="w-full py-3.5 px-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-sm rounded-2xl shadow-xl flex items-center justify-center space-x-2 transition disabled:opacity-50"
              >
                <Download className="w-5 h-5" />
                <span>
                  {isProcessingZip ? 'Procesando imágenes y empaquetando...' : 'Descargar Archivo ZIP'}
                </span>
              </button>
            </div>
          )}

          {/* TAB 4: STANDALONE HTML PLAYER */}
          {activeTab === 'html' && (
            <div className="space-y-4">
              <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Archivo Web HTML5 (Para Smart TV con Navegador o TV Box)
                    </h4>
                    <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
                      Un único archivo <code>PANTALLA_MOSTRADOR_TV.html</code> que funciona sin internet si tu televisor cuenta con navegador de internet o si tienes conectado un TV Box / mini PC.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadHtmlOnly}
                  className="mt-2 py-2.5 px-5 bg-sky-500 hover:bg-sky-400 text-black font-extrabold text-xs rounded-xl shadow-lg flex items-center gap-2 transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar PANTALLA_MOSTRADOR_TV.html</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: TV BRAND INSTRUCTIONS GUIDE */}
          {activeTab === 'guide' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Tv className="w-4 h-4 text-amber-400" />
                  Cómo activar la reproducción continua en bucle en tu televisión
                </h4>

                <div className="p-3.5 bg-neutral-900 rounded-xl space-y-1.5 border border-neutral-800">
                  <span className="font-bold text-amber-400 block text-xs">Si utilizas el archivo de Video (MP4) - Recomendado</span>
                  <p className="text-neutral-300 leading-relaxed">
                    1. Abre el video desde el menú <strong>Videos / USB</strong> de la tele.<br />
                    2. Pulsa el botón <strong>Menú / Opciones</strong> del control remoto mientras el video se reproduce.<br />
                    3. Activa <strong>"Repetir todo"</strong> o el icono de flechas circulares (Bucle). El video no se detendrá en todo el día.
                  </p>
                </div>

                <div className="p-3.5 bg-neutral-900 rounded-xl space-y-1.5 border border-neutral-800">
                  <span className="font-bold text-amber-400 block text-xs">Samsung / LG / Sony / TCL (Fotos)</span>
                  <p className="text-neutral-300 leading-relaxed">
                    Si prefieres usar las fotos en lugar de video: entra en <strong>Fotos &gt; USB</strong>, abre la primera imagen y activa <strong>"Pase de diapositivas"</strong> con repetición activada.
                  </p>
                </div>

                <div className="p-3.5 bg-neutral-900 rounded-xl space-y-1.5 border border-neutral-800">
                  <span className="font-bold text-amber-400 block text-xs">Formato de la memoria USB (Pendrive)</span>
                  <p className="text-neutral-300 leading-relaxed">
                    Para máxima compatibilidad con televisores antiguos y modernos, asegúrate de que el pendrive esté formateado en <strong>FAT32</strong> o <strong>exFAT</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-950/90 flex items-center justify-between">
          <div className="text-[11px] text-neutral-400 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>El video y las fotos funcionan 100% desconectados en la televisión sin internet.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold rounded-xl text-neutral-300 hover:text-white transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
