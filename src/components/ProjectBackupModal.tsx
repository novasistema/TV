import React, { useState, useRef } from 'react';
import {
  X,
  Save,
  Download,
  Upload,
  Check,
  AlertCircle,
  Wrench,
  Layers,
  Tag,
  ShieldCheck,
  HardDrive,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import { Slide, Template, GlobalSettings } from '../types';
import { exportProjectBackupJson, parseProjectBackupFile, ProjectBackupData } from '../utils/exportUtils';
import { HARDWARE_PRESET } from '../data/defaultData';

interface ProjectBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  slides: Slide[];
  templates: Template[];
  settings: GlobalSettings;
  categories: string[];
  onRestoreProject: (data: ProjectBackupData) => void;
  onApplyHardwarePreset: () => void;
}

export const ProjectBackupModal: React.FC<ProjectBackupModalProps> = ({
  isOpen,
  onClose,
  slides,
  templates,
  settings,
  categories,
  onRestoreProject,
  onApplyHardwarePreset,
}) => {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleDownloadBackup = () => {
    try {
      exportProjectBackupJson(slides, templates, settings, categories);
      setSuccessMessage('¡Copia de seguridad descargada con éxito! Guárdala en tu PC o celular.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (e: any) {
      setErrorMessage('Error al generar la descarga: ' + (e?.message || 'Error desconocido'));
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    setErrorMessage(null);
    try {
      const data = await parseProjectBackupFile(file);
      onRestoreProject(data);
      setSuccessMessage(`¡Proyecto restaurado con éxito! Se cargaron ${data.slides.length} diapositivas y ${data.categories.length} categorías.`);
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 2500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al procesar el archivo seleccionado.');
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleApplyHardware = () => {
    onApplyHardwarePreset();
    setSuccessMessage('¡Estética y categorías de Ferretería aplicadas con éxito! Tus diapositivas se mantuvieron a salvo.');
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="bg-neutral-900 border border-neutral-700 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl my-6">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Save className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span>Guardar y Administrar Proyecto</span>
              </h3>
              <p className="text-xs text-neutral-400">
                Guarda tu trabajo para continuarlo en cualquier momento, descárgalo o cámbialo de dispositivo.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Success / Error Alerts */}
          {successMessage && (
            <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs font-semibold flex items-center gap-2.5 animate-fadeIn">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 bg-red-500/15 border border-red-500/40 rounded-2xl text-red-300 text-xs font-semibold flex items-center gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Real-time browser persistence status */}
          <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Estado del Guardado Automático
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Autoguardado Activo
              </span>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Todo lo que cargues, fotos, títulos, categorías y precios se guardan en tiempo real en la memoria de este navegador. Al volver a abrir la página, encontrarás todo exactamente donde lo dejaste.
            </p>

            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <div className="p-2.5 bg-neutral-900 rounded-xl border border-neutral-800 text-center">
                <div className="text-base font-black text-amber-400">{slides.length}</div>
                <div className="text-[10px] text-neutral-400 font-semibold uppercase">Diapositivas</div>
              </div>
              <div className="p-2.5 bg-neutral-900 rounded-xl border border-neutral-800 text-center">
                <div className="text-base font-black text-sky-400">{categories.length}</div>
                <div className="text-[10px] text-neutral-400 font-semibold uppercase">Categorías</div>
              </div>
              <div className="p-2.5 bg-neutral-900 rounded-xl border border-neutral-800 text-center">
                <div className="text-base font-black text-emerald-400 truncate px-1">
                  {settings.storeName || 'Comercio'}
                </div>
                <div className="text-[10px] text-neutral-400 font-semibold uppercase">Nombre Negocio</div>
              </div>
            </div>
          </div>

          {/* Actions: Download Backup & Restore Backup */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Download file */}
            <div className="p-5 bg-neutral-950/80 rounded-2xl border border-neutral-800 hover:border-amber-500/40 transition flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Download className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-white">Descargar Copia de Seguridad</h4>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Descarga un archivo <span className="text-amber-300 font-mono">.json</span> con todo tu catálogo. Podrás guardarlo en tu pendrive, PC o celular para tener una copia segura o pasarlo a otra pantalla.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownloadBackup}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Archivo del Proyecto</span>
              </button>
            </div>

            {/* Restore / Load file */}
            <div className="p-5 bg-neutral-950/80 rounded-2xl border border-neutral-800 hover:border-sky-500/40 transition flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-white">Cargar / Restaurar Proyecto</h4>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Abre un archivo de respaldo que hayas descargado anteriormente para restaurar todas tus diapositivas, fotos, categorías y ajustes en un solo clic.
                </p>
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isRestoring}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs rounded-xl border border-neutral-700 hover:border-sky-400 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <FolderOpen className="w-4 h-4 text-sky-400" />
                  <span>{isRestoring ? 'Restaurando...' : 'Cargar Archivo (.json)'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Switch to Ferretería Aesthetic preset */}
          <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/30 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Activar Estética de Ferretería & Construcción
                  </h4>
                  <p className="text-xs text-neutral-400">
                    Adapta la marquesina, colores industriales y categorías de ferretería en un solo clic.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleApplyHardware}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs rounded-xl shadow transition shrink-0 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Aplicar a Ferretería</span>
              </button>
            </div>

            <div className="text-[11px] text-neutral-400 pl-1">
              ✓ <strong className="text-neutral-300">Seguridad total:</strong> Tus diapositivas y fotos ya cargadas se conservan 100%. Solo adapta el nombre comercial, el texto marquesina inferior (envíos, presupuestos gremio) y te suma las categorías de ferretería.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
          <div className="text-xs text-neutral-400 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-amber-400" />
            <span>Los datos residen en tu navegador y en tus archivos descargados.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
