import React, { useState, useEffect } from 'react';
import { Header, TabId } from '../components/layout/Header';
import { HomePage } from '../pages/Home/HomePage';
import { ImageEditorPage } from '../pages/ImageEditor/ImageEditorPage';
import { PageLayoutPage } from '../pages/PageLayout/PageLayoutPage';
import { PrintPreviewPage } from '../pages/PrintPreview/PrintPreviewPage';
import { JobHistoryPage } from '../pages/JobHistory/JobHistoryPage';
import { SettingsPage } from '../pages/Settings/SettingsPage';
import { useJobStore } from '../stores/jobStore';
import { useSettingsStore } from '../stores/settingsStore';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const { currentJob, createNewJob, saveCurrentJob } = useJobStore();
  const { fetchSettings, fetchPrinters } = useSettingsStore();

  useEffect(() => {
    fetchSettings();
    fetchPrinters();
    if (!currentJob) {
      createNewJob();
    }

    // Global keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveCurrentJob();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setActiveTab('preview');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header activeTab={activeTab} onSelectTab={setActiveTab} />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {activeTab === 'home' && <HomePage onNavigate={setActiveTab} />}
        {activeTab === 'editor' && <ImageEditorPage onNavigate={setActiveTab} />}
        {activeTab === 'layout' && <PageLayoutPage onNavigate={setActiveTab} />}
        {activeTab === 'preview' && <PrintPreviewPage onNavigate={setActiveTab} />}
        {activeTab === 'history' && <JobHistoryPage onNavigate={setActiveTab} />}
        {activeTab === 'settings' && <SettingsPage />}
      </div>
    </div>
  );
};
