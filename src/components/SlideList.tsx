import React, { useState } from 'react';
import {
  Plus,
  Edit3,
  Copy,
  Trash2,
  Clock,
  Calendar,
  Wand2,
  Eye,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Layers,
  Video,
  Image as ImageIcon,
  Tag,
  SlidersHorizontal,
  Crown,
  Tv,
} from 'lucide-react';
import { Slide, Template, GlobalSettings } from '../types';
import { isSlideActiveNow, getScheduleLabel } from '../utils/scheduleUtils';

interface SlideListProps {
  slides: Slide[];
  templates: Template[];
  settings: GlobalSettings;
  categories: string[];
  onEditSlide: (slide: Slide) => void;
  onDeleteSlide: (id: string) => void;
  onDuplicateSlide: (slide: Slide) => void;
  onToggleActive: (id: string) => void;
  onMoveSlide: (index: number, direction: 'up' | 'down') => void;
  onOpenQuickBgRemove: (slide: Slide) => void;
  onAddNewSlide: () => void;
  onAddNewLogoSlide?: () => void;
  onOpenCategoryManager: () => void;
}

export const SlideList: React.FC<SlideListProps> = ({
  slides,
  templates,
  settings,
  categories,
  onEditSlide,
  onDeleteSlide,
  onDuplicateSlide,
  onToggleActive,
  onMoveSlide,
  onOpenQuickBgRemove,
  onAddNewSlide,
  onAddNewLogoSlide,
  onOpenCategoryManager,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Filter slides
  const filteredSlides = selectedCategory === 'ALL'
    ? slides
    : slides.filter((s) => s.category?.toLowerCase() === selectedCategory.toLowerCase());

  // Count slides per category
  const getCategoryCount = (catName: string) => {
    return slides.filter((s) => s.category?.toLowerCase() === catName.toLowerCase()).length;
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" />
            Diapositivas del Mostrador ({slides.length})
          </h3>
          <p className="text-xs text-neutral-400">
            Gestiona el orden de rotación, categorías, duración y franjas horarias de emisión.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={onOpenCategoryManager}
            className="flex-1 sm:flex-none px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 hover:border-amber-500/50 text-neutral-200 hover:text-amber-300 font-bold text-xs rounded-xl shadow-md flex items-center justify-center space-x-1.5 transition"
            title="Gestionar categorías y secciones del comercio"
          >
            <Tag className="w-3.5 h-3.5 text-amber-400" />
            <span>Gestionar Categorías ({categories.length})</span>
          </button>

          {onAddNewLogoSlide && (
            <button
              onClick={onAddNewLogoSlide}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/60 text-amber-300 font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center space-x-1.5 transition"
              title="Crear diapositiva exclusiva libre con el logo de tu empresa para la TV"
            >
              <Crown className="w-4 h-4 text-amber-400" />
              <span>+ Diapositiva Logo</span>
            </button>
          )}

          <button
            onClick={onAddNewSlide}
            className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-xs rounded-xl shadow-lg flex items-center justify-center space-x-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Añadir Producto</span>
          </button>
        </div>
      </div>

      {/* Categories Filter Tabs Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
          <SlidersHorizontal className="w-3 h-3 text-amber-400" /> Filtrar:
        </span>

        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
            selectedCategory === 'ALL'
              ? 'bg-amber-500 text-black shadow-md'
              : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
          }`}
        >
          <span>Todas</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              selectedCategory === 'ALL' ? 'bg-black/30 text-black font-extrabold' : 'bg-neutral-800 text-neutral-400'
            }`}
          >
            {slides.length}
          </span>
        </button>

        {categories.map((cat) => {
          const count = getCategoryCount(cat);
          const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();

          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-amber-500 text-black shadow-md font-bold'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
              }`}
            >
              <Tag className="w-3 h-3 opacity-70" />
              <span>{cat}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  isSelected ? 'bg-black/30 text-black font-extrabold' : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}

        <button
          onClick={onOpenCategoryManager}
          className="px-2.5 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-900 text-amber-400/80 hover:text-amber-300 border border-dashed border-neutral-800 hover:border-amber-500/50 text-[11px] font-bold whitespace-nowrap transition flex items-center gap-1"
          title="Agregar o editar categorías"
        >
          <Plus className="w-3 h-3" />
          <span>Nueva Categoría</span>
        </button>
      </div>

      {/* Slide Cards Grid */}
      {filteredSlides.length === 0 ? (
        <div className="p-10 text-center bg-neutral-900/50 border border-neutral-800 rounded-2xl space-y-3">
          <Tag className="w-8 h-8 text-neutral-600 mx-auto" />
          <div className="text-sm font-bold text-white">
            No hay diapositivas en la categoría "{selectedCategory}"
          </div>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Puedes añadir una nueva diapositiva para esta categoría o cambiar la categoría de una existente.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300 rounded-xl transition"
            >
              Ver todas las diapositivas
            </button>
            <button
              onClick={onAddNewSlide}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-xs font-bold text-black rounded-xl transition"
            >
              Crear diapositiva en {selectedCategory}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSlides.map((slide) => {
            const index = slides.findIndex((s) => s.id === slide.id);
            const isActiveNow = isSlideActiveNow(slide, settings);
            const tpl = templates.find((t) => t.id === slide.templateId) || templates[0];
            const displayImage = slide.useCutout && slide.mediaCutoutUrl ? slide.mediaCutoutUrl : slide.mediaUrl;
            const duration = slide.useCustomDuration ? slide.duration : settings.defaultDuration;

            return (
              <div
                key={slide.id}
                className={`rounded-2xl border transition-all flex flex-col justify-between overflow-hidden shadow-md group ${
                  slide.active
                    ? isActiveNow
                      ? 'bg-neutral-900 border-neutral-700/80 hover:border-amber-500/50'
                      : 'bg-neutral-900/70 border-neutral-800 opacity-80'
                    : 'bg-neutral-950 border-neutral-900 opacity-50'
                }`}
              >
                {/* Media banner & badge preview */}
                <div
                  className="relative h-40 w-full flex items-center justify-center p-3 overflow-hidden"
                  style={{
                    background:
                      slide.layoutType === 'exclusive-logo'
                        ? slide.exclusiveBgType === 'pure-black'
                          ? '#000000'
                          : slide.exclusiveBgType === 'radial-glow'
                          ? `radial-gradient(circle, ${tpl.accentColor}35 0%, #06060a 70%)`
                          : tpl.bgGradient
                        : tpl.bgGradient,
                  }}
                >
                  {slide.layoutType === 'exclusive-logo' ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                      {slide.showHaloGlow && (
                        <div
                          className="absolute w-24 h-24 rounded-full blur-xl opacity-40 pointer-events-none"
                          style={{ backgroundColor: tpl.accentColor }}
                        />
                      )}
                      <img
                        src={displayImage || settings.storeLogoUrl}
                        alt={slide.title}
                        className="relative max-h-full max-w-full drop-shadow-xl transition-transform group-hover:scale-105 duration-300"
                        style={{
                          transform: `scale(${((slide.logoScale || 75) / 100) * 0.95})`,
                          objectFit: slide.logoFit || 'contain',
                        }}
                      />
                    </div>
                  ) : slide.mediaType === 'video' ? (
                    <div className="relative w-full h-full rounded-xl overflow-hidden">
                      <video src={slide.mediaUrl} className="w-full h-full object-cover" muted />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 text-white text-[10px] font-bold flex items-center gap-1">
                        <Video className="w-3 h-3 text-sky-400" /> Video
                      </span>
                    </div>
                  ) : (
                    <img
                      src={displayImage}
                      alt={slide.title}
                      className={`max-h-full max-w-full object-contain filter drop-shadow-md transition-transform group-hover:scale-105 duration-300 ${
                        slide.useCutout ? 'scale-105' : 'rounded-lg'
                      }`}
                    />
                  )}

                  {/* Badges on preview */}
                  <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
                    {slide.layoutType === 'exclusive-logo' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase shadow tracking-wider bg-amber-500 text-black flex items-center gap-1">
                        <Crown className="w-3 h-3 text-black" /> SOLO LOGO
                      </span>
                    ) : (
                      slide.badge && (
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-black uppercase shadow tracking-wider"
                          style={{
                            backgroundColor: slide.badgeColor || tpl.badgeBg,
                            color: tpl.badgeText,
                          }}
                        >
                          {slide.badge}
                        </span>
                      )
                    )}
                    {slide.useCutout && slide.layoutType !== 'exclusive-logo' && (
                      <span className="px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-xs text-emerald-400 text-[9px] font-semibold flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> Sin fondo
                      </span>
                    )}
                    {slide.layoutType === 'exclusive-logo' && (
                      <span className="px-1.5 py-0.5 rounded bg-black/80 border border-neutral-700 text-neutral-300 text-[9px] font-semibold flex items-center gap-1">
                        <Tv className="w-2.5 h-2.5 text-amber-400" /> Escala: {slide.logoScale || 75}%
                      </span>
                    )}
                  </div>

                  {/* Price tag */}
                  {slide.price && slide.layoutType !== 'exclusive-logo' && (
                    <div
                      className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg font-extrabold text-xs shadow-lg"
                      style={{ backgroundColor: tpl.accentColor, color: '#000000' }}
                    >
                      {slide.price}
                    </div>
                  )}

                  {/* Order buttons overlay */}
                  <div className="absolute top-2.5 right-2.5 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-lg p-1">
                    <button
                      disabled={index === 0}
                      onClick={() => onMoveSlide(index, 'up')}
                      className="p-1 text-white hover:text-amber-400 disabled:opacity-20 transition"
                      title="Mover arriba"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      disabled={index === slides.length - 1}
                      onClick={() => onMoveSlide(index, 'down')}
                      className="p-1 text-white hover:text-amber-400 disabled:opacity-20 transition"
                      title="Mover abajo"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Card content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
                      <span className="font-semibold text-neutral-300">#{index + 1}</span>
                      <label className="flex items-center space-x-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={slide.active}
                          onChange={() => onToggleActive(slide.id)}
                          className="rounded accent-amber-500 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="text-[11px]">{slide.active ? 'Activa' : 'Pausada'}</span>
                      </label>
                    </div>

                    <h4 className="text-sm font-bold text-white line-clamp-1 group-hover:text-amber-300 transition">
                      {slide.title}
                    </h4>
                    <p className="text-xs text-neutral-400 line-clamp-2 mt-0.5 leading-relaxed">
                      {slide.subtitle || 'Sin descripción'}
                    </p>
                  </div>

                  {/* Metadata badges: Category, Schedule & Duration */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-1">
                    {slide.category && (
                      <span
                        className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/25 flex items-center gap-1 font-semibold text-[10px]"
                        title={`Categoría: ${slide.category}`}
                      >
                        <Tag className="w-2.5 h-2.5 text-amber-400" />
                        <span className="truncate max-w-[130px]">{slide.category}</span>
                      </span>
                    )}

                    <span
                      className={`px-2 py-0.5 rounded-md flex items-center gap-1 ${
                        slide.active && isActiveNow
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                      title={getScheduleLabel(slide)}
                    >
                      <Calendar className="w-3 h-3" />
                      <span className="truncate max-w-[120px]">{getScheduleLabel(slide)}</span>
                    </span>

                    <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span>{duration}s</span>
                    </span>
                  </div>

                  {/* Actions bottom bar */}
                  <div className="pt-2 border-t border-neutral-800 flex items-center justify-between gap-1">
                    <button
                      onClick={() => onEditSlide(slide)}
                      className="flex-1 py-1.5 px-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 hover:text-white rounded-xl transition flex items-center justify-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Editar</span>
                    </button>

                    {slide.mediaType === 'image' && (
                      <button
                        onClick={() => onOpenQuickBgRemove(slide)}
                        className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-amber-400 rounded-xl transition"
                        title="Quitar fondo a la imagen"
                      >
                        <Wand2 className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => onDuplicateSlide(slide)}
                      className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-xl transition"
                      title="Duplicar diapositiva"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onDeleteSlide(slide.id)}
                      className="p-1.5 bg-neutral-800 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 rounded-xl transition"
                      title="Eliminar diapositiva"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

