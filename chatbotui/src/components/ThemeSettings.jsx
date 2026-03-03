import React from 'react';
import { Palette, X, RotateCcw } from 'lucide-react';

const PRESETS = [
  { name: 'Cyan', hue: 190, color: '#00d2ff' },
  { name: 'Emerald', hue: 160, color: '#10b981' },
  { name: 'Purple', hue: 270, color: '#7c3aed' },
  { name: 'Rose', hue: 350, color: '#f43f5e' },
  { name: 'Amber', hue: 45, color: '#f59e0b' },
  { name: 'Gold', hue: 55, color: '#fbbf24' },
];

const ThemeSettings = ({ currentHue, onHueChange, onClose }) => {
  return (
    <div className="flex flex-col gap-4 p-4 animate-scale-in">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-bold text-white">Visual Theme</h3>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition">
          <X className="w-5 h-5 text-zinc-400" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3 block">
            Color Presets
          </label>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => onHueChange(p.hue)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                  Math.abs(currentHue - p.hue) < 5
                    ? 'bg-white/10 border-white/20 text-white shadow-lg'
                    : 'bg-black/20 border-white/5 text-zinc-400 hover:border-white/10'
                }`}
              >
                <div 
                  className="w-3 h-3 rounded-full shadow-[0_0_8px_var(--preset-color)]" 
                  style={{ backgroundColor: p.color, '--preset-color': p.color }}
                />
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block">
              Custom Hue
            </label>
            <span className="text-[10px] font-mono text-cyan-400">{currentHue}°</span>
          </div>
          <div className="relative group">
            <input
              type="range"
              min="0"
              max="360"
              value={currentHue}
              onChange={(e) => onHueChange(parseInt(e.target.value))}
              className="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              style={{
                background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
              }}
            />
          </div>
        </div>

        {currentHue !== 190 && (
          <button 
            onClick={() => onHueChange(190)}
            className="w-full py-2 flex items-center justify-center gap-2 text-xs font-bold text-zinc-500 hover:text-white transition"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to Default
          </button>
        )}
      </div>
    </div>
  );
};

export default ThemeSettings;
