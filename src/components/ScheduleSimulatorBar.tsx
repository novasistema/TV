import React from 'react';
import { Clock, Play, RotateCcw, Sparkles, Sun, Sunset, Moon, Coffee, Utensils } from 'lucide-react';
import { GlobalSettings, Slide } from '../types';
import { isSlideActiveNow, getEffectiveTime } from '../utils/scheduleUtils';

interface ScheduleSimulatorBarProps {
  settings: GlobalSettings;
  onUpdateSettings: (newSettings: GlobalSettings) => void;
  slides: Slide[];
}

export const ScheduleSimulatorBar: React.FC<ScheduleSimulatorBarProps> = ({
  settings,
  onUpdateSettings,
  slides,
}) => {
  const { hour, minute, formatted } = getEffectiveTime(settings);

  const activeCount = slides.filter((s) => isSlideActiveNow(s, settings)).length;

  const handleSliderChange = (newHour: number) => {
    onUpdateSettings({
      ...settings,
      timeSimulationMode: true,
      simulatedHour: newHour,
      simulatedMinute: 0,
    });
  };

  const handleResetToRealTime = () => {
    onUpdateSettings({
      ...settings,
      timeSimulationMode: false,
    });
  };

  const handleQuickHour = (h: number) => {
    onUpdateSettings({
      ...settings,
      timeSimulationMode: true,
      simulatedHour: h,
      simulatedMinute: 0,
    });
  };

  return (
    <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-lg space-y-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Simulador de Horarios del Mostrador</h3>
              {settings.timeSimulationMode ? (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                  Modo Simulación ({formatted}h)
                </span>
              ) : (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Hora Real en Directo ({formatted}h)
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Arrastra el reloj para probar qué promociones verán los clientes en cada momento del día.
            </p>
          </div>
        </div>

        {/* Counter of active slides right now */}
        <div className="flex items-center space-x-2">
          <div className="px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs">
            <span className="text-neutral-400">Diapositivas activas: </span>
            <span className="font-bold text-emerald-400">{activeCount}</span>
            <span className="text-neutral-500"> / {slides.length}</span>
          </div>

          {settings.timeSimulationMode && (
            <button
              onClick={handleResetToRealTime}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-xl transition flex items-center gap-1"
              title="Volver a la hora real del sistema"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Hora Real</span>
            </button>
          )}
        </div>
      </div>

      {/* 24-Hour Slider */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span className="font-mono">00:00</span>
          <span className="font-bold text-amber-400 font-mono text-sm bg-neutral-950 px-2.5 py-0.5 rounded-lg border border-neutral-800">
            {formatted}h
          </span>
          <span className="font-mono">23:59</span>
        </div>

        <input
          type="range"
          min="0"
          max="23"
          step="1"
          value={hour}
          onChange={(e) => handleSliderChange(Number(e.target.value))}
          className="w-full accent-amber-500 cursor-pointer h-2 bg-neutral-800 rounded-lg appearance-none"
        />

        {/* Quick Slot Preset Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          <button
            onClick={() => handleQuickHour(9)}
            className={`py-1.5 px-2.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition ${
              hour >= 7 && hour < 12 && settings.timeSimulationMode
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
            }`}
          >
            <Coffee className="w-3.5 h-3.5 text-amber-400" />
            <span>09:00 Mañanas</span>
          </button>

          <button
            onClick={() => handleQuickHour(14)}
            className={`py-1.5 px-2.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition ${
              hour >= 12 && hour < 16.5 && settings.timeSimulationMode
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
            }`}
          >
            <Utensils className="w-3.5 h-3.5 text-emerald-400" />
            <span>14:00 Almuerzos</span>
          </button>

          <button
            onClick={() => handleQuickHour(18)}
            className={`py-1.5 px-2.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition ${
              hour >= 16.5 && hour < 20.5 && settings.timeSimulationMode
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
            }`}
          >
            <Sunset className="w-3.5 h-3.5 text-orange-400" />
            <span>18:00 Meriendas / 2x1</span>
          </button>

          <button
            onClick={() => handleQuickHour(21)}
            className={`py-1.5 px-2.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition ${
              (hour >= 20.5 || hour < 2) && settings.timeSimulationMode
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
            }`}
          >
            <Moon className="w-3.5 h-3.5 text-indigo-400" />
            <span>21:00 Cenas / Noche</span>
          </button>
        </div>
      </div>
    </div>
  );
};
