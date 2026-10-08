import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Music,
  Volume2,
  Play,
  Square,
  Upload,
  Sparkles,
  Check,
  Disc3,
  HelpCircle,
  FileAudio,
  Trash2,
} from 'lucide-react';
import { GlobalSettings } from '../types';
import { BUILT_IN_MUSIC_TRACKS, getOrGenerateTrackAudioUrl } from '../utils/audioTracks';

interface MusicSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GlobalSettings;
  onSave: (newSettings: GlobalSettings) => void;
}

export const MusicSettingsModal: React.FC<MusicSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [formData, setFormData] = useState<GlobalSettings>({ ...settings });
  const [previewingTrackId, setPreviewingTrackId] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setFormData({ ...settings });
  }, [settings, isOpen]);

  const stopPreviewAudio = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      previewAudioRef.current = null;
    }
    setPreviewingTrackId(null);
    setIsLoadingAudio(false);
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

  const handleTogglePreviewTrack = async (trackId: string, customUrl?: string) => {
    if (previewingTrackId === trackId) {
      stopPreviewAudio();
      return;
    }

    stopPreviewAudio();
    setIsLoadingAudio(true);
    setPreviewingTrackId(trackId);
    setAudioError(null);

    try {
      let resolvedUrl = customUrl || trackId;
      if (trackId.startsWith('track-')) {
        resolvedUrl = await getOrGenerateTrackAudioUrl(trackId);
      }

      const audio = new Audio(resolvedUrl);
      audio.loop = true;
      audio.volume = formData.musicVolume ?? 0.7;
      previewAudioRef.current = audio;

      await audio.play();
      setIsLoadingAudio(false);
    } catch (err: any) {
      console.warn('Error reproduciendo pista de prueba:', err);
      setAudioError('No se pudo reproducir el audio en este navegador.');
      stopPreviewAudio();
    }
  };

  const handleSelectTrack = (trackId: string, trackName: string) => {
    setFormData((prev) => ({
      ...prev,
      enableBackgroundMusic: true,
      musicTrackUrl: trackId,
      musicTrackName: trackName,
    }));
  };

  const handleUploadCustomAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setAudioError('El archivo es demasiado grande (máximo 25MB). Por favor selecciona un MP3 más liviano.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        setFormData((prev) => ({
          ...prev,
          enableBackgroundMusic: true,
          musicTrackUrl: reader.result as string,
          musicTrackName: cleanName,
        }));
        setAudioError(null);
      }
    };
    reader.onerror = () => {
      setAudioError('Error al leer el archivo de audio.');
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  const currentTrackId = formData.musicTrackUrl || 'track-acoustic-warm';
  const isCustomTrack = Boolean(
    formData.musicTrackUrl &&
    formData.musicTrackUrl.startsWith('data:audio')
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-neutral-100 my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Música para la Pantalla de TV
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                  Audio en Vivo
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Añade música comercial ambiental a las imágenes para una experiencia sin cortes
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Main Activation Banner */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-950 border border-neutral-800">
            <div className="flex items-center gap-3">
              <Disc3 className={`w-6 h-6 ${formData.enableBackgroundMusic ? 'text-indigo-400 animate-spin' : 'text-neutral-500'}`} style={{ animationDuration: '4s' }} />
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Reproducir música de fondo en la TV
                </h3>
                <p className="text-xs text-neutral-400">
                  La música suena de manera continua mientras rotan las imágenes y promociones
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.enableBackgroundMusic ?? false}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    enableBackgroundMusic: e.target.checked,
                  }))
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Explanation why audio + images is superior to heavy video on TV */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-300">Solución perfecta para Smart TV:</span> Al combinar imágenes nítidas de alta resolución con música continua de fondo, la TV no sufre de congelamientos o tirones causados por la decodificación de videos pesados. ¡Fluidez 100% garantizada en cualquier televisor!
            </div>
          </div>

          {audioError && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-xs">
              {audioError}
            </div>
          )}

          {/* Built-in Tracks Library */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Música Comercial Incluida (Libre de Derechos)
              </label>
              <span className="text-[11px] text-neutral-500">
                Optimizado para comercio & TV
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BUILT_IN_MUSIC_TRACKS.map((track) => {
                const isSelected =
                  formData.enableBackgroundMusic &&
                  !isCustomTrack &&
                  formData.musicTrackUrl === track.id;
                const isPreviewing = previewingTrackId === track.id;

                return (
                  <div
                    key={track.id}
                    className={`relative p-3.5 rounded-xl border transition-all text-left flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/40'
                        : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">
                          {track.category}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {track.bpm} BPM
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-white mb-1">
                        {track.name}
                      </h4>
                      <p className="text-xs text-neutral-400 line-clamp-2 mb-3">
                        {track.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-neutral-800/80">
                      <button
                        type="button"
                        onClick={() => handleTogglePreviewTrack(track.id)}
                        disabled={isLoadingAudio && previewingTrackId === track.id}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                          isPreviewing
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                        }`}
                      >
                        {isPreviewing ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-current" />
                            <span>Pausar</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Escuchar</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectTrack(track.id, track.name)}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Seleccionada</span>
                          </>
                        ) : (
                          <span>Usar en TV</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Audio Upload */}
          <div className="space-y-3 pt-2 border-t border-neutral-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                O Sube tu Propio Archivo de Audio / MP3
              </label>
              <span className="text-[11px] text-neutral-500">
                MP3, WAV o M4A desde tu equipo
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a"
              onChange={handleUploadCustomAudio}
              className="hidden"
            />

            {isCustomTrack ? (
              <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg">
                    <FileAudio className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      {formData.musicTrackName || 'Audio personalizado cargado'}
                    </h4>
                    <p className="text-xs text-neutral-400">
                      Tu música personalizada está activa para reproducirse en la TV
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleTogglePreviewTrack('custom', formData.musicTrackUrl)}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 rounded-lg flex items-center gap-1"
                  >
                    {previewingTrackId === 'custom' ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-current" />
                        Pausar
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Probar
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        musicTrackUrl: 'track-acoustic-warm',
                        musicTrackName: 'Café & Comercio Acogedor',
                      }))
                    }
                    className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition"
                    title="Quitar pista personalizada"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 border-2 border-dashed border-neutral-700 hover:border-indigo-500/60 rounded-xl flex items-center justify-center gap-2 text-neutral-300 hover:text-white transition bg-neutral-950/50 hover:bg-neutral-950"
              >
                <Upload className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-semibold">
                  Hacer clic para subir música MP3 desde la PC
                </span>
              </button>
            )}
          </div>

          {/* Volume and Loop Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-neutral-800">
            {/* Volume slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400 font-medium flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-neutral-400" />
                  Volumen en la TV
                </span>
                <span className="text-white font-mono font-semibold">
                  {Math.round((formData.musicVolume ?? 0.7) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={formData.musicVolume ?? 0.7}
                onChange={(e) => {
                  const vol = parseFloat(e.target.value);
                  setFormData((prev) => ({ ...prev, musicVolume: vol }));
                  if (previewAudioRef.current) {
                    previewAudioRef.current.volume = vol;
                  }
                }}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            {/* Continuous Loop */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-950 border border-neutral-800">
              <div>
                <span className="text-xs font-semibold text-white block">
                  Repetir en bucle (Loop continuo)
                </span>
                <span className="text-[11px] text-neutral-400">
                  La música no se corta al cambiar de diapositiva
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.musicLoop !== false}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, musicLoop: e.target.checked }))
                }
                className="rounded border-neutral-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-neutral-800"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 flex items-center justify-between bg-neutral-950">
          <div className="text-xs text-neutral-400 flex items-center gap-1.5">
            <Disc3 className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              Pista activa:{' '}
              <strong className="text-neutral-200">
                {formData.enableBackgroundMusic
                  ? formData.musicTrackName || 'Café & Comercio Acogedor'
                  : 'Desactivada'}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Guardar y Aplicar en TV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
