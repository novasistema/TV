import React, { useState, useEffect } from 'react';
import {
  Tv,
  Settings,
  Plus,
  Play,
  Pause,
  Maximize,
  Sparkles,
  Layers,
  Wand2,
  Calendar,
  Clock,
  RotateCcw,
  Sliders,
  Palette,
  HardDrive,
  Tag,
  Save,
  Wrench,
  Check,
  Video,
  Music,
  Cloud,
  Wifi,
} from 'lucide-react';
import { Slide, Template, GlobalSettings } from './types';
import { DEFAULT_SLIDES, DEFAULT_TEMPLATES, DEFAULT_SETTINGS, HARDWARE_PRESET } from './data/defaultData';
import { TVPlayer } from './components/TVPlayer';
import { SlideList } from './components/SlideList';
import { SlideEditorModal } from './components/SlideEditorModal';
import { BackgroundRemoverModal } from './components/BackgroundRemoverModal';
import { GlobalSettingsModal } from './components/GlobalSettingsModal';
import { ScheduleSimulatorBar } from './components/ScheduleSimulatorBar';
import { TemplateManager } from './components/TemplateManager';
import { UsbExportModal } from './components/UsbExportModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { CategoryManagerModal } from './components/CategoryManagerModal';
import { ProjectBackupModal } from './components/ProjectBackupModal';
import { MusicSettingsModal } from './components/MusicSettingsModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import {
  subscribeToSignageCloud,
  saveSignageToCloud,
  testFirestoreConnection,
  SyncData,
} from './firebase';
import { ProjectBackupData } from './utils/exportUtils';

