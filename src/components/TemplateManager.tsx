import React, { useState } from 'react';
import { Palette, Check, Sparkles, Plus, Edit2 } from 'lucide-react';
import { Template } from '../types';

interface TemplateManagerProps {
  templates: Template[];
  defaultTemplateId: string;
  onSelectDefaultTemplate: (id: string) => void;
  onSaveTemplate?: (template: Template) => void;
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({
  templates,
  defaultTemplateId,
  onSelectDefaultTemplate,
}) => {
  return (
    <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Palette className="w-5 h-5 text-amber-400" />
            Catálogo de Plantillas de Formato Unificado
          </h3>
          <p className="text-xs text-neutral-400">
            Define una estética coherente (colores de marca, tipografías y badges) para todas tus promociones.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((tpl) => {
          const isDefault = tpl.id === defaultTemplateId;

          return (
            <div
              key={tpl.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                isDefault
                  ? 'border-amber-500 ring-2 ring-amber-500/30'
                  : 'border-neutral-800 hover:border-neutral-700'
              }`}
              style={{ background: tpl.bgGradient }}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-white">{tpl.name}</span>
                  {isDefault && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Predeterminada
                    </span>
                  )}
                </div>
                <span className="text-xs text-neutral-300 font-medium block">
                  {tpl.categoryName}
                </span>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  {tpl.description}
                </p>
              </div>

              {/* Visual preview pill and price */}
              <div className="p-3 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-between">
                <span
                  className="px-2.5 py-1 rounded text-[11px] font-black uppercase tracking-wider"
                  style={{ backgroundColor: tpl.badgeBg, color: tpl.badgeText }}
                >
                  EJEMPLO BADGE
                </span>
                <span className="text-base font-black" style={{ color: tpl.priceColor }}>
                  12,50 €
                </span>
              </div>

              {/* Set as default button */}
              <button
                onClick={() => onSelectDefaultTemplate(tpl.id)}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  isDefault
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
                }`}
              >
                {isDefault ? 'Plantilla Predeterminada' : 'Establecer como Predeterminada'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
