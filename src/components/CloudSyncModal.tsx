import React, { useState } from 'react';
import {
  X,
  Tv,
  Cloud,
  Check,
  Copy,
  ExternalLink,
  Wifi,
  Sparkles,
  RefreshCw,
  Smartphone,
  Laptop,
  ArrowRight,
  ShieldCheck,
  Volume2,
} from 'lucide-react';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  tvUrl: string;
  isCloudConnected: boolean;
  lastSyncTime: string | null;
  onForceSync: () => Promise<void>;
  onOpenTVMode: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  tvUrl,
  isCloudConnected,
  lastSyncTime,
  onForceSync,
  onOpenTVMode,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(tvUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncSuccessMessage(null);
    try {
      await onForceSync();
      setSyncSuccessMessage('¡Sincronizado con éxito en la nube! La TV ya tiene los cambios.');
      setTimeout(() => setSyncSuccessMessage(null), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Generate QR Code URL via standard Google Chart QR API or reliable SVG generator
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    tvUrl
  )}&bgcolor=171717&color=ffffff&margin=1`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-neutral-100 my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Conectar TV a Internet & Sincronización en la Nube
                <span className="flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  En Vivo
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Modifica desde tu PC y la TV reproducirá los cambios al instante en tiempo real
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Status highlight */}
          <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Wifi className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  Base de Datos en la Nube Conectada
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xs text-neutral-400">
                  {lastSyncTime
                    ? `Última sincronización: ${new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                    : 'Sincronización bidireccional activa'}
                </div>
              </div>
            </div>

            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-lg border border-neutral-700 flex items-center justify-center gap-1.5 transition self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Guardando en la Nube...' : 'Forzar Sincronización'}</span>
            </button>
          </div>

          {syncSuccessMessage && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{syncSuccessMessage}</span>
            </div>
          )}

          {/* Step by Step Guide */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
            {/* Steps */}
            <div className="space-y-3.5">
              <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                ¿Cómo abrir la aplicación en tu Smart TV?
              </h3>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/70">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  1
                </div>
                <div className="text-xs text-neutral-300">
                  <strong className="text-white block mb-0.5">Conecta la Smart TV a Internet</strong>
                  Conecta tu televisor por Wi-Fi o cable de red y abre su navegador web (Samsung, LG webOS, Android TV, Google TV o Chromecast).
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/70">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  2
                </div>
                <div className="text-xs text-neutral-300">
                  <strong className="text-white block mb-0.5">Ingresa a la dirección web de la TV</strong>
                  Escribe el enlace en la TV o agrégalo a marcadores/favoritos para abrirlo con un clic cada día.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/70">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  3
                </div>
                <div className="text-xs text-neutral-300">
                  <strong className="text-white block mb-0.5">¡Listo! Control total desde tu PC</strong>
                  La TV reproducirá las imágenes y la música de fondo. Cada vez que edites un precio o agregues fotos en la PC, la TV se actualizará sola en segundos.
                </div>
              </div>
            </div>

            {/* QR Code and Direct URL Box */}
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col items-center text-center">
              <span className="text-xs font-semibold text-neutral-300 mb-2">
                Escanear con Celular o Smart TV
              </span>
              <div className="p-2 bg-neutral-900 rounded-xl border border-neutral-800 mb-3 shadow-inner">
                <img
                  src={qrCodeUrl}
                  alt="Código QR para Modo TV"
                  className="w-36 h-36 rounded-lg object-contain bg-neutral-900"
                />
              </div>

              <div className="w-full space-y-2">
                <div className="text-[11px] text-neutral-400">
                  Enlace directo para el navegador de la TV:
                </div>
                <div className="flex items-center gap-1.5 p-2 bg-neutral-900 rounded-lg border border-neutral-800">
                  <input
                    type="text"
                    readOnly
                    value={tvUrl}
                    className="w-full bg-transparent text-xs text-indigo-300 font-mono focus:outline-none truncate"
                  />
                  <button
                    onClick={handleCopy}
                    className="p-1.5 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded transition shrink-0"
                    title="Copiar enlace"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Workflow Diagram */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-neutral-950 via-indigo-950/20 to-neutral-950 border border-neutral-800/80">
            <div className="flex items-center justify-between text-center gap-2">
              <div className="flex flex-col items-center flex-1">
                <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-indigo-400 mb-1.5">
                  <Laptop className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-white">Tu PC de Trabajo</span>
                <span className="text-[11px] text-neutral-400">Creas ofertas & música</span>
              </div>

              <div className="flex flex-col items-center px-2">
                <div className="flex items-center gap-1 text-emerald-400">
                  <ArrowRight className="w-4 h-4 animate-pulse" />
                </div>
                <span className="text-[10px] text-emerald-400 font-semibold uppercase mt-1">
                  Nube en Vivo
                </span>
              </div>

              <div className="flex flex-col items-center flex-1">
                <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-amber-400 mb-1.5">
                  <Tv className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-white">Tu Smart TV</span>
                <span className="text-[11px] text-neutral-400">Reproduce sin cortes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 flex items-center justify-between bg-neutral-950">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white transition"
          >
            Cerrar
          </button>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                onClose();
                onOpenTVMode();
              }}
              className="px-4 py-2 text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl transition flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Probar Modo TV Aquí
            </button>
            <button
              onClick={handleCopy}
              className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-600/30 transition flex items-center gap-1.5"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? '¡Copiado!' : 'Copiar Enlace para TV'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
