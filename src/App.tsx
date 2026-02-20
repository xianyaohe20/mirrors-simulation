import React, { useState, useEffect, useRef } from 'react';
import { type MirrorType, calculateImage, calculateObjectDistance } from './physics';
import { RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  const [mirrorType, setMirrorType] = useState<MirrorType>('CONCAVE');
  const [focalLength, setFocalLength] = useState(100);
  const [objectDistance, setObjectDistance] = useState(200);
  const [objectHeight, setObjectHeight] = useState(50);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const image = calculateImage({ mirrorType, focalLength, objectDistance, objectHeight });

  const handleImageDistanceChange = (di: number) => {
    if (mirrorType === 'PLANE') {
      setObjectDistance(Math.abs(di));
      return;
    }
    const newDo = calculateObjectDistance(di, focalLength);
    if (newDo > 0 && newDo < 1000) {
      setObjectDistance(newDo);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2 - 100;
    const centerY = canvas.height / 2;

    // Optical Axis
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#94a3b8';
    ctx.moveTo(0, centerY);
    ctx.lineTo(canvas.width, centerY);
    ctx.stroke();
    ctx.setLineDash([]);

    const R = 2 * focalLength;
    const absR = Math.abs(R);
    const Cx = centerX - R;
    const Cy = centerY;

    // Helper: Line-Circle Intersection
    const getIntersection = (x1: number, y1: number, x2: number, y2: number) => {
      if (mirrorType === 'PLANE') return { x: centerX, y: y1 + (centerX - x1) * (y2 - y1) / (x2 - x1) };
      
      const dx = x2 - x1;
      const dy = y2 - y1;
      const A = dx * dx + dy * dy;
      const B = 2 * (dx * (x1 - Cx) + dy * (y1 - Cy));
      const C = (x1 - Cx) * (x1 - Cx) + (y1 - Cy) * (y1 - Cy) - absR * absR;
      
      const det = B * B - 4 * A * C;
      if (det < 0) return { x: centerX, y: centerY }; // Fallback

      const t1 = (-B + Math.sqrt(det)) / (2 * A);
      const t2 = (-B - Math.sqrt(det)) / (2 * A);
      
      // We want the intersection point closest to centerX
      const p1 = { x: x1 + t1 * dx, y: y1 + t1 * dy };
      const p2 = { x: x1 + t2 * dx, y: y1 + t2 * dy };
      
      return Math.abs(p1.x - centerX) < Math.abs(p2.x - centerX) ? p1 : p2;
    };

    // Draw Mirror
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    if (mirrorType === 'PLANE') {
      ctx.moveTo(centerX, centerY - 150);
      ctx.lineTo(centerX, centerY + 150);
    } else {
      const angle = Math.asin(Math.min(1, 150 / absR));
      const startAngle = mirrorType === 'CONCAVE' ? -angle : Math.PI - angle;
      const endAngle = mirrorType === 'CONCAVE' ? angle : Math.PI + angle;
      ctx.arc(Cx, Cy, absR, startAngle, endAngle);
    }
    ctx.stroke();

    if (mirrorType !== 'PLANE') {
      const fX = centerX - focalLength;
      const cX = centerX - 2 * focalLength;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(fX, centerY, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillText('F', fX - 5, centerY + 20);
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath(); ctx.arc(cX, centerY, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillText('C', cX - 5, centerY + 20);
    }

    const objX = centerX - objectDistance;
    const objY = centerY - objectHeight;
    drawArrow(ctx, objX, centerY, objX, objY, '#10b981', 'Object');

    const imgTipX = centerX - image.imageDistance;
    let imgTipY = centerY - image.imageHeight;

    // For non-plane mirrors, use the Ray Through F to determine exact image tip Y for visual consistency
    if (mirrorType !== 'PLANE') {
      const fX = centerX - focalLength;
      const m2 = getIntersection(objX, objY, fX, centerY);
      imgTipY = m2.y;
    }

    if (Math.abs(image.imageDistance) < 2000) {
      const imgX = centerX - image.imageDistance;
      const color = image.isReal ? '#f59e0b' : '#f59e0b99';
      ctx.setLineDash(image.isReal ? [] : [5, 5]);
      drawArrow(ctx, imgX, centerY, imgX, imgTipY, color, image.isReal ? 'Real Image' : 'Virtual Image');
      ctx.setLineDash([]);
    }

    // Rays
    if (mirrorType === 'PLANE') {
      drawRay(ctx, objX, objY, centerX, objY, -500, objY, '#6366f1', true, imgTipX, objY);
      const angle = Math.atan2(objY - centerY, objX - centerX);
      drawRay(ctx, objX, objY, centerX, centerY, centerX - 500, centerY + 500 * Math.tan(-angle), '#6366f1', true, imgTipX, imgTipY);
    } else {
      // Ray 1: Parallel
      const m1 = getIntersection(objX, objY, centerX + 100, objY);
      const fPoint = { x: centerX - focalLength, y: centerY };
      let angle1 = Math.atan2(fPoint.y - m1.y, fPoint.x - m1.x);
      // For Convex, fPoint is to the right, so we must reflect away from it to go left
      if (mirrorType === 'CONVEX') {
        angle1 = Math.atan2(m1.y - fPoint.y, m1.x - fPoint.x);
      }
      const rx1 = m1.x + 1000 * Math.cos(angle1);
      const ry1 = m1.y + 1000 * Math.sin(angle1);
      drawRay(ctx, objX, objY, m1.x, m1.y, rx1, ry1, '#6366f1', !image.isReal, imgTipX, imgTipY);

      // Ray 2: Through F
      const fX = centerX - focalLength;
      const m2 = getIntersection(objX, objY, fX, centerY);
      // The reflected ray should be horizontal (y = m2.y) and to the left
      drawRay(ctx, objX, objY, m2.x, m2.y, m2.x - 1000, m2.y, '#8b5cf6', !image.isReal, imgTipX, imgTipY);

      // Ray 3: Through C
      const cX = centerX - 2 * focalLength;
      const m3 = getIntersection(objX, objY, cX, centerY);
      // Reflects back through its own path line, must go left
      const angle3 = Math.atan2(m3.y - centerY, m3.x - cX);
      const rx3 = m3.x + 1000 * Math.cos(angle3);
      const ry3 = m3.y + 1000 * Math.sin(angle3);
      // If rx3 is to the right, invert it to go left
      const finalRx3 = rx3 > m3.x ? m3.x - 1000 * Math.cos(angle3) : rx3;
      const finalRy3 = rx3 > m3.x ? m3.y - 1000 * Math.sin(angle3) : ry3;
      drawRay(ctx, objX, objY, m3.x, m3.y, finalRx3, finalRy3, '#ec4899', !image.isReal, imgTipX, imgTipY);
    }

  }, [mirrorType, focalLength, objectDistance, objectHeight, image]);

  function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, label: string) {
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 10 * Math.cos(angle - Math.PI/6), y2 - 10 * Math.sin(angle - Math.PI/6));
    ctx.lineTo(x2 - 10 * Math.cos(angle + Math.PI/6), y2 - 10 * Math.sin(angle + Math.PI/6));
    ctx.closePath(); ctx.fill();
    ctx.fillText(label, x2 - 20, y2 - 10);
  }

  function drawRay(ctx: CanvasRenderingContext2D, x1: number, y1: number, mx: number, my: number, rx: number, ry: number, color: string, showVirtual: boolean, vx: number, vy: number) {
    ctx.strokeStyle = color;
    // Incident ray
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(mx, my); ctx.stroke();
    // Reflected ray
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(rx, ry); ctx.stroke();
    if (showVirtual) {
      ctx.setLineDash([2, 4]);
      // Virtual extension behind the mirror
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(vx, vy); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-slate-800">Mirrors Simulation</h1>
          <button onClick={() => {setMirrorType('CONCAVE'); setFocalLength(100); setObjectDistance(200);}} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors">
            <RefreshCw size={18} /> Reset
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div>
              <label className="block text-sm font-semibold mb-3 text-slate-700">Mirror Type</label>
              <div className="flex flex-col gap-2">
                {(['PLANE', 'CONCAVE', 'CONVEX'] as MirrorType[]).map((type) => (
                  <button key={type} onClick={() => { setMirrorType(type); if (type === 'CONVEX' && focalLength > 0) setFocalLength(-100); if (type === 'CONCAVE' && focalLength < 0) setFocalLength(100); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mirrorType === type ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {type.charAt(0) + type.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span>Focal Length (f)</span><span className="font-mono font-bold text-blue-600">{mirrorType === 'PLANE' ? '∞' : focalLength}</span></div>
                <input type="range" min={mirrorType === 'CONVEX' ? -300 : 50} max={mirrorType === 'CONVEX' ? -50 : 300} step="1" value={focalLength} disabled={mirrorType === 'PLANE'} onChange={(e) => setFocalLength(parseInt(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:opacity-30" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span>Object Distance (sₒ)</span><span className="font-mono font-bold text-emerald-600">{objectDistance.toFixed(0)}</span></div>
                <input type="range" min="10" max="600" step="1" value={objectDistance} onChange={(e) => setObjectDistance(parseInt(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span>Image Distance (sᵢ)</span><span className="font-mono font-bold text-amber-600">{Math.abs(image.imageDistance) > 1000 ? '∞' : image.imageDistance.toFixed(0)}</span></div>
                <input type="range" min="-600" max="600" step="1" value={Math.abs(image.imageDistance) > 1000 ? 0 : image.imageDistance} onChange={(e) => handleImageDistanceChange(parseInt(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span>Object Height</span><span className="font-mono font-bold text-slate-700">{objectHeight}</span></div>
                <input type="range" min="10" max="150" step="1" value={objectHeight} onChange={(e) => setObjectHeight(parseInt(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-600" />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <div className="grid grid-cols-2 gap-4 text-[10px] uppercase tracking-wider font-bold text-slate-400">
                <div><p className="mb-1">Magnification</p><p className="text-lg text-slate-700">{image.magnification.toFixed(2)}x</p></div>
                <div><p className="mb-1">Image Type</p><p className={`text-lg ${image.isReal ? 'text-amber-600' : 'text-blue-500'}`}>{image.isReal ? 'REAL' : 'VIRTUAL'}</p></div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 flex flex-col gap-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <canvas ref={canvasRef} width={800} height={500} className="w-full h-auto rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
