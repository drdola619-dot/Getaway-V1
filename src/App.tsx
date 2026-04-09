/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Upload, 
  Compass, 
  Zap, 
  Download, 
  Share2, 
  History, 
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Maximize2,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface HistoryItem {
  id: string;
  url: string;
  prompt: string;
  angle: number;
  timestamp: number;
}

const PRESETS = {
  diorama: "Transform this aerial photograph into a high-quality physical miniature architectural diorama model. Maintain the exact layout of the roads, buildings, and land shape. Change textures: the grass must look like bright green synthetic flocking/sponge, trees like small round plastic model trees, roads like smooth matte grey plastic. Buildings should look like clean architectural models made of acrylic and balsa wood. Studio lighting, soft drop shadows, tilt-shift photography effect, shallow depth of field, hyper-realistic physical model on a table.",
  render3d: "Convert this image into a professional 3D architectural visualization render. Use Unreal Engine 5 style lighting, ray-tracing, global illumination. Realistic materials, high-quality textures, cinematic atmosphere. Sharp details, clean lines, modern architectural aesthetic.",
  parkLao: "Redesign this area into a beautiful public park in Laos. Incorporate traditional Lao architectural elements like multi-tiered roofs (Sim style), wooden pavilions, and lotus ponds. Lush tropical greenery, frangipani trees, and decorative stone paths. Soft morning sunlight, peaceful atmosphere.",
  aerial: "Enhance this aerial photograph into a crystal clear, high-resolution satellite-style image. Improve contrast, sharpen details of buildings and roads, correct colors to be vibrant and realistic. Professional drone photography style."
};

const ANGLES = [
  { label: 'ด้านหน้า', value: 0 },
  { label: 'ด้านขวา', value: 90 },
  { label: 'ด้านหลัง', value: 180 },
  { label: 'ด้านซ้าย', value: 270 },
  { label: 'เฉียงขวา', value: 45 },
  { label: 'เฉียงหลังขวา', value: 135 },
  { label: 'เฉียงหลังซ้าย', value: 225 },
  { label: 'เฉียงซ้าย', value: 315 },
];

const RESOLUTIONS = [
  { label: 'HD', value: '1024px', px: 1024 },
  { label: 'Full HD', value: '1K', px: 1920 }, // Using '1K' as default for Gemini
  { label: '2K', value: '2K', px: 2048 },
];

