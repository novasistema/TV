import React, { useState } from 'react';
import { Tag, Plus, Edit2, Trash2, Check, X, Layers, AlertCircle } from 'lucide-react';
import { Slide } from '../types';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  slides: Slide[];
  onAddCategory: (categoryName: string) => void;
  onRenameCategory: (oldName: string, newName: string) => void;
  onDeleteCategory: (categoryName: string) => void;
}

const COMMON_SUGGESTIONS = [
  'Panadería & Pastelería',
  'Carnicería & Charcutería',
  'Frutería & Verdulería',
  'Menús & Platos del Día',
  'Café & Desayunos',
  'Bebidas & Cócteles',
  'Postres & Helados',
  'Ofertas de la Semana',
  'Moda & Calzado',
  'Electrónica & Telefonía',
  'Peluquería & Estética',
  'Ferretería & Hogar',
  'Farmacia & Cuidado',
  'Combos Familiares',
];

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  slides,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
}) => {
  const [newCatInput, setNewCatInput] = useState('');
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editCatValue, setEditCatValue] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newCatInput.trim();
    if (!trimmed) return;

    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg('Esa categoría ya existe.');
      return;
    }

    onAddCategory(trimmed);
    setNewCatInput('');
    setErrorMsg(null);
  };

  const handleStartRename = (cat: string) => {
    setEditingCat(cat);
    setEditCatValue(cat);
    setErrorMsg(null);
  };

  const handleSaveRename = () => {
    if (!editingCat) return;
    const trimmed = editCatValue.trim();
    if (!trimmed) {
      setErrorMsg('El nombre no puede estar vacío.');
      return;
    }

    if (
      trimmed.toLowerCase() !== editingCat.toLowerCase() &&
      categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())
    ) {
      setErrorMsg('Ya existe otra categoría con ese nombre.');
      return;
    }

    onRenameCategory(editingCat, trimmed);
    setEditingCat(null);
    setEditCatValue('');
    setErrorMsg(null);
  };

  const getSlideCount = (catName: string) => {
    return slides.filter((s) => s.category?.toLowerCase() === catName.toLowerCase()).length;
  };

  const unusedSuggestions = COMMON_SUGGESTIONS.filter(
    (sug) => !categories.some((c) => c.toLowerCase() === sug.toLowerCase())
  );

  return (
    <div
      id="category-manager-overlay"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="category-manager-card"
        className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-6 flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Categorías y Secciones</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Organiza tus diapositivas y personaliza las secciones de tu comercio.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add Category Form */}
        <form onSubmit={handleCreate} className="space-y-2">
          <label className="text-xs font-semibold text-neutral-300 block">
            Agregar nueva categoría personalizada:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCatInput}
              onChange={(e) => {
                setNewCatInput(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="Ej: Carnicería, Platos del Día, Bebidas, Ofertas..."
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              disabled={!newCatInput.trim()}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 text-black font-extrabold text-xs rounded-xl shadow-md flex items-center space-x-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar</span>
            </button>
          </div>
          {errorMsg && (
            <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
              <AlertCircle className="w-3.5 h-3.5" /> {errorMsg}
            </p>
          )}
        </form>

        {/* Suggestions chips */}
        {unusedSuggestions.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
              Sugerencias rápidas por rubro:
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
              {unusedSuggestions.slice(0, 8).map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => onAddCategory(sug)}
                  className="px-2.5 py-1 bg-neutral-950 hover:bg-amber-500/10 hover:border-amber-500/40 border border-neutral-800 rounded-lg text-[11px] text-neutral-300 hover:text-amber-300 transition flex items-center gap-1"
                >
                  <Plus className="w-3 h-3 text-amber-400" />
                  <span>{sug}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Existing Categories List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-semibold mb-1">
            <span>Categorías activas ({categories.length})</span>
            <span>Diapositivas asociadas</span>
          </div>

          {categories.length === 0 ? (
            <div className="p-6 text-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded-xl">
              No hay categorías creadas aún. Escribe una arriba para comenzar.
            </div>
          ) : (
            categories.map((cat) => {
              const count = getSlideCount(cat);
              const isEditingThis = editingCat === cat;

              return (
                <div
                  key={cat}
                  className="p-3 bg-neutral-950/70 border border-neutral-800 rounded-xl flex items-center justify-between gap-2 hover:border-neutral-700 transition"
                >
                  {isEditingThis ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editCatValue}
                        onChange={(e) => setEditCatValue(e.target.value)}
                        className="flex-1 bg-neutral-900 border border-amber-500 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename();
                          if (e.key === 'Escape') setEditingCat(null);
                        }}
                      />
                      <button
                        onClick={handleSaveRename}
                        className="p-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/30 transition"
                        title="Guardar nombre"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingCat(null)}
                        className="p-1.5 bg-neutral-800 text-neutral-400 rounded-lg hover:bg-neutral-700 transition"
                        title="Cancelar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                        <span className="text-xs font-bold text-white truncate">{cat}</span>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border flex items-center gap-1 ${
                            count > 0
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : 'bg-neutral-800/80 text-neutral-400 border-neutral-700'
                          }`}
                        >
                          <Layers className="w-3 h-3" />
                          <span>
                            {count} {count === 1 ? 'diapositiva' : 'diapositivas'}
                          </span>
                        </span>

                        <button
                          type="button"
                          onClick={() => handleStartRename(cat)}
                          className="p-1.5 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded-lg transition"
                          title="Cambiar nombre de categoría"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteCategory(cat)}
                          className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition"
                          title="Eliminar categoría"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
          <span className="text-[11px] text-neutral-500">
            Al cambiar el nombre de una categoría, se actualizan todas las diapositivas asociadas.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold rounded-xl text-neutral-300 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
