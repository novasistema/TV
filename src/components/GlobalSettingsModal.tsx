import React, { useState } from 'react';
import {
  X,
  Settings,
  Clock,
  Repeat,
  Sparkles,
  Store,
  Tv,
  Check,
  CloudSun,
  Layers,
  Type,
  Music,
  Volume2,
  Play,
  Square,
  Upload,
} from 'lucide-react';
import { GlobalSettings, Template } from '../types';
import { BUILT_IN_MUSIC_TRACKS, getOrGenerateTrackAudioUrl } from '../utils/audioTracks';

interface GlobalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GlobalSettings;
  templates: Template[];
  onSave: (newSettings: GlobalSettings) => void;
}

export const GlobalSettingsModal: React.FC<GlobalSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  templates,
  onSave,
}) => {
  const [formData, setFormData] = useState<GlobalSettings>({ ...settings });
  const [previewingTrackId, setPreviewingTrackId] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const previewAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const customAudioInputRef = React.useRef<HTMLInputElement | null>(null);

  // Stop preview audio when modal closes or unmounts
  const stopPreviewAudio = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      previewAudioRef.current = null;
    }
    setPreviewingTrackId(null);
    setIsGeneratingAudio(false);
  };

  const handleClose = () => {
    stopPreviewAudio();
    onClose();
  };

  const handleSave = () => {
    stopPreviewAudio();
    onSave(formData);
    onClose();
  };

  const handleTogglePreviewTrack = async (trackId: string, trackUrl?: string) => {
    if (previewingTrackId === trackId) {
      stopPreviewAudio();
      return;
    }

    stopPreviewAudio();
    setIsGeneratingAudio(true);
    setPreviewingTrackId(trackId);

    try {
      let resolvedUrl = trackUrl || trackId;
      if (trackId.startsWith('track-')) {
        resolvedUrl = await getOrGenerateTrackAudioUrl(trackId);
      }

      const audio = new Audio(resolvedUrl);
      audio.loop = true;
      audio.volume = formData.musicVolume ?? 0.7;
      previewAudioRef.current = audio;

      await audio.play();
      setIsGeneratingAudio(false);
    } catch (err) {
      console.warn('Error reproduciendo prueba de música:', err);
      stopPreviewAudio();
    }
  };

  const handleUploadCustomMusic = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        setFormData({
          ...formData,
          enableBackgroundMusic: true,
          musicTrackUrl: reader.result,
          musicTrackName: cleanName,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-neutral-100 my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-amber-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Ajustes Globales del Carrusel de TV</h2>
              <p className="text-xs text-neutral-400">
                Configuración de tiempos, bucle continuo y marca para la televisión del mostrador.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Brand & Store */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <Store className="w-4 h-4 text-amber-400" />
              Identidad del Establecimiento
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Nombre en Pantalla:</label>
                <input
                  type="text"
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  placeholder="Ej: LA BOUTIQUE & CAFÉ"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white uppercase font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Subtítulo o Lema:</label>
                <input
                  type="text"
                  value={formData.storeTagline}
                  onChange={(e) => setFormData({ ...formData, storeTagline: e.target.value })}
                  placeholder="Ej: Calidad & Sabor Artesanal"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-300 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Times & Loop */}
          <div className="space-y-3 pt-3 border-t border-neutral-800">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              Tiempos y Reproducción en Bucle
            </label>

            {/* Default Duration Slider */}
            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-300 font-medium">
                  Tiempo Predeterminado (para todas las diapositivas):
                </span>
                <span className="font-mono text-amber-400 font-bold">
                  {formData.defaultDuration} segundos
                </span>
              </div>
              <input
                type="range"
                min="4"
                max="45"
                value={formData.defaultDuration}
                onChange={(e) => setFormData({ ...formData, defaultDuration: Number(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <p className="text-[11px] text-neutral-500">
                Puedes sobrescribir este tiempo en cada diapositiva individualmente desde el editor.
              </p>
            </div>

            {/* Loop Toggle */}
            <div className="flex items-center justify-between p-3 bg-neutral-950 rounded-xl border border-neutral-800">
              <div className="flex items-center space-x-2.5">
                <Repeat className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="text-xs font-bold text-white block">Reproducción en Bucle Continuo</span>
                  <span className="text-[11px] text-neutral-400">
                    Al terminar la última diapositiva, vuelve a comenzar automáticamente sin detenerse.
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={formData.loop}
                onChange={(e) => setFormData({ ...formData, loop: e.target.checked })}
                className="rounded accent-emerald-500 w-4 h-4 cursor-pointer"
              />
            </div>

            {/* Global Typography Scaling for TV */}
            <div className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-200 flex items-center gap-1.5 uppercase tracking-wider">
                  <Type className="w-4 h-4 text-amber-400" />
                  <span>Tamaño General de Letra (TV):</span>
                </label>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  {formData.globalTextScale === 'massive'
                    ? '🔥 Gigante (+85%)'
                    : formData.globalTextScale === 'huge'
                    ? '⭐ Extra Grande (+50%)'
                    : formData.globalTextScale === 'large'
                    ? '✨ Grande (+25%)'
                    : 'Estándar'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'standard', label: 'Estándar', desc: 'Normal', sample: 'Aa' },
                  { id: 'large', label: 'Grande', desc: '+25%', sample: 'Aa' },
                  { id: 'huge', label: 'Extra Grande', desc: '+50%', sample: 'Aa' },
                  { id: 'massive', label: 'Gigante', desc: '+85%', sample: 'AA' },
                ].map((opt) => {
                  const isSelected = (formData.globalTextScale || 'standard') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, globalTextScale: opt.id as any })}
                      className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-500 text-white shadow-sm'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-xs text-white">{opt.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                      <div className="flex items-baseline justify-between mt-1.5">
                        <span className="text-[10px] text-neutral-400">{opt.desc}</span>
                        <span
                          className={`font-black ${
                            opt.id === 'massive'
                              ? 'text-base text-amber-300'
                              : opt.id === 'huge'
                              ? 'text-sm text-amber-400'
                              : opt.id === 'large'
                              ? 'text-xs text-neutral-200'
                              : 'text-[11px] text-neutral-400'
                          }`}
                        >
                          {opt.sample}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-neutral-400">
                Aumenta el tamaño de letra en todas las diapositivas para mejorar la lectura a distancia en pantallas grandes de mostrador.
              </p>
            </div>
          </div>

          {/* Visual Elements & Widgets */}
          <div className="space-y-3 pt-3 border-t border-neutral-800">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <Tv className="w-4 h-4 text-amber-400" />
              Elementos en la Pantalla de TV
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <label className="flex items-center space-x-2 p-3 bg-neutral-950 rounded-xl border border-neutral-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.showProgressBar}
                  onChange={(e) => setFormData({ ...formData, showProgressBar: e.target.checked })}
                  className="rounded accent-amber-500 w-4 h-4"
                />
                <div>
                  <span className="font-semibold text-white block">Barra de Progreso</span>
                  <span className="text-[11px] text-neutral-400">Indica visualmente el tiempo restante</span>
                </div>
              </label>

              <label className="flex items-center space-x-2 p-3 bg-neutral-950 rounded-xl border border-neutral-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(formData.showStoreHeader)}
                  onChange={(e) => setFormData({ ...formData, showStoreHeader: e.target.checked })}
                  className="rounded accent-amber-500 w-4 h-4"
                />
                <div>
                  <span className="font-semibold text-white block">Barra Superior (Nombre del Negocio)</span>
                  <span className="text-[11px] text-neutral-400">Desactívalo para maximizar el tamaño de las imágenes</span>
                </div>
              </label>

              <label className="flex items-center space-x-2 p-3 bg-neutral-950 rounded-xl border border-neutral-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.showClock}
                  onChange={(e) => setFormData({ ...formData, showClock: e.target.checked })}
                  className="rounded accent-amber-500 w-4 h-4"
                />
                <div>
                  <span className="font-semibold text-white block">Reloj Digital en Vivo</span>
                  <span className="text-[11px] text-neutral-400">Muestra la hora actual en pantalla</span>
                </div>
              </label>

              <label className="flex items-center space-x-2 p-3 bg-neutral-950 rounded-xl border border-neutral-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.showWeather}
                  onChange={(e) => setFormData({ ...formData, showWeather: e.target.checked })}
                  className="rounded accent-amber-500 w-4 h-4"
                />
                <div>
                  <span className="font-semibold text-white block">Widget Clima / Temperatura</span>
                  <span className="text-[11px] text-neutral-400">{formData.weatherCity} ({formData.weatherTemp})</span>
                </div>
              </label>

              <label className="flex items-center space-x-2 p-3 bg-neutral-950 rounded-xl border border-neutral-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.showTicker}
                  onChange={(e) => setFormData({ ...formData, showTicker: e.target.checked })}
                  className="rounded accent-amber-500 w-4 h-4"
                />
                <div>
                  <span className="font-semibold text-white block">Ticker / Marquee Inferior</span>
                  <span className="text-[11px] text-neutral-400">Barra de noticias y ofertas desplazable</span>
                </div>
              </label>
            </div>

            {/* Global Ticker Text */}
            {formData.showTicker && (
              <div className="pt-1">
                <label className="text-xs text-neutral-400 block mb-1">
                  Texto global del Ticker inferior (para diapositivas sin texto propio):
                </label>
                <textarea
                  rows={2}
                  value={formData.globalTickerText}
                  onChange={(e) => setFormData({ ...formData, globalTickerText: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-300 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>
            )}
          </div>

          {/* Background Music Section */}
          <div className="space-y-3.5 pt-3 border-t border-neutral-800">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Music className="w-4 h-4 text-amber-400" />
                  Música de Fondo para las Imágenes (TV & Video USB)
                </label>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Reproduce ambientación musical en el televisor y la incluye en los videos MP4 exportados.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(formData.enableBackgroundMusic)}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      enableBackgroundMusic: e.target.checked,
                      musicTrackUrl: formData.musicTrackUrl || 'track-acoustic-warm',
                      musicTrackName: formData.musicTrackName || 'Café & Comercio Acogedor',
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {formData.enableBackgroundMusic && (
              <div className="space-y-3 bg-neutral-950 p-4 rounded-2xl border border-neutral-800 animate-fade-in">
                {/* Volume Slider */}
                <div className="flex items-center justify-between gap-4 p-3 bg-neutral-900/80 rounded-xl border border-neutral-800">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-neutral-300">
                    <Volume2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>Volumen de la Música:</span>
                  </div>
                  <div className="flex items-center space-x-3 flex-1 max-w-xs justify-end">
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={formData.musicVolume ?? 0.7}
                      onChange={(e) => {
                        const vol = parseFloat(e.target.value);
                        setFormData({ ...formData, musicVolume: vol });
                        if (previewAudioRef.current) {
                          previewAudioRef.current.volume = vol;
                        }
                      }}
                      className="w-32 accent-amber-500 cursor-pointer"
                    />
                    <span className="font-mono text-xs font-bold text-amber-400 w-10 text-right">
                      {Math.round((formData.musicVolume ?? 0.7) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Track Selector List */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
                    Selecciona una Banda Sonora Comercial:
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {BUILT_IN_MUSIC_TRACKS.map((track) => {
                      const isSelected = formData.musicTrackUrl === track.id;
                      const isPreviewing = previewingTrackId === track.id;

                      return (
                        <div
                          key={track.id}
                          className={`p-3 rounded-xl border transition flex flex-col justify-between ${
                            isSelected
                              ? 'bg-amber-500/15 border-amber-500/70 text-white'
                              : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div
                              onClick={() =>
                                setFormData({
                                  ...formData,
                                  musicTrackUrl: track.id,
                                  musicTrackName: track.name,
                                })
                              }
                              className="cursor-pointer flex-1"
                            >
                              <div className="flex items-center space-x-1.5">
                                <span className="font-bold text-xs text-white">{track.name}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                              </div>
                              <span className="text-[10px] text-amber-400/90 font-medium block mt-0.5">
                                {track.category} · {track.bpm} BPM
                              </span>
                              <p className="text-[10px] text-neutral-400 mt-1 line-clamp-2">
                                {track.description}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleTogglePreviewTrack(track.id)}
                              className={`p-2 rounded-lg transition flex-shrink-0 ${
                                isPreviewing
                                  ? 'bg-amber-500 text-black font-bold'
                                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                              }`}
                              title={isPreviewing ? 'Detener prueba' : 'Escuchar prueba'}
                            >
                              {isPreviewing ? (
                                <Square className="w-3.5 h-3.5 fill-current" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Upload Custom Music */}
                <div className="p-3 bg-neutral-900/60 rounded-xl border border-neutral-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-white block">
                      ¿Tienes tu propia música o anuncio corporativo?
                    </span>
                    <span className="text-[11px] text-neutral-400 block mt-0.5">
                      {formData.musicTrackUrl && !formData.musicTrackUrl.startsWith('track-') ? (
                        <span className="text-emerald-400 font-semibold">
                          ✓ Archivo cargado: {formData.musicTrackName || 'Audio personalizado'}
                        </span>
                      ) : (
                        'Puedes subir cualquier archivo de audio (MP3, WAV o M4A) desde tu dispositivo.'
                      )}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {formData.musicTrackUrl && !formData.musicTrackUrl.startsWith('track-') && (
                      <button
                        type="button"
                        onClick={() => handleTogglePreviewTrack('custom', formData.musicTrackUrl)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                          previewingTrackId === 'custom'
                            ? 'bg-amber-500 text-black'
                            : 'bg-neutral-800 hover:bg-neutral-700 text-white'
                        }`}
                      >
                        {previewingTrackId === 'custom' ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-current" />
                            <span>Detener</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Probar</span>
                          </>
                        )}
                      </button>
                    )}

                    <input
                      ref={customAudioInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={handleUploadCustomMusic}
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => customAudioInputRef.current?.click()}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Subir MP3</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold rounded-xl text-neutral-300 transition"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs rounded-xl shadow-lg flex items-center space-x-1.5 transition"
          >
            <Check className="w-4 h-4" />
            <span>Guardar Ajustes</span>
          </button>
        </div>
      </div>
    </div>
  );
};