export default function App() {
  // --- State ---
  const [sourceImage, setSourceImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [angle, setAngle] = useState(0);
  const [prompt, setPrompt] = useState(PRESETS.diorama);
  const [resolution, setResolution] = useState('1K');
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Gemini Initialization ---
  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }), []);

  // --- Handlers ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const [header, data] = base64.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
      setSourceImage({ data, mimeType });
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const generateImage = async () => {
    if (!sourceImage) {
      setError("กรุณาอัปโหลดภาพต้นฉบับก่อน");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Construct the final prompt with angle info
      const angleText = `View the scene from a ${angle} degree camera angle relative to the front.`;
      const finalPrompt = `${prompt}\n\n${angleText}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: {
          parts: [
            {
              inlineData: {
                data: sourceImage.data,
                mimeType: sourceImage.mimeType,
              },
            },
            {
              text: finalPrompt,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: resolution as any,
          },
        },
      });

      let generatedBase64 = '';
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          generatedBase64 = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (generatedBase64) {
        setResultImage(generatedBase64);
        const newItem: HistoryItem = {
          id: Date.now().toString(),
          url: generatedBase64,
          prompt: finalPrompt,
          angle: angle,
          timestamp: Date.now(),
        };
        setHistory(prev => [newItem, ...prev].slice(0, 10));
        showToast("สร้างภาพสำเร็จ!");
      } else {
        throw new Error("ไม่สามารถสร้างภาพได้ กรุณาลองใหม่อีกครั้ง");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI");
    } finally {
      setIsGenerating(false);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const downloadImage = () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = `diorama-${Date.now()}.png`;
    link.click();
  };

  // --- Render Helpers ---
  const getAngleLabel = (val: number) => {
    const found = ANGLES.find(a => a.value === val);
    return found ? found.label : `${val}°`;
  };

  return (
    <div className="relative z-10 max-w-[1400px] mx-auto p-5 pb-15">
      {/* Header */}
      <header className="flex items-center gap-4 mb-2">
        <div className="w-12 h-12 bg-linear-to-br from-accent to-[#7950f2] rounded-custom flex items-center justify-center text-2xl shrink-0 shadow-[0_4px_20px_var(--color-accent-glow)]">
          🏗️
        </div>
        <div>
          <h1 className="font-sora text-2xl font-bold tracking-tight">Diorama Generator Pro</h1>
          <p className="text-xs text-text2 mt-0.5">สร้างภาพจำลองสถาปัตยกรรม 3D แบบหลายมุมมอง พร้อม Export Full HD</p>
        </div>
      </header>

      {/* Steps indicator */}
      <div className="flex gap-1 my-5 mb-6">
        <div className={`flex-1 h-[3px] rounded-sm transition-colors duration-400 ${sourceImage ? 'bg-green' : 'bg-accent'}`}></div>
        <div className={`flex-1 h-[3px] rounded-sm transition-colors duration-400 ${isGenerating ? 'bg-accent' : (resultImage ? 'bg-green' : 'bg-border')}`}></div>
        <div className={`flex-1 h-[3px] rounded-sm transition-colors duration-400 ${resultImage ? 'bg-green' : 'bg-border'}`}></div>
        <div className={`flex-1 h-[3px] rounded-sm transition-colors duration-400 ${history.length > 0 ? 'bg-green' : 'bg-border'}`}></div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* LEFT: Controls */}
        <div className="flex flex-col gap-4">
          
          {/* Panel 1: Upload */}
          <section className="bg-surface border border-border rounded-custom overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2.5 text-sm font-semibold">
              <span className="w-6 h-6 rounded-md bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
              อัปโหลดภาพต้นฉบับ
            </div>
            <div className="p-5">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed border-border rounded-xl transition-all duration-300 cursor-pointer overflow-hidden group
                  ${sourceImage ? 'p-0 border-solid' : 'py-8 px-5 text-center hover:border-accent hover:bg-accent/5'}`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/jpeg,image/png,image/webp"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                {!sourceImage ? (
                  <div className="text-text2 text-sm">
                    <Upload className="block mx-auto mb-2.5 opacity-40 w-10 h-10" />
                    คลิกหรือลากไฟล์มาวาง<br />
                    <span className="text-[11px] opacity-60">JPEG, PNG, WebP — แนะนำ 1920×1080 ขึ้นไป</span>
                  </div>
                ) : (
                  <img 
                    src={`data:${sourceImage.mimeType};base64,${sourceImage.data}`} 
                    alt="Preview" 
                    className="w-full h-[220px] object-cover block"
                  />
                )}
              </div>

              {sourceImage && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4"
                >
                  <div className="text-xs text-text2 mb-2.5 font-medium">มุมมองกล้อง (Camera Angle)</div>
                  <div className="flex items-center gap-5">
                    <div className="w-[120px] h-[120px] rounded-full bg-surface2 border-2 border-border relative shrink-0">
                      <motion.div 
                        animate={{ rotate: angle }}
                        transition={{ type: "spring", stiffness: 100, damping: 15 }}
                        className="absolute top-1/2 left-1/2 w-1 h-11 bg-linear-to-t from-accent to-[#7950f2] rounded-sm origin-bottom -translate-x-1/2 -translate-y-full shadow-[0_0_10px_var(--color-accent-glow)]"
                      />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-accent border-2 border-bg z-10" />
                      <span className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-red">N</span>
                      <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-text3">S</span>
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-text3">E</span>
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-text3">W</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 flex-1">
                      {ANGLES.map((a) => (
                        <button
                          key={a.value}
                          onClick={() => setAngle(a.value)}
                          className={`bg-surface2 border rounded-lg py-2.5 px-2 text-[11px] font-medium cursor-pointer transition-all duration-200 text-center
                            ${angle === a.value ? 'bg-accent/12 border-accent text-accent font-semibold' : 'border-border text-text2 hover:border-accent hover:text-text'}`}
                        >
                          <span className="font-mono text-sm font-bold block mb-0.5">{a.value}°</span>
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2.5">
                    <label className="text-[11px] text-text3 whitespace-nowrap">ปรับอิสระ:</label>
                    <input 
                      type="range" 
                      min="0" max="359" 
                      value={angle} 
                      onChange={(e) => setAngle(parseInt(e.target.value))}
                      className="flex-1 h-1 rounded-sm bg-border outline-none appearance-none cursor-pointer accent-accent"
                    />
                    <span className="font-mono text-sm font-semibold text-accent min-w-[40px] text-right">{angle}°</span>
                  </div>
                </motion.div>
              )}
            </div>
          </section>

          {/* Panel 2: Prompt */}
          <section className="bg-surface border border-border rounded-custom overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2.5 text-sm font-semibold">
              <span className="w-6 h-6 rounded-md bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
              Prompt & ตั้งค่า
            </div>
            <div className="p-5">
              <div className="text-xs text-text2 mb-2.5 font-medium">เทมเพลต Prompt สำเร็จรูป</div>
              <div className="flex gap-1.5 flex-wrap mb-3">
                {Object.entries(PRESETS).map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => setPrompt(value)}
                    className="bg-surface2 border border-border rounded-md py-1.5 px-3 text-text2 text-[11px] cursor-pointer transition-all duration-200 hover:border-accent hover:text-text"
                  >
                    {key === 'diorama' && '🏗️ Diorama Model'}
                    {key === 'render3d' && '🏙️ 3D Render'}
                    {key === 'parkLao' && '🇱🇦 สวนสาธารณะลาว'}
                    {key === 'aerial' && '🛩️ Aerial Photo'}
                  </button>
                ))}
              </div>

              <div className="relative">
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full min-h-[180px] bg-surface2 border border-border rounded-lg p-3.5 text-text text-xs font-mono leading-relaxed resize-y outline-none transition-colors duration-200 focus:border-accent"
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[10px] py-1 px-2 rounded bg-accent/10 text-accent font-semibold">
                    🎯 Auto: {getAngleLabel(angle)} View ({angle}°)
                  </span>
                  <span className="text-[11px] text-text3 font-mono">{prompt.length} chars</span>
                </div>
              </div>

              {/* Resolution */}
              <div className="mt-4">
                <div className="text-xs text-text2 mb-2 font-medium">ความละเอียดภาพ (Output Resolution)</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {RESOLUTIONS.map((res) => (
                    <button
                      key={res.value}
                      onClick={() => setResolution(res.value)}
                      className={`bg-surface2 border rounded-lg py-2.5 px-2 text-center cursor-pointer transition-all duration-200
                        ${resolution === res.value ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text2 hover:border-accent'}`}
                    >
                      <span className="text-xs font-semibold block">{res.label}</span>
                      <span className="text-[10px] font-mono opacity-70 mt-0.5">{res.px}px</span>
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={generateImage}
                disabled={isGenerating || !sourceImage}
                className="w-full p-4 border-none rounded-xl font-bold text-base cursor-pointer transition-all duration-300 flex items-center justify-center gap-2.5 mt-5 relative overflow-hidden bg-linear-to-br from-accent to-[#7950f2] text-white shadow-[0_4px_24px_var(--color-accent-glow)] hover:shadow-[0_6px_32px_rgba(76,110,245,0.4)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                    กำลังประมวลผล...
                  </>
                ) : (
                  <>
                    <Zap className="w-4.5 h-4.5 fill-current" />
                    สร้างภาพ (Generate)
                  </>
                )}
              </button>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 p-3 bg-red/8 border border-red/20 rounded-lg text-red text-xs flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </motion.div>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT: Result */}
        <div className="flex flex-col gap-4">
          <section className="bg-surface border border-border rounded-custom overflow-hidden relative min-h-[500px] flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2.5 text-sm font-semibold">
              <span className="w-6 h-6 rounded-md bg-green text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
              ผลลัพธ์
              {resultImage && (
                <span className="ml-auto text-[11px] text-text3 font-mono">
                  {getAngleLabel(angle)} ({angle}°)
                </span>
              )}
            </div>

            <div className="bg-surface2 flex-1 flex items-center justify-center relative overflow-hidden">
              <AnimatePresence mode="wait">
                {isGenerating ? (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-bg/85 backdrop-blur-sm z-10 flex flex-col items-center justify-center"
                  >
                    <div className="w-9 h-9 border-3 border-border border-t-accent rounded-full animate-spin-custom" />
                    <div className="mt-3.5 text-sm text-accent font-medium">กำลังสร้างโมเดลจำลอง...</div>
                    <div className="text-[11px] text-text3 mt-1">AI กำลังวิเคราะห์มุมมองและพื้นผิว</div>
                  </motion.div>
                ) : resultImage ? (
                  <motion.img 
                    key="result"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    src={resultImage} 
                    alt="Result" 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center p-15 text-text3">
                    <ImageIcon className="mx-auto mb-3 opacity-20 w-12 h-12" />
                    <p className="text-sm">อัปโหลดภาพและกดปุ่ม Generate เพื่อดูผลลัพธ์</p>
                  </div>
                )}
              </AnimatePresence>
            </div>

            {resultImage && (
              <div className="p-3.5 px-5 border-t border-border flex gap-2">
                <button 
                  onClick={downloadImage}
                  className="flex-1 py-3 border border-border rounded-lg bg-surface2 text-text text-xs font-semibold cursor-pointer transition-all duration-200 hover:border-accent flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  ดาวน์โหลด
                </button>
                <button 
                  onClick={() => showToast("คัดลอกลิงก์แล้ว (จำลอง)")}
                  className="flex-1 py-3 border border-green rounded-lg bg-green/10 text-green text-xs font-semibold cursor-pointer transition-all duration-200 hover:bg-green/20 flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-4 h-4" />
                  แชร์ผลงาน
                </button>
              </div>
            )}

            {history.length > 0 && (
              <div className="p-3.5 px-5 border-t border-border overflow-x-auto flex gap-2 bg-bg/30">
                {history.map((item) => (
                  <img 
                    key={item.id}
                    src={item.url}
                    onClick={() => setResultImage(item.url)}
                    className={`w-16 h-16 rounded-lg object-cover border-2 cursor-pointer transition-all duration-200 shrink-0
                      ${resultImage === item.url ? 'border-accent shadow-[0_0_10px_var(--color-accent-glow)]' : 'border-border hover:border-accent'}`}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Tips Panel */}
          <section className="bg-surface2/50 border border-border rounded-custom p-4">
            <h3 className="text-xs font-bold text-text2 mb-2 flex items-center gap-1.5">
              <Maximize2 className="w-3.5 h-3.5" />
              เคล็ดลับการใช้งาน
            </h3>
            <ul className="text-[11px] text-text3 space-y-1.5 list-disc pl-4">
              <li>ใช้ภาพถ่ายจากโดรนหรือมุมสูง (Top-down) จะได้ผลลัพธ์ที่ดีที่สุด</li>
              <li>ปรับ Camera Angle เพื่อดูอาคารจากมุมต่างๆ</li>
              <li>ลองใช้ Prompt "Physical model on a table" เพื่อเพิ่มความสมจริงของ Diorama</li>
              <li>ความละเอียด 2K อาจใช้เวลาประมวลผลนานกว่าปกติเล็กน้อย</li>
            </ul>
          </section>
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 right-6 bg-surface border border-border rounded-lg py-3 px-5 text-sm text-text shadow-[0_8px_30px_rgba(0,0,0,0.4)] z-100 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-green" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
