import React, { useState, useEffect, useRef } from 'react';
import { 
  Crop, 
  Printer, 
  CreditCard, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck,
  FileText,
  SlidersHorizontal,
  IdCard,
  MapPin,
  Phone,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Building2,
  Award,
  Layers,
  FileCheck,
  ArrowUp
} from 'lucide-react';

interface HomePageProps {
  onNavigate: (tab: 'scanner' | 'print' | 'passport' | 'idcard' | 'sizereducer' | 'admin' | 'converter') => void;
  onOpenSample: (type: 'id_front' | 'id_back' | 'paper') => void;
}

interface CarouselSlide {
  id: 'scanner' | 'idcard' | 'sizereducer' | 'passport' | 'print' | 'converter';
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  highlights: string[];
  ctaText: string;
  previewGradient: string;
}

const CAROUSEL_SLIDES: CarouselSlide[] = [
  {
    id: 'scanner',
    badge: 'PERSPECTIVE AUTO-DESKEW',
    badgeColor: 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700',
    title: 'Document Scanner & Angle Straightener',
    subtitle: 'Turn phone photos of slanted papers into crisp, square, flat PDF scans',
    description: 'AI 4-corner magnetic edge detector unwarps angled documents on messy desks, applies studio contrast filters, and exports at 300 DPI.',
    icon: Crop,
    highlights: [
      'Interactive 4-corner pins with zoom loupe magnifier',
      'Studio B&W, Clean Scan, and Contrast Pop filters',
      'Batch scan & multiple pages reordering'
    ],
    ctaText: 'Launch Scan & Crop Studio',
    previewGradient: 'from-blue-600 via-indigo-600 to-cyan-600'
  },
  {
    id: 'idcard',
    badge: 'ISO CR80 PVC STANDARD',
    badgeColor: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-700',
    title: 'ID Card & PVC Studio (Aadhaar & PAN)',
    subtitle: '1-Click dual Front & Back cards to exact 85.6 × 53.98 mm physical dimensions',
    description: 'Built-in password unlocker for e-Aadhaar PDFs. Formatted for 4×6 photo paper (4R) or direct Epson PVC tray card printers with cutting hairlines.',
    icon: IdCard,
    highlights: [
      'Direct password unlock for e-Aadhaar (UIDAI)',
      'Presets for Aadhaar, PAN, Voter ID, Ayushman & Driving License',
      '4×6" photo paper side-by-side or stacked sheet output'
    ],
    ctaText: 'Launch ID & PVC Studio',
    previewGradient: 'from-emerald-600 via-teal-600 to-blue-600'
  },
  {
    id: 'sizereducer',
    badge: 'EXAM PORTAL READY',
    badgeColor: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-700',
    title: 'Govt Form Size Reducer & Signature Cleaner',
    subtitle: 'Guaranteed byte clamping for UPSC, SSC, NEET, JEE & PAN portals',
    description: 'Binary search compression fits exact target KB without quality loss. Includes 1-click cyber cafe tool to whiten yellow paper and darken faint pen ink.',
    icon: SlidersHorizontal,
    highlights: [
      'Exact KB guarantee (e.g. 20-50 KB for UPSC photo, 10-20 KB signature)',
      '1-Click shadow remover & signature contrast enhancer',
      'Live before/after file size meter and pixel dimensions'
    ],
    ctaText: 'Launch Govt Size Reducer',
    previewGradient: 'from-amber-600 via-orange-600 to-rose-600'
  },
  {
    id: 'passport',
    badge: 'ICAO / ISO / MEA SPEC',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700',
    title: 'Passport & Visa Photo Maker',
    subtitle: 'Arranges 6, 8, 12, or 16 passport photos onto standard 4×6 photo studio paper',
    description: 'Presets for Indian Passport (35×45mm), US Visa / Green Card (2×2"), UK, Schengen, and Canadian passports with zero wasted margins.',
    icon: CreditCard,
    highlights: [
      'Official guidelines with face outline alignment guide',
      'Instant 4×6" photo paper multi-up grid generator',
      'Custom border gaps & cutting scissor alignment lines'
    ],
    ctaText: 'Launch Passport Maker',
    previewGradient: 'from-indigo-600 via-purple-600 to-pink-600'
  },
  {
    id: 'print',
    badge: '1:1 MILLIMETER ACCURACY',
    badgeColor: 'bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200 border-cyan-200 dark:border-cyan-700',
    title: 'Multi-Card Print Studio',
    subtitle: 'WYSIWYG print sheets with millimeter scale locked to prevent printer scaling errors',
    description: 'Arrange multiple ID cards, certificates, and photos on A4, A3, Letter, or 4×6 paper. What you preview is millimeter-accurate on paper.',
    icon: Printer,
    highlights: [
      'Zero printer scaling distortion with physical millimeter lock',
      'Multi-up grid, vertical pair, and duplex back-to-back layout',
      'Download 300 DPI high-res sheet or direct Ctrl+P print'
    ],
    ctaText: 'Launch Print Studio',
    previewGradient: 'from-cyan-600 via-blue-600 to-indigo-600'
  },
  {
    id: 'converter',
    badge: 'PDF & CAD BLUEPRINT SUITE',
    badgeColor: 'bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-700',
    title: 'Master Document Converter & CAD',
    subtitle: 'Private in-browser tools to merge, split, watermark PDFs & view CAD DXF blueprints',
    description: 'Client-side PDF manipulations, image-to-PDF, page extraction, and technical DXF drawing renderer running 100% inside your browser.',
    icon: FileText,
    highlights: [
      'Merge multiple PDFs & extract specific page ranges',
      'Architectural CAD (.dxf) viewer & blueprint generator',
      'Custom watermark stamps & document compression'
    ],
    ctaText: 'Launch Master Converter',
    previewGradient: 'from-purple-600 via-indigo-600 to-blue-600'
  }
];

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, onOpenSample }) => {
  // Carousel State
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [isCarouselHovered, setIsCarouselHovered] = useState<boolean>(false);

  // Parallax Mouse Tilt State
  const [mouseOffset, setMouseOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState<number>(0);
  const heroRef = useRef<HTMLDivElement | null>(null);

  // Auto-advance Carousel every 5 seconds (pauses on hover)
  useEffect(() => {
    if (isCarouselHovered) return;
    const interval = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % CAROUSEL_SLIDES.length);
    }, 5500);
    return () => clearInterval(interval);
  }, [isCarouselHovered]);

  // Scroll listener for Parallax Depth
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Mouse move listener for Parallax 3D tilt
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMouseOffset({ x, y });
  };

  const handleMouseLeave = () => {
    setMouseOffset({ x: 0, y: 0 });
  };

  const activeSlide = CAROUSEL_SLIDES[currentSlideIndex];
  const ActiveIcon = activeSlide.icon;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      
      {/* Parallax Blueprint Isometric Grid Layer (Layer 0) */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.035] dark:opacity-[0.06] transition-transform duration-100 ease-linear"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1.2px, transparent 0)`,
          backgroundSize: '28px 28px',
          transform: `translate3d(0, ${scrollY * 0.08}px, 0)`,
        }}
      />

      {/* Parallax Floating Spatial Badges (Midground Layer 1) */}
      <div className="relative max-w-7xl mx-auto pointer-events-none">
        {/* Floating Badge 1 - Top Left */}
        <div 
          className="hidden xl:flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xl absolute -left-4 top-28 z-20 transition-transform duration-75 ease-out"
          style={{ transform: `translate3d(0, ${-scrollY * 0.22}px, 0)` }}
        >
          <div className="w-7 h-7 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xs shadow-2xs">
            📐
          </div>
          <div>
            <div className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100">300 DPI Studio Output</div>
            <div className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">Zero Blur Deskew</div>
          </div>
        </div>

        {/* Floating Badge 2 - Top Right */}
        <div 
          className="hidden xl:flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xl absolute -right-4 top-40 z-20 transition-transform duration-75 ease-out"
          style={{ transform: `translate3d(0, ${-scrollY * 0.3}px, 0)` }}
        >
          <div className="w-7 h-7 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xs shadow-2xs">
            💳
          </div>
          <div>
            <div className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100">CR80 85.6 × 54 mm</div>
            <div className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">1:1 Physical Millimeter</div>
          </div>
        </div>

        {/* Floating Badge 3 - Mid-Page Left (Near Carousel) */}
        <div 
          className="hidden xl:flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xl absolute left-2 top-[620px] z-20 transition-transform duration-75 ease-out"
          style={{ transform: `translate3d(0, ${scrollY * 0.12 - 40}px, 0)` }}
        >
          <div className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-xs shadow-2xs">
            ⚡
          </div>
          <div>
            <div className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100">Portal Size Clamping</div>
            <div className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">20 KB - 50 KB Binary Search</div>
          </div>
        </div>

        {/* Floating Badge 4 - Lower Right (Near SMB Xerox) */}
        <div 
          className="hidden xl:flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xl absolute right-2 top-[980px] z-20 transition-transform duration-75 ease-out"
          style={{ transform: `translate3d(0, ${-scrollY * 0.16 + 140}px, 0)` }}
        >
          <div className="w-7 h-7 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black text-xs shadow-2xs">
            🏪
          </div>
          <div>
            <div className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100">SMB Xerox Partner</div>
            <div className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">Opp. JJ Hospital Mumbai</div>
          </div>
        </div>
      </div>

      {/* HERO SECTION WITH PARALLAX DEPTH */}
      <section 
        ref={heroRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative overflow-hidden pt-10 pb-16 md:pt-16 md:pb-24 border-b border-slate-200/80 dark:border-slate-800"
      >
        {/* Parallax Ambient Glowing Backdrops (shifts with scroll & mouse) */}
        <div 
          className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/15 dark:bg-blue-600/20 rounded-full blur-3xl pointer-events-none transition-transform duration-500 ease-out"
          style={{
            transform: `translate3d(${mouseOffset.x * 40}px, ${scrollY * 0.18 + mouseOffset.y * 30}px, 0)`,
          }}
        />
        <div 
          className="absolute top-20 right-1/4 w-96 h-96 bg-purple-500/15 dark:bg-purple-600/20 rounded-full blur-3xl pointer-events-none transition-transform duration-500 ease-out"
          style={{
            transform: `translate3d(${-mouseOffset.x * 50}px, ${scrollY * 0.28 - mouseOffset.y * 35}px, 0)`,
          }}
        />
        <div 
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-48 bg-cyan-500/10 dark:bg-cyan-600/15 rounded-full blur-3xl pointer-events-none transition-transform duration-500 ease-out"
          style={{
            transform: `translate3d(-50%, ${scrollY * 0.1}px, 0)`,
          }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-5">
            
            {/* Version & Partner Pill */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold tracking-wide shadow-xs">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span>Studio Pro v2.5 • Developed in Collaboration with SMB Xerox Mumbai</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-950 dark:text-white tracking-tight leading-tight md:leading-[1.15]">
              Turn Any Document or Photo into{' '}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Perfect Print-Ready Sheets
              </span>
            </h1>

            {/* Sub-headline */}
            <p className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto">
              Automatic edge detection, 4-corner perspective unwarping, ISO CR80 PVC ID cards, ICAO passport photo sheets, and byte-precise government form size reducer.
            </p>

            {/* Primary Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => onNavigate('scanner')}
                className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm shadow-xl shadow-blue-600/30 flex items-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                <Crop className="w-4 h-4" />
                <span>Scan & Crop Document</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('idcard')}
                className="px-5 py-3 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs sm:text-sm border border-slate-300/80 dark:border-slate-700 shadow-md hover:shadow-lg flex items-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                <IdCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>ID Card & PVC Studio</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('sizereducer')}
                className="px-5 py-3 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs sm:text-sm border border-slate-300/80 dark:border-slate-700 shadow-md hover:shadow-lg flex items-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4 text-amber-500" />
                <span>Govt Size Reducer</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('passport')}
                className="px-5 py-3 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs sm:text-sm border border-slate-300/80 dark:border-slate-700 shadow-md hover:shadow-lg flex items-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                <CreditCard className="w-4 h-4 text-indigo-500" />
                <span>Passport Maker</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('print')}
                className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs sm:text-sm shadow-md flex items-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-cyan-400" />
                <span>Print Studio</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('converter')}
                className="px-5 py-3 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs sm:text-sm border border-slate-300/80 dark:border-slate-700 shadow-md hover:shadow-lg flex items-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-emerald-500" />
                <span>Converter & CAD</span>
              </button>
            </div>

            {/* Quick Demo Samples Helper */}
            <div className="pt-2 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Need a quick test? Try 1-click samples:</span>
              <button
                onClick={() => onOpenSample('id_front')}
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
              >
                Slanted ID Card
              </button>
              <span>•</span>
              <button
                onClick={() => onOpenSample('paper')}
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
              >
                A4 Certificate
              </button>
            </div>

          </div>

          {/* PARALLAX 3D TILT PREVIEW BANNER */}
          <div 
            className="mt-12 max-w-5xl mx-auto rounded-3xl bg-slate-900 dark:bg-slate-900 p-3 sm:p-5 shadow-2xl border border-slate-800 ring-1 ring-white/10 transition-transform duration-200 ease-out"
            style={{
              transform: `perspective(1000px) rotateY(${mouseOffset.x * 6}deg) rotateX(${-mouseOffset.y * 6}deg)`,
            }}
          >
            <div className="bg-slate-950 rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-800/90">
                
                {/* Step 1 */}
                <div className="flex flex-col items-center text-center p-2">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 text-blue-400 flex items-center justify-center mb-3">
                    <Crop className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-base text-white">1. Snap / Upload Slanted Document</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    AI automatically locks onto document corners, unwarps 3D perspective angles, and removes shadowy background clutter.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="flex flex-col items-center text-center p-2 md:pl-6">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-400 flex items-center justify-center mb-3">
                    <IdCard className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-base text-white">2. Automatic Standard Framing</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Lock to ISO CR80 PVC ID (85.6 × 54mm), ICAO 35×45mm passport grids, or A4 certificates with cutting margin guides.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="flex flex-col items-center text-center p-2 md:pl-6">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 flex items-center justify-center mb-3">
                    <Printer className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-base text-white">3. True 1:1 Millimeter Scale Print</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Print directly on A4 or 4×6 photo studio paper with physical millimeter lock—zero printer auto-fit scaling errors.
                  </p>
                </div>

              </div>
            </div>
          </div>

        </div>
      </section>

      {/* INTERACTIVE CAROUSEL ("CROAUAL") SHOWCASE */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Interactive Studio Tour</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-950 dark:text-white tracking-tight">
            Explore All 6 Studio Powerhouses
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Swipe or click through the modules engineered for daily photo studios and cyber cafes.
          </p>
        </div>

        {/* Carousel Card Container */}
        <div 
          onMouseEnter={() => setIsCarouselHovered(true)}
          onMouseLeave={() => setIsCarouselHovered(false)}
          className="relative max-w-5xl mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        >
          {/* Top Progress Bar */}
          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 w-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300"
              style={{ width: `${((currentSlideIndex + 1) / CAROUSEL_SLIDES.length) * 100}%` }}
            />
          </div>

          <div className="p-6 sm:p-10 md:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left Content (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-3">
                <span className={`text-[10px] sm:text-xs font-extrabold px-3 py-1 rounded-full border uppercase tracking-wider ${activeSlide.badgeColor}`}>
                  {activeSlide.badge}
                </span>
                <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500">
                  Slide {currentSlideIndex + 1} of {CAROUSEL_SLIDES.length}
                </span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white tracking-tight">
                {activeSlide.title}
              </h3>

              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                {activeSlide.subtitle}
              </p>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {activeSlide.description}
              </p>

              {/* Checklist */}
              <ul className="space-y-2 pt-2 text-xs text-slate-700 dark:text-slate-300">
                {activeSlide.highlights.map((h, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>

              {/* Slide CTA */}
              <div className="pt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate(activeSlide.id)}
                  style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                  className="px-6 py-3 rounded-2xl font-bold text-xs sm:text-sm shadow-lg shadow-blue-500/25 flex items-center gap-2 hover:bg-blue-500 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span>{activeSlide.ctaText}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Right Visual Graphic (5 cols) */}
            <div className="lg:col-span-5 flex items-center justify-center">
              <div className={`w-full aspect-square max-w-[320px] rounded-3xl bg-gradient-to-br ${activeSlide.previewGradient} p-1 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center text-white text-center group`}>
                <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-xs" />
                <div className="relative z-10 p-6 flex flex-col items-center space-y-4">
                  <div className="w-20 h-20 rounded-3xl bg-white/20 border border-white/30 backdrop-blur-md flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-300">
                    <ActiveIcon className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <div className="font-extrabold text-lg tracking-tight">{activeSlide.title}</div>
                    <div className="text-xs text-white/80 font-mono mt-1">Ready for 1-Click Launch</div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Carousel Controls Footer */}
          <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {CAROUSEL_SLIDES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentSlideIndex(i)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    i === currentSlideIndex
                      ? 'w-8 bg-blue-600'
                      : 'w-2 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400'
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentSlideIndex((prev) => (prev - 1 + CAROUSEL_SLIDES.length) % CAROUSEL_SLIDES.length)}
                className="p-2 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer shadow-xs transition-colors"
                title="Previous slide"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentSlideIndex((prev) => (prev + 1) % CAROUSEL_SLIDES.length)}
                className="p-2 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer shadow-xs transition-colors"
                title="Next slide"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* DEDICATED PARTNER & CREATOR TRIBUTE: SMB XEROX & PHOTO PRINTING */}
      <section className="py-16 bg-gradient-to-b from-slate-100/80 via-white to-slate-100/80 dark:from-slate-900/60 dark:via-slate-950 dark:to-slate-900/60 border-y border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            
            {/* Header Badge */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 sm:p-8 text-white relative overflow-hidden">
              <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10 space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 border border-white/30 backdrop-blur-md text-white text-xs font-bold tracking-wide">
                  <Award className="w-3.5 h-3.5 text-amber-300" />
                  <span>Official Field Testing Partner • Mumbai</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight">
                  SMB Xerox & Photo Printing
                </h3>
                <p className="text-xs sm:text-sm text-blue-100 max-w-xl leading-relaxed">
                  PrintMate was battle-tested and refined in direct partnership with SMB Xerox & Photo Printing near J.J. Hospital, Mumbai—engineering solutions directly for daily Xerox shop challenges.
                </p>
              </div>
            </div>

            {/* Shop Details Grid */}
            <div className="p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Location & Address */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    <MapPin className="w-4 h-4 text-rose-500" />
                    <span>Shop Address & Landmarks</span>
                  </div>

                  {/* Option 1 Landmark */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                    <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                      <span>Primary Location (Gate No. 2):</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-3.5">
                      Opposite J.J. Hospital Gate Number 2, 75/77, Ramchandra Bhatt Marg, Noor Baug - Umerkhadi, Mumbai, Maharashtra 400009
                    </p>
                  </div>

                  {/* Option 2 Landmark */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                    <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                      <span>Alternate Landmark (Gate No. 6):</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-3.5">
                      Opposite J.J. Hospital Gate No. 6, next to Sheetal Medical, JJ Hospital Road / JJ Road, Dongri / Mumbai Central, Mumbai, Maharashtra 400009
                    </p>
                  </div>
                </div>

                {/* Contact, Timings & Services */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    <Phone className="w-4 h-4 text-emerald-500" />
                    <span>Contact & Operating Hours</span>
                  </div>

                  <div className="space-y-3">
                    {/* Phone Number with click to call */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Phone Number</div>
                        <a 
                          href="tel:+918828887850" 
                          className="text-base font-extrabold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5"
                        >
                          <Phone className="w-4 h-4" />
                          <span>+91 88288 87850</span>
                        </a>
                      </div>
                      <a
                        href="https://wa.me/918828887850"
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        title="Chat on WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>WhatsApp</span>
                      </a>
                    </div>

                    {/* Operating Timings */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Store Hours</div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          Open Daily: <span className="text-emerald-600 dark:text-emerald-400 font-mono">7:00 AM – 8:00 PM</span>
                        </div>
                      </div>
                    </div>

                    {/* Collaboration Note */}
                    <div className="p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                      💡 <em>"From true-scale PVC ID card tray cuts to government exam photo size limits, every millimeter feature in PrintMate was calibrated on the shop floor at SMB Xerox."</em>
                    </div>
                  </div>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Xerox • Color Printing • Lamination • ID Cards • Cyber Cafe Services</span>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href="tel:+918828887850"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call Shop</span>
                  </a>
                  <a
                    href="https://maps.google.com/?q=J.J.+Hospital+Gate+Number+2,+75/77,+Ramchandra+Bhatt+Marg,+Mumbai+400009"
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-all"
                  >
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    <span>Directions on Map</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* CORE STUDIO SUITES (ALL 6 MODULES) */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-extrabold text-blue-600 uppercase tracking-widest">
            Complete Suite
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Engineered for Photographers, Cyber Cafes & Everyday Users
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Six dedicated, powerhouse modules built into a unified browser workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Card 1: Scanner */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-lg hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-700 transition-all flex flex-col justify-between group">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <Crop className="w-7 h-7" />
              </div>
              <div className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 mb-3">
                PERSPECTIVE DESKEW
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">
                Document Scanner & Straightener
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                Turn photos of documents, certificates, bills, and papers taken on desks into clean, flat, rectangular scans with interactive corner handles, loupe zoom, and contrast enhancement.
              </p>
              
              <ul className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 mb-6">
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
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-lg hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-700 transition-all flex flex-col justify-between group">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <CreditCard className="w-7 h-7" />
              </div>
              <div className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 mb-3">
                ICAO / ISO SPEC
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">
                Passport & Visa Photo Maker
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                Create official compliant passport photos for Indian, US Visa (2×2"), UK, Schengen, and Canadian passports. Instantly arrange 6, 8, 12, or 16 photos onto a 4×6 photo sheet with zero wasted paper.
              </p>
              
              <ul className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 mb-6">
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
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-lg hover:shadow-xl hover:border-slate-400 dark:hover:border-slate-600 transition-all flex flex-col justify-between group">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <Printer className="w-7 h-7 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 mb-3">
                CR80 MILLIMETER ACCURATE
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">
                Multi-Card Print Studio
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                Arrange documents and cards on A4 sheets with exact physical scale. What you see on screen is pixel-for-pixel what prints out from your printer.
              </p>
              
              <ul className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 mb-6">
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

          {/* Card 4: Master Converter */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-lg hover:shadow-xl hover:border-emerald-300 dark:hover:border-emerald-700 transition-all flex flex-col justify-between group">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <FileText className="w-7 h-7" />
              </div>
              <div className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 mb-3">
                PDF & CAD SUITE
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">
                Master Document Converter
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                Fast, private conversion studio for merging, splitting, watermarking PDFs, extracting pages, rendering CAD DXF blueprints, and Office docs.
              </p>
              
              <ul className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 mb-6">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Merge & Split PDFs by pages or chunks</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>CAD DXF to architectural blueprints</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Watermarks, compression & page numbers</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => onNavigate('converter')}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <span>Open Master Converter</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 5: ID Card & PVC Studio */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-lg hover:shadow-xl hover:border-blue-400 dark:hover:border-blue-600 transition-all flex flex-col justify-between group">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <IdCard className="w-7 h-7" />
              </div>
              <div className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 mb-3">
                ISO CR80 PVC MAKER
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">
                ID Card & PVC Studio
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                1-Click conversion of e-Aadhaar, PAN, Voter ID, Ayushman Bharat, and Driving Licenses to exact 85.6 × 53.98mm PVC card layouts with password unlock and 4×6 photo sheet printing.
              </p>
              
              <ul className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 mb-6">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Built-in e-Aadhaar PDF password unlocker</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Dual interactive Front & Back CR80 crops</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>4×6" photo paper, A4, or PVC tray layouts</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => onNavigate('idcard')}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              <span>Open PVC ID Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 6: Govt Form Size Reducer */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-lg hover:shadow-xl hover:border-indigo-400 dark:hover:border-indigo-600 transition-all flex flex-col justify-between group">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <SlidersHorizontal className="w-7 h-7" />
              </div>
              <div className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 mb-3">
                GOVT EXAM PORTALS
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">
                Govt Form Size Reducer
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                Guaranteed file size clamping for UPSC, SSC, NEET, JEE, and PAN Card uploads. Includes 1-click cyber-cafe background whitener and ink darkener for signatures.
              </p>
              
              <ul className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 mb-6">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Binary search algorithm: exact target KB guarantee</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>1-click dirty background signature cleaner</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Presets for UPSC, SSC, NTA, PAN & Passport Seva</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => onNavigate('sizereducer')}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <span>Open Size Reducer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </section>

      {/* SUPPORTED DOCUMENT STANDARDS MATRIX */}
      <section className="py-16 bg-slate-100/70 dark:bg-slate-900/60 border-y border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-10 space-y-2">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              Supported Document Formats & Standards
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
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
                className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-blue-400 dark:hover:border-blue-500 transition-all"
              >
                <div className="text-xs font-extrabold text-slate-900 dark:text-white">{std.name}</div>
                <div className="text-[11px] font-mono text-blue-600 dark:text-blue-400 mt-1 font-semibold">{std.size}</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-400 mt-0.5">{std.type}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST & PRIVACY GUARANTEE */}
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

      {/* Floating Smooth Parallax Scroll-to-Top Button */}
      {scrollY > 300 && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 p-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white shadow-2xl border border-blue-400/40 z-40 transition-all transform hover:scale-110 active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          title="Scroll to Top"
        >
          <ArrowUp className="w-4 h-4" />
          <span className="hidden sm:inline">Top</span>
        </button>
      )}

    </div>
  );
};
