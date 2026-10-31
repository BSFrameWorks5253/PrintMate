import React, { useState } from 'react';
import { 
  RotateCw, 
  Trash2, 
  MoveUp, 
  MoveDown, 
  Download, 
  FilePlus, 
  Sparkles,
  Layers,
  FileText,
  UploadCloud,
  Check
} from 'lucide-react';
import { ImageGalleryItem } from '../../../types/converter';
import { ImageConverter } from '../../../services/converter/imageConverter';

export const ImageGalleryStudio: React.FC = () => {
  const [images, setImages] = useState<ImageGalleryItem[]>([]);
  const [orientation, setOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [margin, setMargin] = useState<number>(20);
  const [layout, setLayout] = useState<1 | 2 | 4>(1);
  const [filter, setFilter] = useState<'none' | 'grayscale' | 'bw'>('none');
  const [watermark, setWatermark] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAddImages = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          const bytes = new Uint8Array(reader.result as ArrayBuffer);
          const blob = new Blob([bytes], { type: file.type });
          const previewUrl = URL.createObjectURL(blob);

          const img = new Image();
          img.src = previewUrl;
          img.onload = () => {
            setImages((prev) => [
              ...prev,
              {
                id: Math.random().toString(36).substring(2, 9),
                name: file.name,
                size: file.size,
                bytes,
                previewUrl,
                rotation: 0,
                width: img.naturalWidth,
                height: img.naturalHeight
              }
            ]);
          };
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const handleBrowseFiles = async () => {
    if (window.electronAPI) {
      const files = await window.electronAPI.openFilesDialog({
        filters: [{ name: 'Images (*.jpg, *.png, *.webp)', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] }]
      });

      if (files && Array.isArray(files)) {
        files.forEach((f: any) => {
          const bytes = new Uint8Array(f.buffer);
          const blob = new Blob([bytes]);
          const previewUrl = URL.createObjectURL(blob);

          const img = new Image();
          img.src = previewUrl;
          img.onload = () => {
            setImages((prev) => [
              ...prev,
              {
                id: Math.random().toString(36).substring(2, 9),
                name: f.name,
                size: f.size,
                bytes,
                previewUrl,
                rotation: 0,
                width: img.naturalWidth,
                height: img.naturalHeight
              }
            ]);
          };
        });
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = (e) => {
        const target = e.target as HTMLInputElement;
        if (target.files) handleAddImages(target.files);
      };
      input.click();
    }
  };

  const rotateImage = (id: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, rotation: (img.rotation + 90) % 360 } : img
      )
    );
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const moveImage = (index: number, direction: 'left' | 'right') => {
    const targetIdx = direction === 'left' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= images.length) return;
    const newImgs = [...images];
    const [moved] = newImgs.splice(index, 1);
    newImgs.splice(targetIdx, 0, moved);
    setImages(newImgs);
  };

  const handleGeneratePdf = async () => {
    if (images.length === 0) return;
    setIsGenerating(true);

    try {
      const pdfBytes = await ImageConverter.galleryToPdf(images, {
        orientation,
        margin,
        layout,
        filter,
        watermark: watermark.trim() || undefined
      });

      const filename = `Photo_Album_${new Date().toISOString().slice(0, 10)}.pdf`;

      if (window.electronAPI) {
        const savedPath = await window.electronAPI.saveFileDialog({
          defaultName: filename,
          buffer: pdfBytes.buffer as ArrayBuffer,
          filterName: 'PDF Documents (*.pdf)',
          extension: 'pdf'
        });
        if (savedPath) {
          await window.electronAPI.revealInFolder(savedPath);
        }
      } else {
        const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateWord = async () => {
    if (images.length === 0) return;
    setIsGenerating(true);

    try {
      const docxBytes = await ImageConverter.imagesToDocx(images);

      const filename = `Photo_Document_${new Date().toISOString().slice(0, 10)}.docx`;

      if (window.electronAPI) {
        const savedPath = await window.electronAPI.saveFileDialog({
          defaultName: filename,
          buffer: docxBytes.buffer as ArrayBuffer,
          filterName: 'Word Documents (*.docx)',
          extension: 'docx'
        });
        if (savedPath) {
          await window.electronAPI.revealInFolder(savedPath);
        }
      } else {
        const blob = new Blob([docxBytes as BlobPart], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      alert(`Word export error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] text-slate-800 select-none overflow-y-auto custom-scrollbar font-sans p-6 md:p-8">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Header Bar */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold mb-1 border border-indigo-100">
              <Sparkles className="size-3.5" />
              <span>Image Sequence Studio</span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Photos to PDF Album & Word (.docx)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Sequence images in exact selection order with aspect ratio preservation and scan filters.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={images.length === 0 || isGenerating}
              onClick={handleGenerateWord}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              <FileText className="size-4" />
              <span>Convert to Word</span>
            </button>

            <button
              disabled={images.length === 0 || isGenerating}
              onClick={handleGeneratePdf}
              className="px-5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              <Download className="size-4" />
              <span>{isGenerating ? 'Building...' : 'Create PDF Album'}</span>
            </button>
          </div>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files) handleAddImages(e.dataTransfer.files);
          }}
          onClick={handleBrowseFiles}
          className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-white hover:bg-indigo-50/20 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition shadow-2xs group"
        >
          <div className="size-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-2 group-hover:scale-105 transition border border-indigo-100">
            <UploadCloud className="size-6" />
          </div>
          <span className="text-sm font-bold text-slate-900">
            {images.length > 0
              ? `${images.length} images loaded (Click or drop to append more)`
              : 'Click or Drop Photos Here (JPG, PNG, WebP)'}
          </span>
          <span className="text-xs text-slate-400 mt-1">
            Order is strictly preserved and rearrangable below
          </span>
        </div>

        {/* Configuration Bar */}
        {images.length > 0 && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">Layout:</span>
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  {([1, 2, 4] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLayout(l)}
                      className={`px-2.5 py-1 rounded-md font-bold transition ${
                        layout === l ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      {l} {l === 1 ? 'Page' : 'Grid'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">Filter:</span>
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  {[
                    { id: 'none', label: 'Color' },
                    { id: 'grayscale', label: 'Grayscale' },
                    { id: 'bw', label: 'B&W Scan' }
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFilter(f.id as any)}
                      className={`px-2.5 py-1 rounded-md font-bold transition ${
                        filter === f.id ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">Orientation:</span>
                <select
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value as any)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold"
                >
                  <option value="auto">Auto-detect</option>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => setImages([])}
              className="text-slate-400 hover:text-rose-600 font-bold"
            >
              Clear All
            </button>
          </div>
        )}

        {/* Gallery Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {images.map((item, index) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200/90 hover:border-indigo-400 rounded-2xl p-3 flex flex-col items-center group relative shadow-2xs transition"
            >
              <span className="absolute top-2 left-2 size-6 rounded-full bg-slate-800 text-white text-[10px] font-mono font-bold flex items-center justify-center z-10 shadow-xs">
                {index + 1}
              </span>

              <div className="w-full aspect-[1/1.2] bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center p-2 border border-slate-100">
                <img
                  src={item.previewUrl}
                  alt={item.name}
                  className="w-full h-full object-contain transition-transform duration-300"
                  style={{ transform: `rotate(${item.rotation}deg)` }}
                />
              </div>

              <p className="text-xs font-bold text-slate-800 truncate w-full mt-2 text-center">
                {item.name}
              </p>

              <div className="flex items-center justify-center gap-1 mt-2.5 w-full pt-2 border-t border-slate-100">
                <button
                  disabled={index === 0}
                  onClick={() => moveImage(index, 'left')}
                  className="p-1 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-20 border border-slate-200 transition"
                  title="Move Left"
                >
                  <MoveUp className="size-3.5 -rotate-90" />
                </button>

                <button
                  onClick={() => rotateImage(item.id)}
                  className="p-1 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition"
                  title="Rotate 90° Clockwise"
                >
                  <RotateCw className="size-3.5" />
                </button>

                <button
                  disabled={index === images.length - 1}
                  onClick={() => moveImage(index, 'right')}
                  className="p-1 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-20 border border-slate-200 transition"
                  title="Move Right"
                >
                  <MoveDown className="size-3.5 -rotate-90" />
                </button>

                <button
                  onClick={() => removeImage(item.id)}
                  className="p-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition"
                  title="Remove Image"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
