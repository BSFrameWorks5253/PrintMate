import React, { useState } from 'react';
import { Header } from './components/Header';
import { ScannerView } from './components/Scanner/ScannerView';
import { PrintStudioView } from './components/PrintStudio/PrintStudioView';
import { PassportMakerView } from './components/PassportMaker/PassportMakerView';
import type { PrintQueueItem } from './types';
import { createSampleIdCard, createSamplePaperDocument } from './utils/sampleImages';
import { rotateCanvas } from './utils/imageProcessing';
import './App.css';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'scanner' | 'print' | 'passport'>('scanner');
  const [queue, setQueue] = useState<PrintQueueItem[]>([]);
  const [externalImage, setExternalImage] = useState<string | null>(null);

  const handleSendToPrint = (item: Omit<PrintQueueItem, 'id' | 'createdAt'>) => {
    const newItem: PrintQueueItem = {
      ...item,
      id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now(),
    };
    setQueue((prev) => [newItem, ...prev]);
    setActiveTab('print');
  };

  const handleSendMultipleToPrint = (items: Omit<PrintQueueItem, 'id' | 'createdAt'>[]) => {
    const newItems: PrintQueueItem[] = items.map((item, idx) => ({
      ...item,
      id: `queue-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now() + idx,
    }));
    setQueue((prev) => [...newItems, ...prev]);
    setActiveTab('print');
  };

  const handleRemoveItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearQueue = () => {
    setQueue([]);
  };

  const handleDuplicateItem = (id: string) => {
    const target = queue.find((q) => q.id === id);
    if (!target) return;
    const duplicated: PrintQueueItem = {
      ...target,
      id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: `${target.name} (Copy)`,
      createdAt: Date.now(),
    };
    setQueue((prev) => [...prev, duplicated]);
  };

  const handleRotateItem = (id: string) => {
    const target = queue.find((q) => q.id === id);
    if (!target) return;

    const img = new Image();
    img.onload = () => {
      const rotated = rotateCanvas(img, 90);
      const nextDataUrl = rotated.toDataURL('image/jpeg', 0.96);
      setQueue((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                dataUrl: nextDataUrl,
                aspectRatio: rotated.width / rotated.height,
              }
            : item
        )
      );
    };
    img.src = target.dataUrl;
  };

  const handleLoadSample = (type: 'id_front' | 'id_back' | 'paper') => {
    if (type === 'id_front') {
      setExternalImage(createSampleIdCard('front'));
    } else if (type === 'id_back') {
      setExternalImage(createSampleIdCard('back'));
    } else {
      setExternalImage(createSamplePaperDocument());
    }
    setActiveTab('scanner');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        queue={queue}
        onLoadSample={handleLoadSample}
      />

      <main className="flex-1">
        {activeTab === 'scanner' && (
          <ScannerView
            onSendToPrint={handleSendToPrint}
            onSendMultipleToPrint={handleSendMultipleToPrint}
            externalImage={externalImage}
            onClearExternalImage={() => setExternalImage(null)}
          />
        )}

        {activeTab === 'print' && (
          <PrintStudioView
            queue={queue}
            onAddItem={handleSendToPrint}
            onRemoveItem={handleRemoveItem}
            onClearQueue={handleClearQueue}
            onDuplicateItem={handleDuplicateItem}
            onRotateItem={handleRotateItem}
            onNavigateToScanner={() => setActiveTab('scanner')}
          />
        )}

        {activeTab === 'passport' && (
          <PassportMakerView onSendToPrint={handleSendToPrint} />
        )}
      </main>

      {/* Footer */}
      <footer className="no-print border-t border-slate-200 py-4 bg-white text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="PrintMate Logo" className="w-5 h-5 object-contain" />
            <span className="font-semibold text-slate-800">PrintMate</span>
            <span>• Auto Border Detection, Deskew & Multi-Up Print Studio</span>
          </div>
          <div className="text-[11px] text-slate-400">
            A4 • A3 • Letter • Duplex • CR80 ID Standard Scale
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
