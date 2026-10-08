import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Wand2,
  Pipette,
  Sliders,
  RotateCcw,
  Check,
  X,
  Eye,
  Eraser,
  Sparkles,
  Download,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { loadImage, detectBackgroundColor, removeBackgroundOnCanvas, ColorKeyParams } from '../utils/imageUtils';

interface BackgroundRemoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialImageUrl: string;
  onSaveCutout: (cutoutDataUrl: string) => void;
  templateGradient?: string;
}

export const BackgroundRemoverModal: React.FC<BackgroundRemoverModalProps> = ({
  isOpen,
  onClose,
  initialImageUrl,
  onSaveCutout,
  templateGradient,
}) => {
  const [loading, setLoading] = useState(false);
  const [tolerance, setTolerance] = useState(24);
  const [feather, setFeather] = useState(2);
  const [mode, setMode] = useState<'flood' | 'global'>('flood');
  const [activeTool, setActiveTool] = useState<'auto' | 'picker' | 'eraser'>('auto');
  const [pickedColor, setPickedColor] = useState<{ r: number; g: number; b: number }>({ r: 255, g: 255, b: 255 });
  const [previewBg, setPreviewBg] = useState<'checker' | 'template' | 'black' | 'white'>('checker');
  const [brushSize, setBrushSize] = useState(20);
  const [isDrawing, setIsDrawing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Haz clic en la imagen o usa Detección Automática');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const originalCanvasDataRef = useRef<ImageData | null>(null);

  // Initialize and load image
  const initializeCanvas = useCallback(async () => {
    if (!initialImageUrl) return;
    setLoading(true);
    setStatusMessage('Cargando imagen...');

    try {
      const img = await loadImage(initialImageUrl);
      originalImageRef.current = img;

      const canvas = canvasRef.current;
      if (!canvas) return;

      // Fit inside reasonable editing dimensions (e.g. max 1200px)
      const maxDim = 1000;
      let w = img.naturalWidth || 800;
      let h = img.naturalHeight || 600;

      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      originalCanvasDataRef.current = ctx.getImageData(0, 0, w, h);

      // Auto-detect dominant background color from corners
      const detected = detectBackgroundColor(ctx, w, h);
      setPickedColor(detected);

      // Perform initial background removal
      applyRemoval(detected, tolerance, feather, mode);
      setStatusMessage('Fondo detectado automáticamente. Ajusta la tolerancia o haz clic en zonas específicas.');
    } catch (err: any) {
      console.error('Error loading image in canvas:', err);
      setStatusMessage('No se pudo cargar la imagen para recorte. Verifica que sea una URL válida.');
    } finally {
      setLoading(false);
    }
  }, [initialImageUrl, tolerance, feather, mode]);

  useEffect(() => {
    if (isOpen && initialImageUrl) {
      initializeCanvas();
    }
  }, [isOpen, initialImageUrl]);

  // Apply removal algorithm
  const applyRemoval = (
    color: { r: number; g: number; b: number },
    tol: number,
    feath: number,
    remMode: 'flood' | 'global'
  ) => {
    const canvas = canvasRef.current;
    if (!canvas || !originalCanvasDataRef.current) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Reset to original image data before recalculating
    ctx.putImageData(originalCanvasDataRef.current, 0, 0);

    const params: ColorKeyParams = {
      targetR: color.r,
      targetG: color.g,
      targetB: color.b,
      tolerance: tol,
      feather: feath,
      mode: remMode,
    };

    const processedData = removeBackgroundOnCanvas(ctx, canvas.width, canvas.height, params);
    ctx.putImageData(processedData, 0, 0);
  };

  // Re-run removal on parameter change
  const handleToleranceChange = (newVal: number) => {
    setTolerance(newVal);
    applyRemoval(pickedColor, newVal, feather, mode);
  };

  const handleFeatherChange = (newVal: number) => {
    setFeather(newVal);
    applyRemoval(pickedColor, tolerance, newVal, mode);
  };

  const handleModeChange = (newMode: 'flood' | 'global') => {
    setMode(newMode);
    applyRemoval(pickedColor, tolerance, feather, newMode);
  };

  // Canvas click to sample color or erase
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !originalCanvasDataRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    if (activeTool === 'picker' || activeTool === 'auto') {
      // Pick color from the original image at (x, y)
      const origData = originalCanvasDataRef.current.data;
      const idx = (y * canvas.width + x) * 4;
      const r = origData[idx];
      const g = origData[idx + 1];
      const b = origData[idx + 2];

      const newColor = { r, g, b };
      setPickedColor(newColor);
      applyRemoval(newColor, tolerance, feather, mode);
      setStatusMessage(`Color seleccionado (${r}, ${g}, ${b}). Fondo actualizado.`);
    }
  };

  // Manual eraser drawing
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'eraser') {
      setIsDrawing(true);
      eraseAt(e);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDrawing && activeTool === 'eraser') {
      eraseAt(e);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const eraseAt = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Reset to original
  const handleReset = () => {
    const canvas = canvasRef.current;
    if (!canvas || !originalCanvasDataRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(originalCanvasDataRef.current, 0, 0);
    setStatusMessage('Imagen restaurada a su estado original.');
  };

  // Save Cutout
  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSaveCutout(dataUrl);
    onClose();
  };

  // Download Cutout as PNG
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'producto-sin-fondo.png';
    a.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-neutral-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-black font-bold shadow-lg">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Eliminador de Fondo Inteligente
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Instantáneo
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Aisla tu producto para que flote limpiamente sobre la plantilla de la televisión.
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

        {/* Content Body: Canvas + Tools Panel */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Main Canvas Workspace */}
          <div className="flex-1 p-6 flex flex-col items-center justify-center bg-neutral-950 relative overflow-auto">
            {/* Preview background container */}
            <div
              className={`relative max-w-full max-h-[500px] rounded-xl overflow-hidden shadow-2xl border border-neutral-800 flex items-center justify-center ${
                previewBg === 'checker' ? 'bg-checkerboard' : ''
              }`}
              style={{
                background:
                  previewBg === 'template'
                    ? templateGradient || 'radial-gradient(circle, #2e1a0f, #0d0602)'
                    : previewBg === 'black'
                    ? '#000000'
                    : previewBg === 'white'
                    ? '#ffffff'
                    : undefined,
              }}
            >
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className={`max-w-full max-h-[480px] object-contain cursor-${
                  activeTool === 'eraser' ? 'crosshair' : activeTool === 'picker' ? 'crosshair' : 'pointer'
                }`}
              />

              {loading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-amber-400">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-400 border-t-transparent"></div>
                </div>
              )}
            </div>

            {/* Status & instruction bar */}
            <div className="mt-3 flex items-center space-x-2 text-xs text-neutral-400 bg-neutral-900/90 px-4 py-1.5 rounded-full border border-neutral-800">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span>{statusMessage}</span>
            </div>
          </div>

          {/* Right Tools Sidebar */}
          <div className="w-full lg:w-80 p-5 bg-neutral-900/90 border-t lg:border-t-0 lg:border-l border-neutral-800 flex flex-col justify-between space-y-5 overflow-y-auto">
            <div className="space-y-5">
              {/* Tool Selection */}
              <div>
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 block">
                  Herramienta de Selección
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setActiveTool('auto');
                      initializeCanvas();
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-medium flex flex-col items-center justify-center space-y-1 transition border ${
                      activeTool === 'auto'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    <Wand2 className="w-4 h-4" />
                    <span>Auto Detect</span>
                  </button>

                  <button
                    onClick={() => setActiveTool('picker')}
                    className={`px-3 py-2 rounded-xl text-xs font-medium flex flex-col items-center justify-center space-y-1 transition border ${
                      activeTool === 'picker'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    <Pipette className="w-4 h-4" />
                    <span>Gotero Color</span>
                  </button>

                  <button
                    onClick={() => setActiveTool('eraser')}
                    className={`px-3 py-2 rounded-xl text-xs font-medium flex flex-col items-center justify-center space-y-1 transition border ${
                      activeTool === 'eraser'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    <Eraser className="w-4 h-4" />
                    <span>Borrador</span>
                  </button>
                </div>
              </div>

              {/* Color target & Mode */}
              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Color a eliminar:</span>
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-5 h-5 rounded-md border border-neutral-700 shadow"
                      style={{
                        backgroundColor: `rgb(${pickedColor.r}, ${pickedColor.g}, ${pickedColor.b})`,
                      }}
                    />
                    <span className="font-mono text-neutral-300">
                      RGB({pickedColor.r},{pickedColor.g},{pickedColor.b})
                    </span>
                  </div>
                </div>

                {/* Mode toggle */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-800">
                  <span className="text-neutral-400">Modo de recorte:</span>
                  <div className="flex rounded-lg overflow-hidden border border-neutral-700 bg-neutral-800 p-0.5 text-[11px]">
                    <button
                      onClick={() => handleModeChange('flood')}
                      className={`px-2 py-0.5 rounded ${
                        mode === 'flood' ? 'bg-amber-500 text-black font-bold' : 'text-neutral-400'
                      }`}
                      title="Elimina desde los bordes sin dañar colores similares en el centro del producto"
                    >
                      Bordes
                    </button>
                    <button
                      onClick={() => handleModeChange('global')}
                      className={`px-2 py-0.5 rounded ${
                        mode === 'global' ? 'bg-amber-500 text-black font-bold' : 'text-neutral-400'
                      }`}
                      title="Elimina el color en cualquier parte de la imagen"
                    >
                      Global
                    </button>
                  </div>
                </div>
              </div>

              {/* Sliders */}
              <div className="space-y-3">
                {/* Tolerance */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-300 font-medium">Sensibilidad / Tolerancia</span>
                    <span className="font-mono text-amber-400 font-semibold">{tolerance}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="85"
                    value={tolerance}
                    onChange={(e) => handleToleranceChange(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-500">
                    <span>Estricto (menos recorte)</span>
                    <span>Agresivo (más recorte)</span>
                  </div>
                </div>

                {/* Edge Feathering */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-300 font-medium">Suavizado de Bordes</span>
                    <span className="font-mono text-amber-400 font-semibold">{feather}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    value={feather}
                    onChange={(e) => handleFeatherChange(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <span className="text-[10px] text-neutral-500">
                    Evita que los bordes del producto queden pixelados o ásperos.
                  </span>
                </div>

                {/* Eraser Brush Size */}
                {activeTool === 'eraser' && (
                  <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-neutral-300 font-medium">Tamaño del Borrador</span>
                      <span className="font-mono text-amber-400 font-semibold">{brushSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="60"
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* Background preview switcher */}
              <div>
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 block">
                  Vista Previa con Fondo
                </label>
                <div className="grid grid-cols-4 gap-1.5 text-xs">
                  <button
                    onClick={() => setPreviewBg('checker')}
                    className={`py-1.5 px-2 rounded-lg border text-center font-medium ${
                      previewBg === 'checker'
                        ? 'bg-neutral-700 border-amber-500 text-white'
                        : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                    }`}
                  >
                    Patrón
                  </button>
                  <button
                    onClick={() => setPreviewBg('template')}
                    className={`py-1.5 px-2 rounded-lg border text-center font-medium ${
                      previewBg === 'template'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                    }`}
                  >
                    TV
                  </button>
                  <button
                    onClick={() => setPreviewBg('black')}
                    className={`py-1.5 px-2 rounded-lg border text-center font-medium ${
                      previewBg === 'black'
                        ? 'bg-neutral-700 border-amber-500 text-white'
                        : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                    }`}
                  >
                    Negro
                  </button>
                  <button
                    onClick={() => setPreviewBg('white')}
                    className={`py-1.5 px-2 rounded-lg border text-center font-medium ${
                      previewBg === 'white'
                        ? 'bg-neutral-700 border-amber-500 text-white'
                        : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                    }`}
                  >
                    Blanco
                  </button>
                </div>
              </div>
            </div>

            {/* Actions Buttons */}
            <div className="pt-4 border-t border-neutral-800 space-y-2">
              <button
                onClick={handleSave}
                className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold rounded-xl shadow-lg flex items-center justify-center space-x-2 transition"
              >
                <Check className="w-5 h-5" />
                <span>Aplicar Recorte a la Diapositiva</span>
              </button>

              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="flex-1 py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300 rounded-xl transition flex items-center justify-center space-x-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar Original</span>
                </button>

                <button
                  onClick={handleDownload}
                  className="py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300 rounded-xl transition flex items-center justify-center space-x-1"
                  title="Descargar PNG con fondo transparente"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