export default function App() {
  // Local persistence states
  const [slides, setSlides] = useState<Slide[]>(() => {
    const saved = localStorage.getItem('displaytv_slides');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading slides from storage', e);
      }
    }
    return DEFAULT_SLIDES;
  });

  const [templates, setTemplates] = useState<Template[]>(() => {
    const saved = localStorage.getItem('displaytv_templates');
    if (saved) {
      try {
        const parsed: Template[] = JSON.parse(saved);
        // Ensure new hardware templates are available even if user loaded before
        const existingIds = new Set(parsed.map((t) => t.id));
        const missingDefaults = DEFAULT_TEMPLATES.filter((t) => !existingIds.has(t.id));
        return [...parsed, ...missingDefaults];
      } catch (e) {
        console.error('Error loading templates from storage', e);
      }
    }
    return DEFAULT_TEMPLATES;
  });

  const [settings, setSettings] = useState<GlobalSettings>(() => {
    const saved = localStorage.getItem('displaytv_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Explicitly honor user requests:
        // 1. Quitar estado del tiempo
        // 2. Sacar parte superior donde dice ferreteria (showStoreHeader: false)
        // 3. Sacar parte inferior de la imagen (showTicker: false, showProgressBar: false)
        return {
          ...parsed,
          showWeather: false,
          showStoreHeader: false,
          showTicker: false,
          showProgressBar: false,
        };
      } catch (e) {
        console.error('Error loading settings from storage', e);
      }
    }
    return {
      ...DEFAULT_SETTINGS,
      showWeather: false,
      showStoreHeader: false,
      showTicker: false,
      showProgressBar: false,
    };
  });

  // Category state with localStorage persistence and slide category auto-discovery
  const [categories, setCategories] = useState<string[]>(() => {
    const defaultCats = [
      'Desayunos & Café',
      'Almuerzos & Menú',
      'Videos & Barista',
      'Meriendas & Dulces',
      'Tecnología & Regalos',
      'Ofertas Especiales',
      'Platos del Día',
      'Bebidas & Coctelería',
    ];

    let initialCats: string[] = [...defaultCats];
    const saved = localStorage.getItem('displaytv_categories');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          initialCats = parsed;
        }
      } catch (e) {
        console.error('Error loading categories from storage', e);
      }
    }

    // Merge with any categories already present in slides to guarantee no data loss
    const savedSlides = localStorage.getItem('displaytv_slides');
    if (savedSlides) {
      try {
        const parsedSlides: Slide[] = JSON.parse(savedSlides);
        const slideCategories = parsedSlides
          .map((s) => s.category?.trim())
          .filter((c): c is string => Boolean(c));
        initialCats = Array.from(new Set([...initialCats, ...slideCategories]));
      } catch (e) {
        console.error('Error extracting categories from slides', e);
      }
    }

    return initialCats;
  });

  // UI state
  const [isTVMode, setIsTVMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'slides' | 'templates'>('slides');
  const [editingSlide, setEditingSlide] = useState<Slide | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
  const [isCloudSyncModalOpen, setIsCloudSyncModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [quickBgSlide, setQuickBgSlide] = useState<Slide | null>(null);
  const [isUsbModalOpen, setIsUsbModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [slideIdToDelete, setSlideIdToDelete] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [backupToastMessage, setBackupToastMessage] = useState<string | null>(null);

  // Cloud Firestore Sync State
  const [isCloudConnected, setIsCloudConnected] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const isIncomingCloudSyncRef = React.useRef(false);
  const isInitialLoadRef = React.useRef(true);

  // TV direct URL detection (e.g. ?mode=tv or ?tv=true or #tv)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (
        params.get('mode') === 'tv' ||
        params.get('tv') === 'true' ||
        params.get('tv') === '1' ||
        window.location.hash === '#tv'
      ) {
        setIsTVMode(true);
      }
    }
  }, []);

  // Listen in real-time to changes saved from the PC in Firestore
  useEffect(() => {
    testFirestoreConnection().then((connected) => {
      setIsCloudConnected(connected);
    });

    const unsubscribe = subscribeToSignageCloud((data) => {
      if (!data) return;
      isIncomingCloudSyncRef.current = true;

      if (Array.isArray(data.slides) && data.slides.length > 0) {
        setSlides(data.slides);
      }
      if (Array.isArray(data.templates) && data.templates.length > 0) {
        setTemplates(data.templates);
      }
      if (data.settings) {
        setSettings(data.settings);
      }
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        setCategories(data.categories);
      }
      if (data.updatedAt) {
        setLastSyncTime(data.updatedAt);
      }

      setTimeout(() => {
        isIncomingCloudSyncRef.current = false;
      }, 1000);
    });

    return () => unsubscribe();
  }, []);

  // Automatically sync any user modification to Firestore database in real-time
  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }
    if (isIncomingCloudSyncRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      saveSignageToCloud({ slides, templates, settings, categories })
        .then(() => {
          setLastSyncTime(new Date().toISOString());
        })
        .catch((err) => {
          console.warn('Error guardando en Firestore en la nube:', err);
        });
    }, 1200);

    return () => clearTimeout(timer);
  }, [slides, templates, settings, categories]);

  // Manual force sync handler for CloudSyncModal
  const handleForceCloudSync = async () => {
    const now = new Date().toISOString();
    await saveSignageToCloud({ slides, templates, settings, categories });
    setLastSyncTime(now);
  };

  const tvUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?mode=tv`
    : '';

  // Sync to localStorage as offline instantaneous fallback
  useEffect(() => {
    localStorage.setItem('displaytv_slides', JSON.stringify(slides));
  }, [slides]);

  useEffect(() => {
    localStorage.setItem('displaytv_templates', JSON.stringify(templates));
  }, [templates]);

  useEffect(() => {
    localStorage.setItem('displaytv_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('displaytv_categories', JSON.stringify(categories));
  }, [categories]);

  // Hardware Store Preset Handler - Seamlessly adapts theme without deleting custom work
  const handleApplyHardwarePreset = () => {
    // 1. Update settings with hardware store branding and marquee ticker
    setSettings((prev) => ({
      ...prev,
      storeName: HARDWARE_PRESET.storeName,
      storeTagline: HARDWARE_PRESET.storeTagline,
      globalTickerText: HARDWARE_PRESET.globalTickerText,
      defaultTemplateId: HARDWARE_PRESET.defaultTemplateId,
      showWeather: false,
      showStoreHeader: false,
      showTicker: false,
      showProgressBar: false,
    }));

    // 2. Merge hardware store categories with existing categories without deleting anything
    setCategories((prev) => {
      const merged = [...prev];
      HARDWARE_PRESET.categories.forEach((cat) => {
        if (!merged.some((existing) => existing.toLowerCase() === cat.toLowerCase())) {
          merged.push(cat);
        }
      });
      return merged;
    });

    // 3. Ensure hardware templates exist in templates list
    const hardwareTemplateIds = ['tpl-hardware-dewalt', 'tpl-hardware-bosch', 'tpl-hardware-milwaukee', 'tpl-hardware-stanley'];
    const hardwareTemplates = DEFAULT_TEMPLATES.filter((t) => hardwareTemplateIds.includes(t.id));
    setTemplates((prev) => {
      const existingIds = new Set(prev.map((t) => t.id));
      const missingHardwareTemplates = hardwareTemplates.filter(
        (t) => !existingIds.has(t.id)
      );
      return [...prev, ...missingHardwareTemplates];
    });

    setBackupToastMessage('¡Estética y categorías de Ferretería aplicadas con éxito!');
    setTimeout(() => setBackupToastMessage(null), 4500);
  };

  // Restore project backup handler (JSON loaded from PC or mobile)
  const handleRestoreProject = (data: ProjectBackupData) => {
    if (data.slides && Array.isArray(data.slides)) {
      setSlides(data.slides);
    }
    if (data.templates && Array.isArray(data.templates)) {
      setTemplates(data.templates);
    }
    if (data.settings) {
      setSettings(data.settings);
    }
    if (data.categories && Array.isArray(data.categories)) {
      setCategories(data.categories);
    }
    setIsBackupModalOpen(false);
    setBackupToastMessage(`¡Proyecto "${data.storeName || 'Respaldo'}" restaurado con éxito!`);
    setTimeout(() => setBackupToastMessage(null), 4500);
  };

  // Category management handlers
  const handleAddCategory = (newCategory: string) => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (!categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setCategories((prev) => [...prev, trimmed]);
    }
  };

  const handleRenameCategory = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || oldName.trim() === trimmed) return;

    // 1. Update the categories array
    setCategories((prev) =>
      prev.map((cat) => (cat.toLowerCase() === oldName.toLowerCase() ? trimmed : cat))
    );

    // 2. Update ALL existing slides with this category without losing any data!
    setSlides((prev) =>
      prev.map((slide) =>
        slide.category?.toLowerCase() === oldName.toLowerCase()
          ? { ...slide, category: trimmed }
          : slide
      )
    );
  };

  const handleDeleteCategory = (categoryToDelete: string) => {
    setCategories((prev) =>
      prev.filter((cat) => cat.toLowerCase() !== categoryToDelete.toLowerCase())
    );
  };

  // Slide CRUD Handlers
  const handleAddNewSlide = () => {
    const initialCategory = categories[0] || 'Oferta Especial';
    const newSlide: Slide = {
      id: `slide-${Date.now()}`,
      title: 'Nueva Promoción Especial',
      subtitle: 'Descripción breve de la oferta o producto destacado para mostrador',
      badge: 'NUEVO',
      badgeColor: '#d97706',
      price: '4,50 €',
      originalPrice: '',
      highlights: ['Calidad superior garantizada', 'Disponible en el mostrador'],
      ctaText: 'Pídelo ahora',
      tickerText: '✨ Promoción exclusiva de mostrador · Consulta combinaciones disponibles',
      mediaType: 'image',
      mediaUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1000&auto=format&fit=crop&q=80',
      useCutout: false,
      mediaFit: 'floating',
      duration: settings.defaultDuration,
      useCustomDuration: false,
      schedule: {
        enabled: false,
        timeSlot: 'all',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
      },
      templateId: settings.defaultTemplateId || templates[0].id,
      active: true,
      order: slides.length,
      category: initialCategory,
    };

    setEditingSlide(newSlide);
    setIsEditorOpen(true);
  };

  const handleAddNewLogoSlide = () => {
    const initialCategory = categories.find((c) => c.toLowerCase().includes('marca') || c.toLowerCase().includes('logo')) || categories[0] || 'Institucional';
    const newLogoSlide: Slide = {
      id: `slide-logo-${Date.now()}`,
      layoutType: 'exclusive-logo',
      title: settings.storeName ? `Logo - ${settings.storeName}` : 'Logo de la Empresa',
      subtitle: settings.storeTagline || '',
      badge: '',
      badgeColor: '#f59e0b',
      price: '',
      originalPrice: '',
      highlights: [],
      ctaText: '',
      tickerText: settings.globalTickerText || 'Bienvenidos · Calidad y atención personalizada',
      mediaType: 'image',
      mediaUrl: settings.storeLogoUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop&q=80',
      useCutout: false,
      mediaFit: 'contain',
      logoScale: 75,
      logoFit: 'contain',
      exclusiveBgType: 'template',
      showHaloGlow: true,
      hideHeader: false,
      hideTicker: false,
      showSubtitleUnderLogo: Boolean(settings.storeTagline),
      duration: settings.defaultDuration,
      useCustomDuration: false,
      schedule: {
        enabled: false,
        timeSlot: 'all',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
      },
      templateId: settings.defaultTemplateId || templates[0].id,
      active: true,
      order: slides.length,
      category: initialCategory,
    };

    setEditingSlide(newLogoSlide);
    setIsEditorOpen(true);
  };

  const handleSaveSlide = (updatedSlide: Slide) => {
    // Auto-register category if it's new
    if (updatedSlide.category?.trim()) {
      handleAddCategory(updatedSlide.category);
    }

    setSlides((prev) => {
      const exists = prev.some((s) => s.id === updatedSlide.id);
      if (exists) {
        return prev.map((s) => (s.id === updatedSlide.id ? updatedSlide : s));
      }
      return [...prev, updatedSlide];
    });
  };

  const handleDeleteSlide = (id: string) => {
    setSlideIdToDelete(id);
  };

  const confirmDeleteSlide = () => {
    if (slideIdToDelete) {
      setSlides((prev) => prev.filter((s) => s.id !== slideIdToDelete));
      if (editingSlide?.id === slideIdToDelete) {
        setIsEditorOpen(false);
        setEditingSlide(null);
      }
      setSlideIdToDelete(null);
    }
  };

  const handleDuplicateSlide = (slide: Slide) => {
    const duplicate: Slide = {
      ...slide,
      id: `slide-${Date.now()}`,
      title: `${slide.title} (Copia)`,
      order: slides.length,
    };
    setSlides((prev) => [...prev, duplicate]);
  };

  const handleToggleActive = (id: string) => {
    setSlides((prev) =>
      prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s))
    );
  };

  const handleMoveSlide = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= slides.length) return;

    const newSlides = [...slides];
    const [moved] = newSlides.splice(index, 1);
    newSlides.splice(targetIndex, 0, moved);

    // update order property
    const reordered = newSlides.map((s, idx) => ({ ...s, order: idx }));
    setSlides(reordered);
  };

  // Quick BG Removal save
  const handleQuickBgSave = (cutoutDataUrl: string) => {
    if (!quickBgSlide) return;
    setSlides((prev) =>
      prev.map((s) =>
        s.id === quickBgSlide.id
          ? { ...s, mediaCutoutUrl: cutoutDataUrl, useCutout: true }
          : s
      )
    );
    setQuickBgSlide(null);
  };

  // Reset to default sample slides
  const handleResetData = () => {
    setIsResetConfirmOpen(true);
  };

  const confirmResetData = () => {
    setSlides(DEFAULT_SLIDES);
    setTemplates(DEFAULT_TEMPLATES);
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem('displaytv_slides');
    localStorage.removeItem('displaytv_templates');
    localStorage.removeItem('displaytv_settings');
    setIsResetConfirmOpen(false);
  };

  // IF FULLSCREEN TV MODE IS ACTIVE:
  if (isTVMode) {
    return (
      <div className="w-screen h-screen bg-black overflow-hidden select-none">
        <TVPlayer
          slides={slides}
          templates={templates}
          settings={settings}
          onExitTVMode={() => setIsTVMode(false)}
          onOpenUsbExport={() => setIsUsbModalOpen(true)}
          onUpdateSettings={setSettings}
          isCloudSynced={isCloudConnected}
          lastCloudUpdate={lastSyncTime}
        />

        {isUsbModalOpen && (
          <UsbExportModal
            isOpen={isUsbModalOpen}
            onClose={() => setIsUsbModalOpen(false)}
            slides={slides}
            templates={templates}
            settings={settings}
          />
        )}
      </div>
    );
  }

  // DASHBOARD MANAGEMENT VIEW
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-amber-500 selection:text-black">
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-30 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-black font-black text-lg shadow-lg">
                <Tv className="w-5 h-5 text-black" />
              </div>
              <div>
                <h1 className="text-base font-extrabold text-white tracking-wide flex items-center gap-2">
                  DisplayTV Signage
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold uppercase">
                    Mostrador TV
                  </span>
                </h1>
                <p className="text-xs text-neutral-400">
                  Carrusel publicitario, copy con IA y recorte de fondos
                </p>
              </div>
            </div>

            {/* Mobile Actions */}
            <div className="flex items-center gap-1.5 sm:hidden">
              <button
                onClick={() => setIsCloudSyncModalOpen(true)}
                className="p-1.5 bg-neutral-800 text-emerald-400 border border-neutral-700 rounded-xl"
                title="Vincular TV en la Nube"
              >
                <Cloud className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsMusicModalOpen(true)}
                className="p-1.5 bg-neutral-800 text-indigo-400 border border-neutral-700 rounded-xl"
                title="Música de fondo"
              >
                <Music className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsBackupModalOpen(true)}
                className="p-1.5 bg-neutral-800 text-emerald-400 border border-neutral-700 rounded-xl"
                title="Guardar / Cargar Respaldo"
              >
                <Save className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsTVMode(true)}
                className="px-3 py-1.5 bg-amber-500 text-black font-bold text-xs rounded-xl flex items-center gap-1.5"
              >
                <Maximize className="w-3.5 h-3.5" />
                <span>Modo TV</span>
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end flex-wrap gap-y-2">
            {/* Vincular Smart TV a la Nube Button */}
            <button
              onClick={() => setIsCloudSyncModalOpen(true)}
              className="px-3.5 py-2 bg-neutral-800/90 hover:bg-neutral-800 text-emerald-300 border border-emerald-500/40 hover:border-emerald-400 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
              title="Vincular tu televisor por Internet con la base de datos en la nube"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <Cloud className="w-4 h-4 text-emerald-400" />
              <span>Vincular TV (Nube)</span>
            </button>

            {/* Música para la Pantalla de TV Button */}
            <button
              onClick={() => setIsMusicModalOpen(true)}
              className={`px-3 py-2 border rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                settings.enableBackgroundMusic
                  ? 'bg-indigo-950/40 text-indigo-300 border-indigo-500/50 shadow-sm'
                  : 'bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 border-neutral-700'
              }`}
              title={
                settings.enableBackgroundMusic
                  ? `Música activa en TV: ${settings.musicTrackName || 'Música de fondo'} (Clic para cambiar o subir MP3)`
                  : 'Agregar música de fondo para las imágenes en la TV'
              }
            >
              <Music className={`w-4 h-4 ${settings.enableBackgroundMusic ? 'text-indigo-400 animate-spin' : 'text-neutral-400'}`} style={settings.enableBackgroundMusic ? { animationDuration: '4s' } : undefined} />
              <span>
                {settings.enableBackgroundMusic ? 'Música TV (ON)' : 'Música'}
              </span>
            </button>

            {/* Guardar / Respaldar Proyecto Button */}
            <button
              onClick={() => setIsBackupModalOpen(true)}
              className="px-3 py-2 bg-neutral-800/90 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 hover:border-neutral-600 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
              title="Guardar archivo de proyecto (.json) en la PC o cargar uno guardado"
            >
              <Save className="w-4 h-4 text-neutral-400" />
              <span>Respaldo</span>
            </button>

            {/* Descargar para Pendrive / Video Button */}
            <button
              onClick={() => setIsUsbModalOpen(true)}
              className="px-3 py-2 bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 hover:border-neutral-600 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
              title="Exportar Video MP4 o Carteles para Pendrive USB"
            >
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <span>USB / Pendrive</span>
            </button>

            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="px-3 py-2 bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 hover:border-amber-500/50 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
              title="Gestionar Categorías del Mostrador"
            >
              <Tag className="w-4 h-4 text-amber-400" />
              <span>Categorías ({categories.length})</span>
            </button>

            <button
              onClick={() => setActiveTab(activeTab === 'slides' ? 'templates' : 'slides')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                activeTab === 'templates'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-neutral-800/80 border-neutral-700 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>{activeTab === 'templates' ? 'Ver Diapositivas' : 'Plantillas'}</span>
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="px-3 py-2 bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
              title="Ajustes Globales"
            >
              <Settings className="w-4 h-4 text-amber-400" />
              <span>Ajustes</span>
            </button>

            {/* Primary TV Launch Button */}
            <button
              onClick={() => setIsTVMode(true)}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-xs sm:text-sm rounded-xl shadow-lg flex items-center space-x-2 transition transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Tv className="w-4 h-4" />
              <span>Iniciar Modo TV</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-6 space-y-6">
        {/* Toast feedback banner */}
        {backupToastMessage && (
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-semibold flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{backupToastMessage}</span>
            </div>
            <button
              onClick={() => setBackupToastMessage(null)}
              className="text-emerald-400 hover:text-white text-xs px-2 py-0.5 rounded"
            >
              ✕
            </button>
          </div>
        )}

        {/* Quick Hardware Store Preset Banner / Switcher */}
        <div className="p-4 bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-neutral-900/80 border border-amber-500/30 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white">
                  ¿Tu comercio es una Ferretería?
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 font-bold uppercase tracking-wider">
                  Estética Industrial
                </span>
              </div>
              <p className="text-xs text-neutral-300 mt-0.5 leading-relaxed">
                Cambia el nombre, colores industriales (estilo DeWalt, Bosch, Milwaukee, Stanley), categorías de herramientas y cinta inferior de presupuestos sin borrar ninguna de tus diapositivas cargadas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0">
            <button
              onClick={() => setIsBackupModalOpen(true)}
              className="flex-1 md:flex-none px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl border border-neutral-700 flex items-center justify-center gap-1.5 transition"
            >
              <Save className="w-3.5 h-3.5 text-emerald-400" />
              <span>Guardar / Continuar Luego</span>
            </button>

            <button
              onClick={handleApplyHardwarePreset}
              className="flex-1 md:flex-none px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition"
            >
              <Check className="w-4 h-4" />
              <span>Activar Modo Ferretería</span>
            </button>
          </div>
        </div>
        {/* Top Feature Highlights: Live Simulation Bar & Quick TV Screen Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Embedded Mini TV Preview (Left 2 cols on wide) */}
          <div className="lg:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Vista Previa en Vivo (Pantalla de Mostrador)
                </h2>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setIsUsbModalOpen(true)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 transition"
                  title="Descargar archivos para memoria USB"
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Para Pendrive USB</span>
                </button>
                <button
                  onClick={() => setIsTVMode(true)}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                >
                  <Maximize className="w-3.5 h-3.5" /> Pantalla Completa TV
                </button>
              </div>
            </div>

            {/* 16:9 TV Container */}
            <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-2xl border border-neutral-800 bg-black relative">
              <TVPlayer
                slides={slides}
                templates={templates}
                settings={settings}
                isStandalone={false}
                onOpenUsbExport={() => setIsUsbModalOpen(true)}
                onUpdateSettings={setSettings}
                isCloudSynced={isCloudConnected}
                lastCloudUpdate={lastSyncTime}
              />
            </div>
          </div>

          {/* Right Column: Schedule Simulator & Quick Stats */}
          <div className="space-y-4 flex flex-col justify-between">
            <ScheduleSimulatorBar
              settings={settings}
              onUpdateSettings={setSettings}
              slides={slides}
            />

            {/* Quick Helper / Key Features Guide Card */}
            <div className="p-5 bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-2xl shadow-lg space-y-3">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>Funcionalidades Clave</span>
              </div>
              <ul className="space-y-2 text-xs text-neutral-300">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                  <span>
                    <strong>Descarga para Pendrive:</strong> Guarda el carrusel en una memoria USB para conectarlo directamente a cualquier televisión (Samsung, LG, etc.).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                  <span>
                    <strong>Quitar fondo a imágenes:</strong> Haz que tus productos floten limpiamente sobre la plantilla de TV con 1 clic.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                  <span>
                    <strong>Copy con IA (Gemini):</strong> Redacta titulares de alto impacto, ofertas y viñetas en formato uniforme.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                  <span>
                    <strong>Horarios (Dayparting):</strong> Muestra desayunos por la mañana, menús al mediodía y 2x1 por la tarde.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                  <span>
                    <strong>Tiempos y Bucle:</strong> Asigna tiempos por diapositiva o unificados con rotación continua sin cortes.
                  </span>
                </li>
              </ul>

              <div className="pt-2 border-t border-neutral-800 flex justify-between items-center text-[11px] text-neutral-500">
                <span>¿Deseas reiniciar los datos?</span>
                <button
                  onClick={handleResetData}
                  className="text-neutral-400 hover:text-amber-400 underline transition"
                >
                  Restaurar Ejemplos
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Views: Slide List vs Template Catalog */}
        {activeTab === 'slides' ? (
          <SlideList
            slides={slides}
            templates={templates}
            settings={settings}
            categories={categories}
            onEditSlide={(slide) => {
              setEditingSlide(slide);
              setIsEditorOpen(true);
            }}
            onDeleteSlide={handleDeleteSlide}
            onDuplicateSlide={handleDuplicateSlide}
            onToggleActive={handleToggleActive}
            onMoveSlide={handleMoveSlide}
            onOpenQuickBgRemove={(slide) => setQuickBgSlide(slide)}
            onAddNewSlide={handleAddNewSlide}
            onAddNewLogoSlide={handleAddNewLogoSlide}
            onOpenCategoryManager={() => setIsCategoryModalOpen(true)}
          />
        ) : (
          <TemplateManager
            templates={templates}
            defaultTemplateId={settings.defaultTemplateId}
            onSelectDefaultTemplate={(id) => setSettings({ ...settings, defaultTemplateId: id })}
          />
        )}
      </main>

      {/* Slide Editor Modal */}
      {isEditorOpen && editingSlide && (
        <SlideEditorModal
          isOpen={isEditorOpen}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingSlide(null);
          }}
          slide={editingSlide}
          templates={templates}
          settings={settings}
          categories={categories}
          onAddNewCategory={handleAddCategory}
          onSave={handleSaveSlide}
          onDelete={handleDeleteSlide}
        />
      )}

      {/* Quick Background Remover Modal */}
      {quickBgSlide && (
        <BackgroundRemoverModal
          isOpen={!!quickBgSlide}
          onClose={() => setQuickBgSlide(null)}
          initialImageUrl={quickBgSlide.mediaUrl}
          onSaveCutout={handleQuickBgSave}
          templateGradient={templates.find((t) => t.id === quickBgSlide.templateId)?.bgGradient}
        />
      )}

      {/* Global Settings Modal */}
      {isSettingsOpen && (
        <GlobalSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          templates={templates}
          onSave={(newSettings) => setSettings(newSettings)}
        />
      )}

      {/* Category Manager Modal */}
      {isCategoryModalOpen && (
        <CategoryManagerModal
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          categories={categories}
          slides={slides}
          onAddCategory={handleAddCategory}
          onRenameCategory={handleRenameCategory}
          onDeleteCategory={handleDeleteCategory}
        />
      )}

      {/* USB Pendrive Export Modal */}
      {isUsbModalOpen && (
        <UsbExportModal
          isOpen={isUsbModalOpen}
          onClose={() => setIsUsbModalOpen(false)}
          slides={slides}
          templates={templates}
          settings={settings}
        />
      )}

      {/* Project Backup & Restore / Hardware Preset Modal */}
      {isBackupModalOpen && (
        <ProjectBackupModal
          isOpen={isBackupModalOpen}
          onClose={() => setIsBackupModalOpen(false)}
          slides={slides}
          templates={templates}
          settings={settings}
          categories={categories}
          onRestoreProject={handleRestoreProject}
          onApplyHardwarePreset={handleApplyHardwarePreset}
        />
      )}

      {/* Music Settings Modal */}
      {isMusicModalOpen && (
        <MusicSettingsModal
          isOpen={isMusicModalOpen}
          onClose={() => setIsMusicModalOpen(false)}
          settings={settings}
          onSave={(newSettings) => setSettings(newSettings)}
        />
      )}

      {/* Cloud Sync & Smart TV Pairing Modal */}
      {isCloudSyncModalOpen && (
        <CloudSyncModal
          isOpen={isCloudSyncModalOpen}
          onClose={() => setIsCloudSyncModalOpen(false)}
          tvUrl={tvUrl}
          isCloudConnected={isCloudConnected}
          lastSyncTime={lastSyncTime}
          onForceSync={handleForceCloudSync}
          onOpenTVMode={() => setIsTVMode(true)}
        />
      )}

      {/* Confirm Delete Slide Modal */}
      {slideIdToDelete && (
        <ConfirmationModal
          isOpen={!!slideIdToDelete}
          onClose={() => setSlideIdToDelete(null)}
          onConfirm={confirmDeleteSlide}
          title="¿Eliminar diapositiva?"
          description="Esta diapositiva se quitará del carrusel de la televisión y de tu lista de promociones."
          confirmText="Eliminar definitivamente"
          cancelText="Cancelar"
          variant="danger"
          previewNode={
            (() => {
              const s = slides.find((item) => item.id === slideIdToDelete);
              if (!s) return null;
              const tpl = templates.find((t) => t.id === s.templateId) || templates[0];
              const imgUrl = s.useCutout && s.mediaCutoutUrl ? s.mediaCutoutUrl : s.mediaUrl;
              return (
                <div className="flex items-center space-x-3">
                  <div
                    className="w-14 h-12 rounded-lg border border-white/10 flex items-center justify-center overflow-hidden shrink-0"
                    style={{ background: tpl.bgGradient }}
                  >
                    {s.mediaType === 'image' && imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={s.title}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-white font-black">PROMO</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white truncate">{s.title}</div>
                    <div className="text-[11px] text-neutral-400 truncate">
                      {s.subtitle || 'Sin descripción'}
                    </div>
                    {s.price && (
                      <div className="text-[11px] text-amber-400 font-extrabold mt-0.5">
                        {s.price}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()
          }
        />
      )}

      {/* Confirm Reset Data Modal */}
      {isResetConfirmOpen && (
        <ConfirmationModal
          isOpen={isResetConfirmOpen}
          onClose={() => setIsResetConfirmOpen(false)}
          onConfirm={confirmResetData}
          title="¿Restablecer datos de muestra?"
          description="Se restablecerán las 6 diapositivas y configuraciones originales de muestra. Tus promociones actuales se reemplazarán."
          confirmText="Restablecer todo"
          cancelText="Cancelar"
          variant="warning"
        />
      )}

      {/* Subtle Footer */}
      <footer className="mt-auto border-t border-neutral-900 bg-neutral-950 px-8 py-4 text-center text-xs text-neutral-500">
        DisplayTV Signage Mostrador · Pantalla de señalización digital con bucle automático y Gemini AI
      </footer>
    </div>
  );
}
