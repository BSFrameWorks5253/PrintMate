import React from 'react';
import { 
  Crop, 
  Printer, 
  CreditCard, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck 
} from 'lucide-react';

interface HomePageProps {
  onNavigate: (tab: 'scanner' | 'print' | 'passport' | 'admin') => void;
  onOpenSample: (type: 'id_front' | 'id_back' | 'paper') => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, onOpenSample }) => {

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-900">
      
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 border-b border-slate-200/80">
        {/* Subtle Decorative Ambient Background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-cyan-500/10 blur-3xl -z-10 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            
            {/* Version / Release Pill */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-bold tracking-wide shadow-xs animate-in fade-in">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span>Studio Pro v2.5 • AI Auto-Crop & Millimeter True-Scale Print Engine</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-950 tracking-tight leading-tight md:leading-[1.15]">
              Turn Any Document or Photo into{' '}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Perfect Print-Ready Sheets
              </span>
            </h1>

            {/* Sub-headline */}
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Automatic edge detection, 4-corner perspective deskewing, ISO/ICAO passport photo grids, and millimeter-accurate ID card layouts—engineered directly for high-precision printing.
            </p>

            {/* Primary Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => onNavigate('scanner')}
                className="px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm sm:text-base shadow-xl shadow-blue-600/30 hover:shadow-blue-600/40 flex items-center gap-2.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                <Crop className="w-5 h-5" />
                <span>Scan & Straighten Document</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('passport')}
                className="px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm sm:text-base border border-slate-300/80 shadow-md hover:shadow-lg flex items-center gap-2.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                <CreditCard className="w-5 h-5 text-indigo-600" />
                <span>Passport Photo Maker</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('print')}
                className="px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm sm:text-base shadow-lg shadow-slate-900/20 flex items-center gap-2.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                <Printer className="w-5 h-5 text-cyan-400" />
                <span>Multi-Card Print Studio</span>
              </button>
            </div>

            {/* Quick Demo Samples Helper */}
            <div className="pt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>No image ready? Try 1-click samples:</span>
              <button
                onClick={() => onOpenSample('id_front')}
                className="text-blue-600 font-semibold hover:underline cursor-pointer"
              >
                Slanted ID Card
              </button>
              <span>•</span>
              <button
                onClick={() => onOpenSample('paper')}
                className="text-blue-600 font-semibold hover:underline cursor-pointer"
              >
                A4 Certificate
              </button>
            </div>
          </div>

          {/* Hero Feature Visual Preview Banner */}
          <div className="mt-14 max-w-5xl mx-auto rounded-3xl bg-slate-900 p-3 sm:p-5 shadow-2xl border border-slate-800 ring-1 ring-white/10">
            <div className="bg-slate-950 rounded-2xl p-6 sm:p-8 text-white">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-800/90">
                
                {/* Visual Step 1 */}
                <div className="flex flex-col items-center text-center p-2">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 text-blue-400 flex items-center justify-center mb-3">
                    <Crop className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-base text-white">1. Snap / Upload Slanted Photo</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    AI automatically locks onto 4 document corners, unwarps perspective angle, and applies studio contrast filters.
                  </p>
                </div>

                {/* Visual Step 2 */}
                <div className="flex flex-col items-center text-center p-2 md:pl-6">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-400 flex items-center justify-center mb-3">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-base text-white">2. Standardize & Layout</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Lock to official CR80 ID dimensions (85.6 × 54mm) or ICAO 35×45mm passport grids with custom border gaps.
                  </p>
                </div>

                {/* Visual Step 3 */}
                <div className="flex flex-col items-center text-center p-2 md:pl-6">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 flex items-center justify-center mb-3">
                    <Printer className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-base text-white">3. 1:1 Millimeter True-Scale Print</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Print directly on A4, Letter, or 4×6 photo paper with physical true scale without printer scaling distortion.
                  </p>
                </div>

              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 3 Core Studio Suites */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-extrabold text-blue-600 uppercase tracking-widest">
            Complete Suite
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Engineered for Photographers, Cyber Cafes & Everyday Users
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            Three dedicated, powerhouse modules built into a unified browser workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Card 1: Scanner */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-lg hover:shadow-xl hover:border-blue-300 transition-all flex flex-col justify-between group">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <Crop className="w-7 h-7" />
              </div>
              <div className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 mb-3">
                PERSPECTIVE DESKEW
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 mb-2">
                Document Scanner & Straightener
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                Turn photos of ID cards taken on desks, slanted angles, or poor lighting into clean, flat, rectangular scans with interactive corner handles, loupe zoom, and contrast enhancement.
              </p>
              
              <ul className="space-y-2.5 text-xs text-slate-700 mb-6">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>AI 4-corner auto border detection</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Interactive high-precision loupe magnifier</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Clean B&W, ID Pop, and Grayscale filters</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => onNavigate('scanner')}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              <span>Open Scanner Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 2: Passport Maker */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-lg hover:shadow-xl hover:border-indigo-300 transition-all flex flex-col justify-between group">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <CreditCard className="w-7 h-7" />
              </div>
              <div className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 mb-3">
                ICAO / ISO SPEC
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 mb-2">
                Passport & Visa Photo Maker
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                Create official compliant passport photos for Indian, US Visa (2×2"), UK, Schengen, and Canadian passports. Instantly arrange 6, 8, 12, or 16 photos onto a 4×6 photo sheet with zero wasted paper.
              </p>
              
              <ul className="space-y-2.5 text-xs text-slate-700 mb-6">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Presets for India, US Visa, UK, Schengen & Canada</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Zero-margin 4×6 photo studio paper layout</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Cutting guidelines and customizable photo borders</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => onNavigate('passport')}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <span>Open Passport Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 3: Print Studio */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-lg hover:shadow-xl hover:border-slate-400 transition-all flex flex-col justify-between group">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-800 border border-slate-200 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <Printer className="w-7 h-7 text-cyan-600" />
              </div>
              <div className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 mb-3">
                CR80 MILLIMETER ACCURATE
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 mb-2">
                Multi-Card Print Studio
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                Arrange Aadhaar, PAN, and Voter ID cards (Front and Back) on A4 sheets with exact 85.6 × 53.98mm physical scale. What you see on screen is pixel-for-pixel what prints out from your printer.
              </p>
              
              <ul className="space-y-2.5 text-xs text-slate-700 mb-6">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Physical scale lock (no auto-scaling errors)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Supports A4, A3, Letter, and 4×6 photo media</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Download print-ready 300 DPI high-res sheets</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => onNavigate('print')}
              className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-slate-900/20 transition-all cursor-pointer"
            >
              <span>Open Print Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </section>

      {/* Supported Document Standards Matrix */}
      <section className="py-16 bg-slate-100/70 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-10 space-y-2">
            <h3 className="text-2xl font-black text-slate-900">
              Supported Document Formats & Standards
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">
              Pre-configured aspect ratios and millimetric dimensions ready for 1-click execution.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 text-center">
            {[
              { name: 'Aadhaar Card', size: '85.6 × 54 mm', type: 'CR80 ID' },
              { name: 'PAN / Tax ID', size: '85.6 × 54 mm', type: 'CR80 ID' },
              { name: 'Driving License', size: '85.6 × 54 mm', type: 'Smart Card' },
              { name: 'India Passport Photo', size: '35 × 45 mm', type: 'ICAO Standard' },
              { name: 'US Visa / Green Card', size: '2 × 2 Inches', type: '51 × 51 mm' },
              { name: 'A4 Certificate', size: '210 × 297 mm', type: 'Full Sheet' },
            ].map((std, i) => (
              <div 
                key={i} 
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-400 transition-all"
              >
                <div className="text-xs font-extrabold text-slate-900">{std.name}</div>
                <div className="text-[11px] font-mono text-blue-600 mt-1 font-semibold">{std.size}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{std.type}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & Privacy Guarantee */}
      <section className="py-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-950 rounded-3xl p-8 sm:p-12 text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-blue-300" />
              <span>100% Private Client-Side Processing</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black">
              Your Sensitive Documents Never Leave Your Device
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              All perspective correction, edge snapping, canvas adjustments, and high-DPI sheet generation happen locally in your web browser. Nothing is ever sent to third-party image processing servers.
            </p>
            
            <div className="pt-2 flex items-center gap-4 text-xs font-semibold text-slate-200">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> GDPR & Privacy Compliant
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Zero Cloud Upload of ID Scans
              </span>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};
