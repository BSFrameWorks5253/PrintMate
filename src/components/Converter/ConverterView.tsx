import React, { useState } from 'react';
import { NavigationRibbon } from './ui/NavigationRibbon';
import { PdfellaAllToolsHub } from './features/PdfellaAllToolsHub';
import { ContextSmartWorkspace } from './features/ContextSmartWorkspace';
import { PdfEditorStudio } from './features/PdfEditorStudio';
import { PdfMergeStudio } from './features/PdfMergeStudio';
import { PdfSplitStudio } from './features/PdfSplitStudio';
import { PdfPageStudio } from './features/PdfPageStudio';
import { PdfSecurityStudio } from './features/PdfSecurityStudio';
import { ReverseConverterStudio } from './features/ReverseConverterStudio';
import { ImageGalleryStudio } from './features/ImageGalleryStudio';
import { OfficeConverterStudio } from './features/OfficeConverterStudio';
import { CadToPdfStudio } from './features/CadToPdfStudio';
import type { NavigationTab } from '../../types/converter';

export const ConverterView: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('all-tools');

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-[#F8FAFC] dark:bg-slate-950 text-slate-800 dark:text-slate-100 select-none font-sans">
      {/* 1. Master Converter Navigation Ribbon */}
      <NavigationRibbon 
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
      />

      {/* 2. Main Studio Canvas Area */}
      <div className="flex-1 overflow-auto relative">
        {currentTab === 'all-tools' && (
          <PdfellaAllToolsHub
            onSelectTool={(tab) => setCurrentTab(tab)}
          />
        )}

        {currentTab === 'workspace' && (
          <ContextSmartWorkspace />
        )}

        {currentTab === 'pdf-editor' && (
          <PdfEditorStudio />
        )}

        {currentTab === 'pdf-merge' && (
          <PdfMergeStudio />
        )}

        {currentTab === 'pdf-split' && (
          <PdfSplitStudio />
        )}

        {currentTab === 'pdf-organizer' && (
          <PdfPageStudio />
        )}

        {currentTab === 'pdf-security' && (
          <PdfSecurityStudio />
        )}

        {currentTab === 'reverse-suite' && (
          <ReverseConverterStudio />
        )}

        {currentTab === 'image-gallery' && (
          <ImageGalleryStudio />
        )}

        {currentTab === 'office-suite' && (
          <OfficeConverterStudio />
        )}

        {currentTab === 'cad-studio' && (
          <CadToPdfStudio />
        )}
      </div>
    </div>
  );
};
