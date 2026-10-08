import React, { useState, useRef } from 'react';
import {
  X,
  Sparkles,
  Wand2,
  Image as ImageIcon,
  Video,
  Clock,
  Palette,
  Calendar,
  Plus,
  Trash2,
  Check,
  Upload,
  AlertCircle,
  Tag,
  DollarSign,
  Layers,
  ArrowRight,
  Camera,
  Smartphone,
  Laptop,
  FileImage,
  Link2,
  FolderOpen,
  Maximize2,
  Loader2,
  Crown,
  Tv,
  Sliders,
  SunMedium,
  Eye,
  EyeOff,
  Type,
} from 'lucide-react';
import { Slide, Template, GlobalSettings } from '../types';
import { BackgroundRemoverModal } from './BackgroundRemoverModal';
import { TIME_SLOTS } from '../data/defaultData';
import { isSlideActiveNow } from '../utils/scheduleUtils';
import { compressAndResizeImage } from '../utils/imageUtils';

interface SlideEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  slide: Slide;
  templates: Template[];
  settings: GlobalSettings;
  categories: string[];
  onSave: (updatedSlide: Slide) => void;
  onDelete?: (id: string) => void;
  onAddNewCategory?: (category: string) => void;
}

export const SlideEditorModal: React.FC<SlideEditorModalProps> = ({
  isOpen,
  onClose,
  slide,
  templates,
  settings,
  categories,
  onSave,
  onDelete,
  onAddNewCategory,
}) => {
  const [currentTab, setCurrentTab] = useState<'content' | 'ai' | 'template' | 'schedule'>('content');
  const [formData, setFormData] = useState<Slide>({ ...slide });
  const [isBgModalOpen, setIsBgModalOpen] = useState(false);
  const [isCustomCategory, setIsCustomCategory] = useState<boolean>(
    Boolean(formData.category && !categories.includes(formData.category))
  );

  // AI Copy Generator State
  const [aiProduct, setAiProduct] = useState(formData.title || '');
  const [aiCategory, setAiCategory] = useState(formData.category || categories[0] || 'Ferretería y Herramientas');
  const [aiRawDetails, setAiRawDetails] = useState('');
  const [aiTone, setAiTone] = useState('comercial');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadInfo, setUploadInfo] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const pcFileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraFileInputRef = useRef<HTMLInputElement | null>(null);

  const currentTemplate = templates.find((t) => t.id === formData.templateId) || templates[0];

  // Highlight points state helper
  const handleAddHighlight = () => {
    if (formData.highlights.length < 4) {
      setFormData({
        ...formData,
        highlights: [...formData.highlights, 'Nuevo punto destacado'],
      });
    }
  };

  const handleUpdateHighlight = (index: number, val: string) => {
    const updated = [...formData.highlights];
    updated[index] = val;
    setFormData({ ...formData, highlights: updated });
  };

  const handleRemoveHighlight = (index: number) => {
    setFormData({
      ...formData,
      highlights: formData.highlights.filter((_, i) => i !== index),
    });
  };

  // Image upload handler (file from PC or Mobile phone, compressed & optimized for TV)
  const processUploadedFile = async (file: File) => {
    setIsUploading(true);
    setUploadInfo(null);
    setUploadError(null);
    try {
      const { dataUrl, type, sizeKb } = await compressAndResizeImage(file, 1920, 0.88);
      setFormData((prev) => ({
        ...prev,
        mediaUrl: dataUrl,
        mediaType: type,
        useCutout: false,
        mediaCutoutUrl: undefined,
      }));
      setUploadInfo(`Foto cargada con éxito (${sizeKb} KB) · Optimizada para TV`);
    } catch (err: any) {
      console.error('Error processing upload with compressor, attempting direct read', err);
      // Fallback: direct FileReader
      try {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          if (result) {
            setFormData((prev) => ({
              ...prev,
              mediaUrl: result,
              mediaType: file.type.startsWith('video/') ? 'video' : 'image',
              useCutout: false,
              mediaCutoutUrl: undefined,
            }));
            setUploadInfo(`Foto cargada con éxito (${Math.round(file.size / 1024)} KB)`);
          } else {
            setUploadError('No se pudo leer la imagen seleccionada.');
          }
        };
        reader.onerror = () => {
          setUploadError('Error al leer el archivo en el navegador.');
        };
        reader.readAsDataURL(file);
      } catch (fallbackErr) {
        setUploadError('Error al procesar el archivo. Prueba con una imagen JPG o PNG.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processUploadedFile(file);
    // Reset value so re-selecting the exact same file fires onChange every time
    e.target.value = '';
  };

  // Drag and drop handler
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      processUploadedFile(file);
    }
  };

  // Save Cutout from BackgroundRemoverModal
  const handleSaveCutout = (cutoutDataUrl: string) => {
    setFormData((prev) => ({
      ...prev,
      mediaCutoutUrl: cutoutDataUrl,
      useCutout: true,
    }));
  };

  // Generate Copy with Gemini API
  const handleGenerateCopy = async () => {
    setIsGeneratingAi(true);
    setAiError(null);
    setAiSuccessMessage(null);

    try {
      const selectedTemplate = templates.find((t) => t.id === formData.templateId) || templates[0];
      const res = await fetch('/api/gemini/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: aiProduct || formData.title,
          category: aiCategory,
          rawDetails: aiRawDetails || formData.subtitle,
          tone: aiTone,
          templateStyle: selectedTemplate.theme,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Error al generar copy publicitario');
      }

      const copy = data.copy;
      setFormData((prev) => ({
        ...prev,
        title: copy.headline || prev.title,
        subtitle: copy.subtitle || prev.subtitle,
        badge: copy.badge || prev.badge,
        price: copy.price || prev.price,
        originalPrice: copy.originalPrice || prev.originalPrice,
        highlights: copy.highlights && copy.highlights.length > 0 ? copy.highlights : prev.highlights,
        ctaText: copy.ctaText || prev.ctaText,
        tickerText: copy.tickerText || prev.tickerText,
      }));

      setAiSuccessMessage('¡Copy generado con éxito e incorporado a la diapositiva!');
    } catch (err: any) {
      console.error('AI generation error:', err);
      setAiError(err.message || 'Error al conectar con la API de IA');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Analyze image with Gemini AI
  const handleAnalyzeImageWithAi = async () => {
    if (!formData.mediaUrl) {
      setAiError('Sube una imagen primero para que la IA pueda analizarla.');
      return;
    }
    setIsGeneratingAi(true);
    setAiError(null);
    setAiSuccessMessage(null);

    try {
      const res = await fetch('/api/gemini/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: formData.mediaUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Error al analizar la imagen con IA');
      }

      const analysis = data.analysis;
      setAiProduct(analysis.detectedProductName || '');
      setAiCategory(analysis.category || aiCategory);

      setFormData((prev) => ({
        ...prev,
        title: analysis.suggestedHeadline || prev.title,
        badge: analysis.suggestedBadge || prev.badge,
        price: analysis.suggestedPricePlaceholder || prev.price,
        highlights: analysis.highlights || prev.highlights,
      }));

      setAiSuccessMessage('¡Producto identificado en la foto! Hemos redactado titulares basados en la imagen.');
    } catch (err: any) {
      console.error('AI image analysis error:', err);
      setAiError(err.message || 'Error al analizar imagen');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Check if slide is active right now
  const isActiveCurrently = isSlideActiveNow(formData, settings);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[94vh] bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-neutral-100 my-auto">
        {/* Hidden inputs for PC and Mobile file selection - ALWAYS rendered in DOM */}
        <input
          ref={pcFileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileUpload}
          className="hidden"
          id="global-pc-file-input"
        />
        <input
          ref={cameraFileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
          id="global-camera-file-input"
        />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/80">
          <div className="flex items-center space-x-3">
            <span
              className="w-3.5 h-3.5 rounded-full"
              style={{
                backgroundColor: formData.badgeColor || '#d97706',
              }}
            />
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Editar Diapositiva Mostrador
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                    formData.active
                      ? isActiveCurrently
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {formData.active ? (isActiveCurrently ? '● Emitiéndose Ahora' : '○ Fuera de Horario') : 'Desactivada'}
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Ajusta los textos, plantilla, imagen sin fondo y horarios de emisión para la televisión.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2 text-xs font-semibold text-neutral-300 cursor-pointer mr-2">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="rounded accent-amber-500 w-4 h-4 cursor-pointer"
              />
              <span>Activa en Carrusel</span>
            </label>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-neutral-800 bg-neutral-950/50 px-6 gap-2 text-sm overflow-x-auto">
          <button
            onClick={() => setCurrentTab('content')}
            className={`py-3 px-4 font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              currentTab === 'content'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Contenido & Imagen</span>
          </button>

          <button
            onClick={() => setCurrentTab('ai')}
            className={`py-3 px-4 font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              currentTab === 'ai'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>Redactar con IA (Gemini)</span>
          </button>

          <button
            onClick={() => setCurrentTab('template')}
            className={`py-3 px-4 font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              currentTab === 'template'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Plantilla & Estilo</span>
          </button>

          <button
            onClick={() => setCurrentTab('schedule')}
            className={`py-3 px-4 font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              currentTab === 'schedule'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Tiempos & Horarios</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* TAB 1: CONTENIDO & MEDIA */}
          {currentTab === 'content' && (
            <div className="space-y-6">
              {/* SELECTOR DE FORMATO DE DIAPOSITIVA */}
              <div className="p-4 bg-neutral-900/90 rounded-2xl border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                    <Tv className="w-4 h-4 text-amber-400" />
                    Diseño & Formato en Pantalla
                  </span>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                    {formData.layoutType === 'exclusive-logo' ? '✦ Diapositiva Libre de Logo' : '✦ Producto / Comercial'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, layoutType: 'standard' })}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                      formData.layoutType !== 'exclusive-logo'
                        ? 'bg-amber-500/10 border-amber-500/80 text-white shadow-lg shadow-amber-500/10'
                        : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg flex-shrink-0 ${
                        formData.layoutType !== 'exclusive-logo'
                          ? 'bg-amber-500 text-black font-bold'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white flex items-center gap-1.5">
                        <span>Producto / Comercial</span>
                        {formData.layoutType !== 'exclusive-logo' && <Check className="w-4 h-4 text-amber-400" />}
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
                        Foto del producto a la izquierda con precio, título, puntos destacados y ofertas.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        layoutType: 'exclusive-logo',
                        logoScale: formData.logoScale || 75,
                        logoFit: formData.logoFit || 'contain',
                        exclusiveBgType: formData.exclusiveBgType || 'template',
                        showHaloGlow: formData.showHaloGlow !== false,
                        title: formData.title || settings.storeName || 'Logo de mi Empresa',
                      })
                    }
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                      formData.layoutType === 'exclusive-logo'
                        ? 'bg-amber-500/10 border-amber-500/80 text-white shadow-lg shadow-amber-500/10'
                        : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg flex-shrink-0 ${
                        formData.layoutType === 'exclusive-logo'
                          ? 'bg-amber-500 text-black font-bold'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      <Crown className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white flex items-center gap-1.5">
                        <span>Diapositiva Libre / Solo Logo</span>
                        {formData.layoutType === 'exclusive-logo' && <Check className="w-4 h-4 text-amber-400" />}
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
                        Diapositiva exclusiva para proyectar únicamente el logo de tu empresa en pantalla completa de TV.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* CONTENIDO CONDICIONAL SEGÚN TIPO */}
              {formData.layoutType === 'exclusive-logo' ? (
                <div className="space-y-6">
                  {/* Vista Previa en Pantalla TV (16:9) */}
                  <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                        <Tv className="w-4 h-4 text-amber-400" />
                        Vista Previa en Pantalla de TV (16:9 Full HD)
                      </span>
                      <span className="text-[11px] text-neutral-400">
                        Escala actual: <strong className="text-amber-400">{formData.logoScale || 75}%</strong>
                      </span>
                    </div>

                    {/* 16:9 Canvas Simulation */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingOver(true);
                      }}
                      onDragLeave={() => setIsDraggingOver(false)}
                      onDrop={handleDrop}
                      className={`relative w-full aspect-video rounded-2xl overflow-hidden border transition-all duration-300 select-none flex flex-col justify-between p-4 ${
                        isDraggingOver ? 'border-amber-400 ring-4 ring-amber-400/30 scale-[1.01]' : 'border-white/10 shadow-2xl'
                      }`}
                      style={{
                        background:
                          formData.exclusiveBgType === 'pure-black'
                            ? '#000000'
                            : formData.exclusiveBgType === 'radial-glow'
                            ? `radial-gradient(circle at center, ${(currentTemplate?.accentColor || '#f59e0b')}35 0%, #050508 70%)`
                            : currentTemplate?.bgGradient || '#0a0a0c',
                      }}
                    >
                      {/* Optional Top Bar in preview */}
                      {!formData.hideHeader && Boolean(settings.showStoreHeader) && (
                        <div className="flex items-center justify-between text-[10px] text-white/70 border-b border-white/10 pb-1.5 px-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-4 h-4 rounded font-bold text-[8px] flex items-center justify-center text-black"
                              style={{ backgroundColor: currentTemplate?.accentColor || '#f59e0b' }}
                            >
                              TV
                            </span>
                            <span className="font-bold text-white uppercase">{settings.storeName || 'MI MOSTRADOR'}</span>
                          </div>
                          <span className="font-mono text-emerald-400 font-bold">12:30</span>
                        </div>
                      )}

                      {/* Centered Scaled Logo */}
                      <div className="relative flex-1 flex flex-col items-center justify-center p-2">
                        {/* Halo Glow */}
                        {formData.showHaloGlow !== false && (
                          <div
                            className="absolute rounded-full blur-2xl pointer-events-none transition-all"
                            style={{
                              width: `${Math.min(90, (formData.logoScale || 75) + 15)}%`,
                              height: `${Math.min(85, (formData.logoScale || 75) + 15)}%`,
                              backgroundColor: currentTemplate?.accentColor || '#f59e0b',
                              opacity: 0.35,
                            }}
                          />
                        )}

                        <div
                          className="relative flex items-center justify-center transition-all duration-200"
                          style={{
                            width: `${formData.logoScale || 75}%`,
                            height: formData.showSubtitleUnderLogo && formData.subtitle
                              ? `${Math.max(30, (formData.logoScale || 75) * 0.72)}%`
                              : `${formData.logoScale || 75}%`,
                          }}
                        >
                          {formData.mediaUrl ? (
                            <img
                              src={formData.useCutout && formData.mediaCutoutUrl ? formData.mediaCutoutUrl : formData.mediaUrl}
                              alt="Logo"
                              className={`w-full h-full ${
                                formData.logoFit === 'cover' ? 'object-cover rounded-xl' : 'object-contain'
                              } ${formData.useCutout ? 'filter drop-shadow-xl' : 'rounded-lg'}`}
                            />
                          ) : (
                            <div
                              onClick={() => pcFileInputRef.current?.click()}
                              className="w-full h-full border-2 border-dashed border-amber-500/40 hover:border-amber-400 rounded-2xl flex flex-col items-center justify-center text-neutral-400 p-4 text-center bg-black/50 cursor-pointer transition hover:bg-black/60 group"
                            >
                              <Crown className="w-10 h-10 text-amber-400 mb-1 group-hover:scale-110 transition-transform" />
                              <span className="text-sm font-bold text-white group-hover:text-amber-300">Haz clic para subir tu Logo</span>
                              <span className="text-[10px] text-neutral-400">O arrastra el archivo directamente aquí</span>
                            </div>
                          )}
                        </div>

                        {/* Optional Subtitle in preview */}
                        {formData.showSubtitleUnderLogo && (formData.subtitle || settings.storeTagline) && (
                          <p className="text-xs sm:text-sm font-bold text-white mt-2 drop-shadow-md text-center max-w-md px-2">
                            {formData.subtitle || settings.storeTagline}
                          </p>
                        )}
                      </div>

                      {/* Optional Bottom Ticker in preview */}
                      {!formData.hideTicker && Boolean(settings.showTicker) && (
                        <div className="text-[9px] text-neutral-300 border-t border-white/10 pt-1 flex items-center justify-between px-2">
                          <span className="font-bold text-amber-400">INFO & OFERTAS</span>
                          <span className="truncate text-neutral-400 max-w-[280px]">
                            {formData.tickerText || settings.globalTickerText}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Carga del Logo & Archivos */}
                  <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                        <Upload className="w-4 h-4 text-amber-400" />
                        Imagen del Logotipo de la Empresa
                      </span>
                      {uploadInfo && (
                        <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          {uploadInfo}
                        </span>
                      )}
                    </div>

                    {isUploading && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-center gap-2 text-amber-300 text-xs font-semibold animate-pulse">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Cargando y optimizando imagen del logo...</span>
                      </div>
                    )}

                    {uploadError && (
                      <div className="p-3 bg-red-500/15 border border-red-500/40 rounded-xl flex items-center gap-2 text-red-300 text-xs font-medium">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <span>{uploadError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={isUploading}
                        onClick={() => pcFileInputRef.current?.click()}
                        className="px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition disabled:opacity-50 cursor-pointer"
                      >
                        <FolderOpen className="w-4 h-4" />
                        <span>Subir Archivo de Logo (PC / Celular)</span>
                      </button>

                      <button
                        type="button"
                        disabled={isUploading}
                        onClick={() => cameraFileInputRef.current?.click()}
                        className="px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl text-xs border border-neutral-700 hover:border-emerald-500 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-emerald-400" />
                        <span>Fotografiar Logo o Rótulo</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-neutral-400 text-center">
                      Formatos recomendados: <strong>PNG transparente</strong>, <strong>JPG</strong>, <strong>WEBP</strong> o <strong>SVG</strong>.
                    </p>

                    {/* Quick Store Logo Copy Button */}
                    {settings.storeLogoUrl && (
                      <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={settings.storeLogoUrl}
                            alt="Logo tienda"
                            className="h-9 w-auto max-w-[90px] object-contain rounded bg-black/40 p-1 border border-neutral-700"
                          />
                          <div>
                            <span className="text-xs font-bold text-white block">Logo general configurado</span>
                            <span className="text-[11px] text-neutral-400">Usar el logo guardado en los ajustes</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              mediaUrl: settings.storeLogoUrl || '',
                              useCutout: false,
                              mediaCutoutUrl: undefined,
                            }));
                            setUploadInfo('Logo general aplicado con éxito');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-semibold transition"
                        >
                          Usar este logo
                        </button>
                      </div>
                    )}

                    {/* Tools: Background Remover & URL */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {formData.mediaUrl && (
                        <button
                          type="button"
                          onClick={() => setIsBgModalOpen(true)}
                          className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/40 text-xs font-semibold flex items-center gap-1.5 transition"
                          title="Elimina el fondo blanco o negro de tu logotipo para que quede transparente"
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          <span>Remover fondo del logo (Wand)</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setShowUrlInput(!showUrlInput)}
                        className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-medium border border-neutral-800 flex items-center gap-1.5 transition"
                      >
                        <Link2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Pegar URL directa de imagen</span>
                      </button>
                    </div>

                    {showUrlInput && (
                      <div className="pt-2 flex gap-2">
                        <input
                          type="url"
                          placeholder="https://ejemplo.com/logo-empresa.png"
                          value={formData.mediaUrl}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              mediaUrl: e.target.value,
                              useCutout: false,
                              mediaCutoutUrl: undefined,
                            })
                          }
                          className="flex-1 bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* Adaptación y Tamaño para la Tele */}
                  <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-4">
                    <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-amber-400" />
                      Adaptar al Tamaño de la Tele (Escala & Proporción)
                    </span>

                    {/* Scale Slider */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-300 font-medium">Tamaño del Logo en Pantalla:</span>
                        <span className="font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md">
                          {formData.logoScale || 75}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="100"
                        step="5"
                        value={formData.logoScale || 75}
                        onChange={(e) => setFormData({ ...formData, logoScale: parseInt(e.target.value, 10) })}
                        className="w-full accent-amber-500 cursor-pointer h-2 bg-neutral-800 rounded-lg"
                      />

                      {/* Quick Presets */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {[
                          { label: '40% Discreto', val: 40 },
                          { label: '60% Mediano', val: 60 },
                          { label: '75% Óptimo TV', val: 75 },
                          { label: '90% Grande', val: 90 },
                          { label: '100% Ancho Total', val: 100 },
                        ].map((preset) => (
                          <button
                            key={preset.val}
                            type="button"
                            onClick={() => setFormData({ ...formData, logoScale: preset.val })}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                              (formData.logoScale || 75) === preset.val
                                ? 'bg-amber-500 text-black shadow-md'
                                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Fit Mode */}
                    <div className="pt-2 border-t border-neutral-900 space-y-2">
                      <label className="text-xs font-semibold text-neutral-300 block">
                        Modo de Ajuste de Proporciones:
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, logoFit: 'contain' })}
                          className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition flex items-center justify-between ${
                            formData.logoFit !== 'cover'
                              ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                              : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                          }`}
                        >
                          <div>
                            <span className="block font-bold">Ajustar Completo (Contain)</span>
                            <span className="text-[10px] text-neutral-400">Recomendado · Sin deformar ni cortar</span>
                          </div>
                          {formData.logoFit !== 'cover' && <Check className="w-4 h-4 text-amber-400" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, logoFit: 'cover' })}
                          className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition flex items-center justify-between ${
                            formData.logoFit === 'cover'
                              ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                              : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                          }`}
                        >
                          <div>
                            <span className="block font-bold">Llenar Espacio (Cover)</span>
                            <span className="text-[10px] text-neutral-400">Ocupa todo el contenedor</span>
                          </div>
                          {formData.logoFit === 'cover' && <Check className="w-4 h-4 text-amber-400" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Estilo de Fondo y Pantalla en la Tele */}
                  <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-4">
                    <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                      <Palette className="w-4 h-4 text-amber-400" />
                      Fondo en la Tele & Efectos Visuales
                    </span>

                    {/* Background Type Selection */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, exclusiveBgType: 'template' })}
                        className={`p-3 rounded-xl border text-left text-xs transition ${
                          formData.exclusiveBgType !== 'pure-black' && formData.exclusiveBgType !== 'radial-glow'
                            ? 'bg-amber-500/15 border-amber-500 text-white font-bold'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        <span className="block font-bold">Fondo de la Plantilla</span>
                        <span className="text-[10px] text-neutral-400">Degradado del tema comercial</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, exclusiveBgType: 'pure-black' })}
                        className={`p-3 rounded-xl border text-left text-xs transition ${
                          formData.exclusiveBgType === 'pure-black'
                            ? 'bg-amber-500/15 border-amber-500 text-white font-bold'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        <span className="block font-bold">Negro Puro OLED</span>
                        <span className="text-[10px] text-neutral-400">100% negro azabache para TV</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, exclusiveBgType: 'radial-glow' })}
                        className={`p-3 rounded-xl border text-left text-xs transition ${
                          formData.exclusiveBgType === 'radial-glow'
                            ? 'bg-amber-500/15 border-amber-500 text-white font-bold'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        <span className="block font-bold">Brillo Radial Centrado</span>
                        <span className="text-[10px] text-neutral-400">Aura focalizada detrás del logo</span>
                      </button>
                    </div>

                    {/* Ambient Glow Switch */}
                    <div className="pt-2 border-t border-neutral-900 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                          <SunMedium className="w-3.5 h-3.5 text-amber-400" />
                          Aura / Halo de luz ambiental resplandeciente
                        </span>
                        <p className="text-[11px] text-neutral-400">
                          Genera un resplandor atmosférico con el color de acento de tu marca detrás del logotipo.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.showHaloGlow !== false}
                        onChange={(e) => setFormData({ ...formData, showHaloGlow: e.target.checked })}
                        className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                      />
                    </div>

                    {/* Hide Header Switch */}
                    <div className="pt-2 border-t border-neutral-900 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                          <EyeOff className="w-3.5 h-3.5 text-sky-400" />
                          Ocultar encabezado superior (Reloj y barra de título)
                        </span>
                        <p className="text-[11px] text-neutral-400">
                          Elimina la barra superior para dar una presencia de marca 100% limpia en el televisor.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(formData.hideHeader)}
                        onChange={(e) => setFormData({ ...formData, hideHeader: e.target.checked })}
                        className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                      />
                    </div>

                    {/* Hide Ticker Switch */}
                    <div className="pt-2 border-t border-neutral-900 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                          <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                          Ocultar cinta inferior de ofertas / noticias
                        </span>
                        <p className="text-[11px] text-neutral-400">
                          Oculta la barra de desplazamiento inferior en esta diapositiva para un aspecto corporativo puro.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(formData.hideTicker)}
                        onChange={(e) => setFormData({ ...formData, hideTicker: e.target.checked })}
                        className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Subtítulo / Eslogan Opcional debajo del Logo */}
                  <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        Eslogan o Subtítulo Institucional (Opcional)
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(formData.showSubtitleUnderLogo)}
                        onChange={(e) => setFormData({ ...formData, showSubtitleUnderLogo: e.target.checked })}
                        className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                      />
                    </div>

                    {formData.showSubtitleUnderLogo && (
                      <div className="space-y-2 pt-1">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={formData.subtitle || ''}
                            onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                            placeholder="Ej: Calidad, confianza y el mejor servicio desde 1995"
                            className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 font-medium"
                          />
                          {settings.storeTagline && (
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, subtitle: settings.storeTagline })}
                              className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold whitespace-nowrap"
                              title="Copiar el eslogan configurado en los ajustes del mostrador"
                            >
                              Usar eslogan del negocio
                            </button>
                          )}
                        </div>
                        <div className="pt-1">
                          <label className="text-[11px] font-bold text-neutral-300 flex items-center gap-1 mb-1.5">
                            <Type className="w-3.5 h-3.5 text-amber-400" />
                            <span>Tamaño de letra del eslogan:</span>
                          </label>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[
                              { id: 'standard', label: 'Estándar' },
                              { id: 'large', label: 'Grande' },
                              { id: 'huge', label: 'Extra' },
                              { id: 'massive', label: 'Gigante' },
                            ].map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setFormData({ ...formData, fontSizeScale: opt.id as any })}
                                className={`py-1.5 px-2 rounded-lg border text-xs font-bold text-center transition ${
                                  (formData.fontSizeScale || 'standard') === opt.id
                                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <p className="text-[11px] text-neutral-400">
                          Este texto se proyectará centrado debajo de tu logotipo con tipografía nítida y sombra para TV.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Título de Referencia Interna */}
                  <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-2">
                    <label className="text-xs font-bold text-neutral-400 block">
                      Nombre de Referencia de la Diapositiva:
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Ej: Logotipo Oficial de la Empresa"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-semibold"
                    />
                    <p className="text-[11px] text-neutral-400">
                      Sirve para identificar esta diapositiva libre en tu lista del panel de control.
                    </p>
                  </div>
                </div>
              ) : (
                /* MODO 2: PRODUCTO / COMERCIAL */
                <div className="space-y-6">
                  {/* Media Section: Image/Video & Cutout */}
              <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-amber-400" />
                    Foto / Multimedia del Producto
                  </span>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, mediaType: 'image' })}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                        formData.mediaType === 'image' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      Imagen
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, mediaType: 'video' })}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                        formData.mediaType === 'video' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      Video MP4
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  {/* Media Preview Box & Dropzone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingOver(true);
                    }}
                    onDragLeave={() => setIsDraggingOver(false)}
                    onDrop={handleDrop}
                    className={`relative h-52 rounded-2xl bg-neutral-900 border-2 transition-all flex items-center justify-center overflow-hidden group ${
                      isDraggingOver
                        ? 'border-amber-400 bg-amber-500/10 scale-[1.01]'
                        : 'border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    {isUploading ? (
                      <div className="flex flex-col items-center justify-center text-amber-400 gap-2 p-4 text-center">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span className="text-xs font-bold">Procesando y optimizando foto...</span>
                      </div>
                    ) : formData.mediaType === 'video' ? (
                      <video src={formData.mediaUrl} className="w-full h-full object-cover" muted loop autoPlay />
                    ) : (
                      <img
                        src={formData.useCutout && formData.mediaCutoutUrl ? formData.mediaCutoutUrl : formData.mediaUrl}
                        alt="Preview"
                        className={`max-h-full max-w-full object-contain ${
                          formData.useCutout ? 'filter drop-shadow-lg' : ''
                        }`}
                      />
                    )}

                    {formData.mediaType === 'image' && !isUploading && (
                      <button
                        type="button"
                        onClick={() => setIsBgModalOpen(true)}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-amber-400 font-bold text-xs gap-1.5 backdrop-blur-xs"
                      >
                        <Wand2 className="w-6 h-6 animate-bounce" />
                        <span>Abrir Removedor de Fondo</span>
                      </button>
                    )}

                    {isDraggingOver && (
                      <div className="absolute inset-0 bg-amber-500/20 backdrop-blur-xs flex items-center justify-center text-amber-300 font-bold text-xs">
                        Suelta la foto aquí
                      </div>
                    )}
                  </div>

                  {/* Media Controls & Upload Options */}
                  <div className="md:col-span-2 space-y-3">
                    {/* Primary Upload Buttons for PC and Mobile */}
                    <div className="p-3 bg-neutral-900/90 rounded-xl border border-neutral-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                          <Laptop className="w-3.5 h-3.5 text-sky-400" />
                          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Cargar Foto desde PC o Celular:</span>
                        </span>
                        {uploadInfo && (
                          <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            {uploadInfo}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={isUploading}
                          onClick={() => pcFileInputRef.current?.click()}
                          className="px-3.5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition disabled:opacity-50"
                        >
                          <FolderOpen className="w-4 h-4" />
                          <span>Elegir Foto (PC / Celular)</span>
                        </button>

                        <button
                          type="button"
                          disabled={isUploading}
                          onClick={() => cameraFileInputRef.current?.click()}
                          className="px-3.5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl text-xs border border-neutral-700 hover:border-emerald-500 flex items-center justify-center gap-2 transition disabled:opacity-50"
                          title="Toma una foto directamente desde la cámara de tu celular"
                        >
                          <Camera className="w-4 h-4 text-emerald-400" />
                          <span>Tomar Foto con Cámara</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-neutral-400">
                          Arrastra y suelta tu imagen aquí o selecciónala desde tus archivos.
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowUrlInput(!showUrlInput)}
                          className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                        >
                          <Link2 className="w-3 h-3" />
                          <span>{showUrlInput ? 'Ocultar enlace URL' : 'O pegar enlace web'}</span>
                        </button>
                      </div>

                      {showUrlInput && (
                        <div className="pt-2 animate-fadeIn">
                          <input
                            type="text"
                            value={formData.mediaUrl}
                            onChange={(e) => setFormData({ ...formData, mediaUrl: e.target.value })}
                            placeholder="https://images.unsplash.com/..."
                            className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                          />
                        </div>
                      )}
                    </div>

                    {/* Cutout Actions */}
                    {formData.mediaType === 'image' && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsBgModalOpen(true)}
                          className="px-3.5 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-2 transition"
                        >
                          <Wand2 className="w-4 h-4 text-amber-400" />
                          <span>Quitar Fondo a la Imagen</span>
                        </button>

                        {formData.mediaCutoutUrl && (
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, useCutout: !formData.useCutout })}
                            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                              formData.useCutout
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                            }`}
                          >
                            {formData.useCutout ? '✓ Usando Recorte sin Fondo' : 'Usar Imagen Original'}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleAnalyzeImageWithAi}
                          disabled={isGeneratingAi}
                          className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-amber-300 rounded-xl text-xs font-semibold border border-amber-500/30 flex items-center gap-1.5 transition"
                          title="Gemini analiza la foto para sugerir título y texto de venta"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Analizar Foto con IA</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Text Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category / Section */}
                <div className="md:col-span-2 p-3 bg-neutral-950/60 rounded-xl border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-amber-400" />
                      <span>Categoría o Sección de la Tienda / Menú:</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCustomCategory(!isCustomCategory)}
                      className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                    >
                      {isCustomCategory ? (
                        <span>Seleccionar de la lista</span>
                      ) : (
                        <>
                          <Plus className="w-3 h-3" />
                          <span>Escribir nueva categoría</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    {isCustomCategory ? (
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          value={formData.category || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData({ ...formData, category: val });
                            setAiCategory(val);
                          }}
                          placeholder="Ej: Carnicería, Panadería, Menús, Bebidas, Calzado..."
                          className="flex-1 bg-neutral-900 border border-amber-500/80 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                        />
                        {onAddNewCategory && formData.category && !categories.includes(formData.category) && (
                          <button
                            type="button"
                            onClick={() => onAddNewCategory(formData.category!)}
                            className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0"
                            title="Guardar en la lista global de categorías"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Guardar</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <select
                        value={formData.category || (categories[0] || 'Oferta Especial')}
                        onChange={(e) => {
                          if (e.target.value === '__add_new__') {
                            setIsCustomCategory(true);
                            setFormData({ ...formData, category: '' });
                          } else {
                            setFormData({ ...formData, category: e.target.value });
                            setAiCategory(e.target.value);
                          }
                        }}
                        className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                        <option value="__add_new__">➕ Escribir otra categoría nueva...</option>
                      </select>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                    <span>Aparecerá en el encabezado de la pantalla como:</span>
                    <span className="px-2 py-0.5 rounded bg-neutral-800 text-white font-mono text-[10px] uppercase font-bold border border-neutral-700">
                      {formData.category || 'SIN CATEGORÍA'}
                    </span>
                  </div>
                </div>

                {/* Title */}
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-neutral-400 block mb-1">
                    Titular Principal de Impacto:
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ej: Desayuno Especial de Especialidad"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Subtitle */}
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-neutral-400 block mb-1">
                    Subtítulo / Beneficio de Venta:
                  </label>
                  <input
                    type="text"
                    value={formData.subtitle}
                    onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                    placeholder="Ej: Café 100% arábica recién molido + Croissant artesanal"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-sm text-neutral-300 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Selector de Tamaño de Letra / Tipografía para TV */}
                <div className="md:col-span-2 p-3.5 bg-neutral-900/90 rounded-2xl border border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-neutral-200 flex items-center gap-1.5 uppercase tracking-wider">
                      <Type className="w-4 h-4 text-amber-400" />
                      <span>Tamaño de la Letra en Pantalla (TV):</span>
                    </label>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                      {formData.fontSizeScale === 'massive'
                        ? '🔥 Gigante (+85%)'
                        : formData.fontSizeScale === 'huge'
                        ? '⭐ Extra Grande (+50%)'
                        : formData.fontSizeScale === 'large'
                        ? '✨ Grande (+25%)'
                        : 'Estándar'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'standard', label: 'Estándar', desc: 'Equilibrado', sample: 'Aa' },
                      { id: 'large', label: 'Grande', desc: '+25% tamaño', sample: 'Aa' },
                      { id: 'huge', label: 'Extra Grande', desc: '+50% alto impacto', sample: 'Aa' },
                      { id: 'massive', label: 'Gigante', desc: '+85% máxima lectura', sample: 'AA' },
                    ].map((opt) => {
                      const isSelected = (formData.fontSizeScale || 'standard') === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, fontSizeScale: opt.id as any })}
                          className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                            isSelected
                              ? 'bg-amber-500/20 border-amber-500 text-white shadow-md'
                              : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-bold text-xs text-white">{opt.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                          </div>
                          <div className="flex items-baseline justify-between mt-2">
                            <span className="text-[10px] text-neutral-400">{opt.desc}</span>
                            <span
                              className={`font-black ${
                                opt.id === 'massive'
                                  ? 'text-lg text-amber-300'
                                  : opt.id === 'huge'
                                  ? 'text-base text-amber-400'
                                  : opt.id === 'large'
                                  ? 'text-sm text-neutral-200'
                                  : 'text-xs text-neutral-400'
                              }`}
                            >
                              {opt.sample}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Dynamic Preview Bar showing actual text scaling */}
                  <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800/80 overflow-hidden flex flex-col justify-center">
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1 font-semibold">
                      Vista previa del tamaño de texto:
                    </span>
                    <p
                      className={`font-black text-white truncate transition-all ${
                        formData.fontSizeScale === 'massive'
                          ? 'text-2xl sm:text-3xl'
                          : formData.fontSizeScale === 'huge'
                          ? 'text-xl sm:text-2xl'
                          : formData.fontSizeScale === 'large'
                          ? 'text-lg sm:text-xl'
                          : 'text-base sm:text-lg'
                      }`}
                    >
                      {formData.title || 'SEGUINOS EN INSTAGRAM'}
                    </p>
                    {formData.subtitle && (
                      <p
                        className={`text-neutral-300 truncate mt-0.5 transition-all ${
                          formData.fontSizeScale === 'massive'
                            ? 'text-base font-semibold'
                            : formData.fontSizeScale === 'huge'
                            ? 'text-sm font-medium'
                            : formData.fontSizeScale === 'large'
                            ? 'text-xs'
                            : 'text-[11px]'
                        }`}
                      >
                        {formData.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {/* Badge & Price */}
                <div>
                  <label className="text-xs font-semibold text-neutral-400 block mb-1">
                    Etiqueta / Badge Superior:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.badge}
                      onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                      placeholder="OFERTA DEL DÍA"
                      className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs uppercase font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                    />
                    <input
                      type="color"
                      value={formData.badgeColor || '#d97706'}
                      onChange={(e) => setFormData({ ...formData, badgeColor: e.target.value })}
                      className="w-10 h-9 bg-neutral-950 border border-neutral-800 rounded-xl cursor-pointer p-1"
                      title="Color del badge"
                    />
                  </div>
                </div>

                {/* Pricing */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-neutral-400 block mb-1">Precio Actual:</label>
                    <input
                      type="text"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="3,80 €"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-400 block mb-1">Precio Anterior (Tachado):</label>
                    <input
                      type="text"
                      value={formData.originalPrice || ''}
                      onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                      placeholder="5,20 €"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs line-through text-neutral-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Highlights / Bullet points */}
                <div className="md:col-span-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-neutral-400">
                      Puntos Clave / Características (2-3 viñetas breves):
                    </label>
                    {formData.highlights.length < 4 && (
                      <button
                        type="button"
                        onClick={handleAddHighlight}
                        className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Agregar viñeta
                      </button>
                    )}
                  </div>

                  {formData.highlights.map((point, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                      <input
                        type="text"
                        value={point}
                        onChange={(e) => handleUpdateHighlight(index, e.target.value)}
                        className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveHighlight(index)}
                        className="p-1.5 text-neutral-500 hover:text-red-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Call to action & Ticker text */}
                <div>
                  <label className="text-xs font-semibold text-neutral-400 block mb-1">
                    Llamada a la Acción (Botón Mostrador):
                  </label>
                  <input
                    type="text"
                    value={formData.ctaText}
                    onChange={(e) => setFormData({ ...formData, ctaText: e.target.value })}
                    placeholder="Pídelo ahora en barra"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-400 block mb-1">
                    Texto para el Ticker Inferior:
                  </label>
                  <input
                    type="text"
                    value={formData.tickerText}
                    onChange={(e) => setFormData({ ...formData, tickerText: e.target.value })}
                    placeholder="Mensaje desplazable en la parte inferior..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

          {/* TAB 2: GENERADOR DE COPY CON IA (GEMINI) */}
          {currentTab === 'ai' && (
            <div className="space-y-6">
              <div className="p-5 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent rounded-2xl border border-amber-500/30">
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Generador Publicitario de Copy con Gemini IA</h3>
                    <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                      Escribe unos datos básicos sobre tu producto o promoción y la inteligencia artificial creará
                      titulares llamativos, frases de venta convincentes, precio y puntos fuertes con formato comercial
                      profesional.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <label className="text-xs font-semibold text-neutral-400 block mb-2">
                  O elige una plantilla rápida de ejemplo (Ferretería & Comercios):
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '🔧 Taladro Inalámbrico', prod: 'Taladro Percutor Inalámbrico 20V + 2 Baterías y Maletín', cat: 'Herramientas Eléctricas', det: 'Motor brushless sin carbones, mandril 13mm metálico, luz LED, garantía 3 años', tone: 'profesional' },
                    { label: '🎨 Pintura Látex Lavable', prod: 'Pintura Látex Interior Lavable 20 Litros', cat: 'Pinturas & Impermeabilizantes', det: 'Poder cubritivo premium, antihongos, secado rápido, promo especial gremio', tone: 'comercial' },
                    { label: '⚡ Combo Electricidad', prod: 'Tablero Eléctrico Disyuntor Diferencial + 4 Térmicas', cat: 'Electricidad & Iluminación', det: 'Certificación de seguridad eléctrica para obras y hogares', tone: 'profesional' },
                    { label: '🧰 Maletín Herramientas', prod: 'Set Maletín Herramientas Manuales 110 Piezas Cromo Vanadio', cat: 'Herramientas Manuales', det: 'Tubos, llaves fijas y criquet reforzado para taller mecánico', tone: 'urgente' },
                    { label: '🚰 Grifería Monocomando', prod: 'Grifería Cocina Monocomando Flexible', cat: 'Plomería & Grifería', det: 'Cartucho cerámico, pico móvil y aireador ahorrador de agua', tone: 'comercial' },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setAiProduct(preset.prod);
                        setAiCategory(preset.cat);
                        setAiRawDetails(preset.det);
                        setAiTone(preset.tone);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-amber-500 text-xs text-neutral-300 hover:text-white transition"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Input for Gemini */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Producto o Servicio:
                  </label>
                  <input
                    type="text"
                    value={aiProduct}
                    onChange={(e) => setAiProduct(e.target.value)}
                    placeholder="Ej: Amoladora Angular 115mm 850W + 3 Discos de regalo"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Categoría del Negocio:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={aiCategory}
                      onChange={(e) => setAiCategory(e.target.value)}
                      list="ai-category-suggestions"
                      placeholder="Ej: Carnicería, Cafetería, Moda..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                    <datalist id="ai-category-suggestions">
                      {categories.map((cat) => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Detalles, precios u ofertas (opcional):
                  </label>
                  <textarea
                    rows={2}
                    value={aiRawDetails}
                    onChange={(e) => setAiRawDetails(e.target.value)}
                    placeholder="Ej: Solo hoy a 4,50€ (antes 6,00€). Elaborado sin gluten, opción vegana disponible..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-amber-500 resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Tono Publicitario:
                  </label>
                  <select
                    value={aiTone}
                    onChange={(e) => setAiTone(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="comercial">Comercial & Dinámico (Ideal para tiendas)</option>
                    <option value="apetitoso">Apetitoso & Gourmet (Ideal para cafeterías/restaurantes)</option>
                    <option value="elegante">Elegante & Exclusivo (Alta gama)</option>
                    <option value="urgente">Urgente & Flash Sale (Máximo descuento)</option>
                    <option value="cercano">Cercano & Amigable (Comercio de barrio)</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleGenerateCopy}
                    disabled={isGeneratingAi}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold rounded-xl shadow-lg flex items-center justify-center space-x-2 transition disabled:opacity-50"
                  >
                    {isGeneratingAi ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent" />
                        <span>Generando con Gemini...</span>
                      </div>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Generar Copy con IA Ahora</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Status alerts */}
              {aiSuccessMessage && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>{aiSuccessMessage}</span>
                </div>
              )}

              {aiError && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{aiError}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PLANTILLA & ESTILO */}
          {currentTab === 'template' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Selecciona la Plantilla de Diseño</h3>
                <p className="text-xs text-neutral-400 mb-4">
                  Las plantillas garantizan un formato uniforme y profesional en tu pantalla de mostrador.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {templates.map((tpl) => {
                    const isSelected = formData.templateId === tpl.id;
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => setFormData({ ...formData, templateId: tpl.id })}
                        className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between space-y-3 ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500'
                            : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
                        }`}
                        style={{
                          background: isSelected ? undefined : tpl.bgGradient,
                        }}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">{tpl.name}</span>
                            {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                          </div>
                          <span className="text-[10px] uppercase font-semibold text-neutral-400 block">
                            {tpl.categoryName}
                          </span>
                        </div>

                        <p className="text-[11px] text-neutral-300 leading-tight line-clamp-2">
                          {tpl.description}
                        </p>

                        <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px]">
                          <span
                            className="px-2 py-0.5 rounded font-bold uppercase"
                            style={{ backgroundColor: tpl.badgeBg, color: tpl.badgeText }}
                          >
                            Badge Demo
                          </span>
                          <span className="font-bold" style={{ color: tpl.priceColor }}>
                            9,90 €
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TIEMPOS & HORARIOS */}
          {currentTab === 'schedule' && (
            <div className="space-y-6">
              {/* Duration Settings */}
              <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      Tiempo de Visualización en Pantalla
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Configura si esta imagen tiene un tiempo propio o utiliza el tiempo global del carrusel.
                    </p>
                  </div>

                  <label className="flex items-center space-x-2 text-xs font-semibold text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.useCustomDuration}
                      onChange={(e) => setFormData({ ...formData, useCustomDuration: e.target.checked })}
                      className="rounded accent-amber-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Tiempo Personalizado</span>
                  </label>
                </div>

                {formData.useCustomDuration ? (
                  <div className="pt-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-neutral-300">Duración para esta diapositiva:</span>
                      <span className="font-mono text-amber-400 font-bold">{formData.duration} segundos</span>
                    </div>
                    <input
                      type="range"
                      min="4"
                      max="60"
                      step="1"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-neutral-500 mt-1">
                      <span>4 seg (Rápido)</span>
                      <span>15 seg (Estándar)</span>
                      <span>60 seg (Fijo)</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-neutral-900/60 rounded-xl text-xs text-neutral-400 flex items-center justify-between">
                    <span>
                      Usa el tiempo global de la televisión: <strong>{settings.defaultDuration} segundos</strong>.
                    </span>
                    <span className="text-amber-400 text-[11px]">Se actualiza en Ajustes Globales</span>
                  </div>
                )}
              </div>

              {/* Dayparting / Schedule Settings */}
              <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      Programación por Horario del Día (Dayparting)
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Muestra ofertas matinales en el desayuno, menús al mediodía y promociones especiales por la tarde.
                    </p>
                  </div>

                  <label className="flex items-center space-x-2 text-xs font-semibold text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.schedule.enabled}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          schedule: { ...formData.schedule, enabled: e.target.checked },
                        })
                      }
                      className="rounded accent-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Filtrar por Horario</span>
                  </label>
                </div>

                {formData.schedule.enabled ? (
                  <div className="space-y-4 pt-2">
                    <label className="text-xs font-semibold text-neutral-300 block">
                      Selecciona la Franja Horaria de Emisión:
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {TIME_SLOTS.map((slot) => {
                        const isSelected = formData.schedule.timeSlot === slot.key;
                        return (
                          <button
                            key={slot.key}
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                schedule: {
                                  ...formData.schedule,
                                  timeSlot: slot.key,
                                  customStart: slot.key === 'morning' ? '07:00' : slot.key === 'lunch' ? '12:00' : slot.key === 'afternoon' ? '16:30' : slot.key === 'evening' ? '20:30' : formData.schedule.customStart,
                                  customEnd: slot.key === 'morning' ? '12:00' : slot.key === 'lunch' ? '16:30' : slot.key === 'afternoon' ? '20:30' : slot.key === 'evening' ? '02:00' : formData.schedule.customEnd,
                                },
                              })
                            }
                            className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                              isSelected
                                ? 'bg-emerald-500/15 border-emerald-500 text-white'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                            }`}
                          >
                            <span className="text-xs font-bold text-white block">{slot.name}</span>
                            <span className="text-[11px] text-neutral-400 font-mono mt-1">{slot.hours}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Hours inputs */}
                    {formData.schedule.timeSlot === 'custom' && (
                      <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-neutral-400 block mb-1">Hora Inicio (HH:mm):</label>
                          <input
                            type="time"
                            value={formData.schedule.customStart || '09:00'}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                schedule: { ...formData.schedule, customStart: e.target.value },
                              })
                            }
                            className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-xs text-neutral-400 block mb-1">Hora Fin (HH:mm):</label>
                          <input
                            type="time"
                            value={formData.schedule.customEnd || '14:00'}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                schedule: { ...formData.schedule, customEnd: e.target.value },
                              })
                            }
                            className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                          />
                        </div>
                      </div>
                    )}

                    {/* Days of week selector */}
                    <div>
                      <label className="text-xs font-semibold text-neutral-400 block mb-1.5">
                        Días de Emisión Semanal:
                      </label>
                      <div className="flex gap-1.5">
                        {[
                          { day: 1, label: 'L' },
                          { day: 2, label: 'M' },
                          { day: 3, label: 'X' },
                          { day: 4, label: 'J' },
                          { day: 5, label: 'V' },
                          { day: 6, label: 'S' },
                          { day: 0, label: 'D' },
                        ].map(({ day, label }) => {
                          const isActive = formData.schedule.daysOfWeek.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                const exists = formData.schedule.daysOfWeek.includes(day);
                                const newDays = exists
                                  ? formData.schedule.daysOfWeek.filter((d) => d !== day)
                                  : [...formData.schedule.daysOfWeek, day];
                                setFormData({
                                  ...formData,
                                  schedule: { ...formData.schedule, daysOfWeek: newDays },
                                });
                              }}
                              className={`w-8 h-8 rounded-lg text-xs font-bold transition ${
                                isActive
                                  ? 'bg-emerald-500 text-black'
                                  : 'bg-neutral-800 text-neutral-500 hover:bg-neutral-700'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-neutral-900/60 rounded-xl text-xs text-neutral-400">
                    Esta diapositiva se emitirá <strong>las 24 horas del día de forma continua</strong> en el bucle.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold rounded-xl text-neutral-300 transition"
            >
              Cancelar
            </button>
            {onDelete && slide.id && (
              <button
                type="button"
                onClick={() => {
                  onDelete(formData.id);
                  onClose();
                }}
                className="px-3.5 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs font-semibold rounded-xl transition flex items-center space-x-1.5"
                title="Eliminar esta diapositiva"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onSave(formData);
              onClose();
            }}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-sm rounded-xl shadow-lg flex items-center space-x-2 transition"
          >
            <Check className="w-4 h-4" />
            <span>Guardar Cambios</span>
          </button>
        </div>
      </div>

      {/* Sub-modal: Background Remover */}
      {isBgModalOpen && (
        <BackgroundRemoverModal
          isOpen={isBgModalOpen}
          onClose={() => setIsBgModalOpen(false)}
          initialImageUrl={formData.mediaUrl}
          onSaveCutout={handleSaveCutout}
          templateGradient={templates.find((t) => t.id === formData.templateId)?.bgGradient}
        />
      )}
    </div>
  );
};
