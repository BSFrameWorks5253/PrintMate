import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  FileText, 
  FileSpreadsheet, 
  Image as ImageIcon, 
  Compass, 
  RefreshCw, 
  Download, 
  Eye, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  ChevronUp, 
  ChevronDown, 
  RotateCw, 
  Scissors, 
  ShieldCheck, 
  Layers, 
  FolderCheck, 
  FolderArchive, 
  CheckCircle2, 
  Loader2, 
  Sparkles, 
  Plus, 
  ScanText, 
  ArrowRight,
  ArrowUpDown,
  ArrowLeftRight,
  LayoutGrid,
  List,
  ChevronsLeft,
  ChevronsRight,
  FolderOpen,
  X,
  FileCheck2,
  Sliders,
  Check,
  Maximize2
} from 'lucide-react';
import { UniversalMerger } from '../../../services/converter/universalMerger';
import { ImageConverter } from '../../../services/converter/imageConverter';
import { OfficeConverter } from '../../../services/converter/officeConverter';
import { ReverseConverter } from '../../../services/converter/reverseConverter';
import { CadConverter } from '../../../services/converter/cadConverter';
import { PdfPageStudioService, PageThumbnail } from '../../../services/converter/pdfPageStudio';
import { PdfSecurityAndToolsService } from '../../../services/converter/pdfSecurityAndTools';
import { PdfPreviewModal } from '../ui/PdfPreviewModal';
import JSZip from 'jszip';

export interface WorkFile {
  id: string;
  name: string;
  size: number;
  type: 'image' | 'pdf' | 'office' | 'cad' | 'text' | 'unknown';
  extension: string;
  bytes: Uint8Array;
  previewUrl?: string;
  rotation?: number; // for images
  width?: number;
  height?: number;
}

interface ContextSmartWorkspaceProps {
  onFilesChange?: (count: number) => void;
}

interface ExportToast {
  id: string;
  title: string;
  message: string;
  filePath?: string;
}

export const ContextSmartWorkspace: React.FC<ContextSmartWorkspaceProps> = ({ onFilesChange }) => {
  const [files, setFiles] = useState<WorkFile[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStatus, setProgressStatus] = useState<string | null>(null);
  const [previewPdf, setPreviewPdf] = useState<{ bytes: Uint8Array; name: string } | null>(null);
  const [toast, setToast] = useState<ExportToast | null>(null);

  // View mode for files queue: 'grid' (spacious light table) vs 'strip' (horizontal carousel)
  const [viewMode, setViewMode] = useState<'grid' | 'strip'>('grid');

  // Responsive arrow direction state: 'horizontal' vs 'vertical'
  const [layoutDirection, setLayoutDirection] = useState<'horizontal' | 'vertical'>('horizontal');
  const filesContainerRef = useRef<HTMLDivElement | null>(null);

  // Drag-and-drop reorder state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const rafRef = useRef<number | null>(null);
  const currentPdfIdRef = useRef<string | null>(null);

  // PDF Page Studio state (when a single PDF is selected)
  const [pdfPages, setPdfPages] = useState<PageThumbnail[]>([]);
  const [pdfRangeInput, setPdfRangeInput] = useState('');
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [showPdfPageStudio, setShowPdfPageStudio] = useState(false);

  // Tool specific configurations
  const [imageOrientation, setImageOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [imageMargin, setImageMargin] = useState<number>(20);
  const [imageQuality, setImageQuality] = useState<'max' | 'balanced' | 'compact'>('max');
  const [imageFilter, setImageFilter] = useState<'none' | 'grayscale' | 'bw'>('none');
  const [imageLayout, setImageLayout] = useState<1 | 2 | 4>(1);
  const [watermarkText, setWatermarkText] = useState<string>('');
  const [showWatermarkInput, setShowWatermarkInput] = useState<boolean>(false);
  const [cadTheme, setCadTheme] = useState<'blueprint' | 'monochrome' | 'layers'>('blueprint');
  const [cadPaperSize, setCadPaperSize] = useState<'a4' | 'a3' | 'a2' | 'a1'>('a4');

  // Global Clipboard Paste (Ctrl + V)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const items = Array.from(clipboardData.items);
      const imageItems = items.filter((item) => item.type.startsWith('image/'));

      if (imageItems.length === 0) return;

      e.preventDefault();
      const filesToAdd: File[] = [];

      for (let i = 0; i < imageItems.length; i++) {
        const item = imageItems[i];
        const blob = item.getAsFile();
        if (blob) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const ext = blob.type.split('/')[1] || 'png';
          const namedFile = new File([blob], `Pasted_${timestamp}_${i + 1}.${ext}`, { type: blob.type });
          filesToAdd.push(namedFile);
        }
      }

      if (filesToAdd.length > 0) {
        await handleIngestFiles(filesToAdd);
        showToast('Clipboard Image Added', `Pasted ${filesToAdd.length} image(s) from clipboard`);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Notify parent on file count change
  useEffect(() => {
    onFilesChange?.(files.length);
  }, [files.length, onFilesChange]);

  // Observe container dimensions to dynamically switch between horizontal/vertical arrows
  useEffect(() => {
    const handleResize = () => {
      if (filesContainerRef.current) {
        const { clientWidth } = filesContainerRef.current;
        setLayoutDirection(clientWidth < 640 ? 'vertical' : 'horizontal');
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [files.length]);

  // Global Full-Window Drag & Drop Ingestion
  useEffect(() => {
    let dragCounter = 0;
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer?.types?.includes('Files')) {
        setIsGlobalDragging(true);
      }
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        setIsGlobalDragging(false);
        dragCounter = 0;
      }
    };
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsGlobalDragging(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleIngestFiles(e.dataTransfer.files);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  // Keyboard navigation & power shortcuts (←, →, R, Del, Home, End, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing into an input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;

      if (selectedFileIndex !== null && files.length > 0) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          moveItem(selectedFileIndex, 'prev');
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          moveItem(selectedFileIndex, 'next');
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          removeFile(selectedFileIndex);
        } else if (e.key === 'r' || e.key === 'R') {
          if (files[selectedFileIndex]?.type === 'image') {
            e.preventDefault();
            rotateImageItem(selectedFileIndex);
          }
        } else if (e.key === 'Home') {
          e.preventDefault();
          moveToFirst(selectedFileIndex);
        } else if (e.key === 'End') {
          e.preventDefault();
          moveToLast(selectedFileIndex);
        }
      }

      if (e.key === 'Escape') {
        setSelectedFileIndex(null);
        setPreviewPdf(null);
        setShowWatermarkInput(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFileIndex, files]);

  // Toast Notification System
  const showToast = (title: string, message: string, filePath?: string) => {
    const id = Date.now().toString();
    setToast({ id, title, message, filePath });
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 8000);
  };

  // Safe Universal File Saver
  const saveExportedFile = async (
    bytes: Uint8Array,
    defaultName: string,
    filterName = 'PDF Document (*.pdf)',
    extension = 'pdf',
    mimeType = 'application/pdf'
  ): Promise<string | null> => {
    const safeBuffer = bytes.slice().buffer as ArrayBuffer;

    if (window.electronAPI?.saveFileDialog) {
      const savedPath = await window.electronAPI.saveFileDialog({
        defaultName,
        buffer: safeBuffer,
        filterName,
        extension
      });

      if (savedPath) {
        showToast('Export Completed', `Successfully exported: ${defaultName}`, savedPath);
        return savedPath;
      }
      return null;
    } else {
      // Browser fallback
      const blob = new Blob([bytes as BlobPart], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Export Completed', `Downloaded: ${defaultName}`);
      return defaultName;
    }
  };

  // Categorize loaded files
  const fileTypes = files.map((f) => f.type);
  const isAllImages = files.length > 0 && fileTypes.every((t) => t === 'image');
  const isAllPdfs = files.length > 0 && fileTypes.every((t) => t === 'pdf');
  const isAllOffice = files.length > 0 && fileTypes.every((t) => t === 'office');
  const isAllCad = files.length > 0 && fileTypes.every((t) => t === 'cad');
  const isMixed = files.length > 1 && new Set(fileTypes).size > 1;

  // 100% Guaranteed Strict Order Preservation File Ingestion:
  const handleIngestFiles = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;

    // Use Promise.all with indexed map so files are processed asynchronously but ordered strictly by the user's selection index!
    const parsedFiles: WorkFile[] = await Promise.all(
      arr.map(async (file, idx) => {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        let type: WorkFile['type'] = 'unknown';

        if (['jpg', 'jpeg', 'png', 'webp', 'bmp', 'svg'].includes(ext)) type = 'image';
        else if (ext === 'pdf') type = 'pdf';
        else if (['docx', 'xlsx', 'xls', 'txt'].includes(ext)) type = 'office';
        else if (['dxf', 'dwg'].includes(ext)) type = 'cad';

        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let previewUrl: string | undefined;

        if (type === 'image') {
          const blob = new Blob([bytes.slice() as BlobPart]);
          previewUrl = URL.createObjectURL(blob);
        }

        return {
          id: `${Date.now()}-${idx}-${file.name}`,
          name: file.name,
          size: file.size,
          type,
          extension: ext,
          bytes,
          previewUrl,
          rotation: 0
        };
      })
    );

    setFiles((prev) => [...prev, ...parsedFiles]);
  };

  const handleBrowseFiles = async () => {
    if (window.electronAPI?.openFilesDialog) {
      const selected = await window.electronAPI.openFilesDialog({
        filters: [
          {
            name: 'All Supported Formats (*.jpg, *.png, *.webp, *.pdf, *.docx, *.xlsx, *.dwg, *.dxf, *.txt)',
            extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'svg', 'pdf', 'docx', 'xlsx', 'xls', 'dwg', 'dxf', 'txt']
          },
          { name: 'Photos & Images (*.jpg, *.png, *.webp, *.bmp)', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'svg'] },
          { name: 'PDF Documents (*.pdf)', extensions: ['pdf'] },
          { name: 'Office Documents (*.docx, *.xlsx, *.txt)', extensions: ['docx', 'xlsx', 'xls', 'txt'] },
          { name: 'AutoCAD Drawings (*.dwg, *.dxf)', extensions: ['dwg', 'dxf'] },
          { name: 'All Files (*.*)', extensions: ['*'] }
        ]
      });

      if (selected && selected.length > 0) {
        const parsedFiles: WorkFile[] = selected.map((item: any, idx: number) => {
          const ext = item.name.split('.').pop()?.toLowerCase() || '';
          let type: WorkFile['type'] = 'unknown';

          if (['jpg', 'jpeg', 'png', 'webp', 'bmp', 'svg'].includes(ext)) type = 'image';
          else if (ext === 'pdf') type = 'pdf';
          else if (['docx', 'xlsx', 'xls', 'txt'].includes(ext)) type = 'office';
          else if (['dxf', 'dwg'].includes(ext)) type = 'cad';

          const bytes = new Uint8Array(item.buffer);
          let previewUrl: string | undefined;

          if (type === 'image') {
            const blob = new Blob([bytes.slice() as BlobPart]);
            previewUrl = URL.createObjectURL(blob);
          }

          return {
            id: `${Date.now()}-${idx}-${item.name}`,
            name: item.name,
            size: item.size,
            type,
            extension: ext,
            bytes,
            previewUrl,
            rotation: 0
          };
        });

        setFiles((prev) => [...prev, ...parsedFiles]);
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.onchange = (e) => {
        const target = e.target as HTMLInputElement;
        if (target.files) handleIngestFiles(target.files);
      };
      input.click();
    }
  };

  // -------------------------------------------------------------
  // REORDERING & SORTING SUITE
  // -------------------------------------------------------------
  const moveItem = (index: number, direction: 'prev' | 'next') => {
    const targetIdx = direction === 'prev' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= files.length) return;
    const newFiles = [...files];
    const [moved] = newFiles.splice(index, 1);
    newFiles.splice(targetIdx, 0, moved);
    setFiles(newFiles);
    setSelectedFileIndex(targetIdx);
  };

  const moveToPosition = (fromIndex: number, targetPosition1Based: number) => {
    const targetIdx = Math.max(0, Math.min(files.length - 1, targetPosition1Based - 1));
    if (fromIndex === targetIdx) return;
    const newFiles = [...files];
    const [moved] = newFiles.splice(fromIndex, 1);
    newFiles.splice(targetIdx, 0, moved);
    setFiles(newFiles);
    setSelectedFileIndex(targetIdx);
  };

  const moveToFirst = (index: number) => moveToPosition(index, 1);
  const moveToLast = (index: number) => moveToPosition(index, files.length);

  const reverseOrder = () => {
    setFiles((prev) => [...prev].reverse());
    setSelectedFileIndex(null);
  };

  const sortByNameAsc = () => {
    setFiles((prev) =>
      [...prev].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
    );
    setSelectedFileIndex(null);
  };

  const sortByNameDesc = () => {
    setFiles((prev) =>
      [...prev].sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' }))
    );
    setSelectedFileIndex(null);
  };

  const handleDropToSlot = (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newFiles = [...files];
    const [moved] = newFiles.splice(draggedIndex, 1);
    newFiles.splice(targetIndex, 0, moved);
    setFiles(newFiles);
    setSelectedFileIndex(targetIndex);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const rotateImageItem = (index: number) => {
    setFiles((prev) =>
      prev.map((f, idx) => (idx === index ? { ...f, rotation: ((f.rotation || 0) + 90) % 360 } : f))
    );
  };

  const handleDragOverThrottled = (idx: number) => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      setDragOverIndex(idx);
      rafRef.current = null;
    });
  };

  const removeFile = (index: number) => {
    const fileToRemove = files[index];
    if (fileToRemove?.previewUrl) {
      URL.revokeObjectURL(fileToRemove.previewUrl);
    }
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
    if (selectedFileIndex === index) setSelectedFileIndex(null);
  };

  // When a single PDF is loaded, automatically inspect page count and load thumbnails once (cached by ID)
  useEffect(() => {
    if (isAllPdfs && files.length === 1) {
      const activePdfId = files[0].id;
      if (currentPdfIdRef.current === activePdfId) return; // already loaded, skip re-computation
      currentPdfIdRef.current = activePdfId;

      setIsPdfLoading(true);
      // ALWAYS pass cloned buffer to prevent worker detachment
      PdfPageStudioService.loadThumbnails(files[0].bytes.slice())
        .then((pages) => {
          setPdfPages(pages);
          setIsPdfLoading(false);
        })
        .catch(() => setIsPdfLoading(false));
    } else {
      currentPdfIdRef.current = null;
      setPdfPages([]);
    }
  }, [files, isAllPdfs]);

  // PDF Page Studio Reordering
  const movePdfPageItem = (index: number, direction: 'prev' | 'next') => {
    const targetIdx = direction === 'prev' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= pdfPages.length) return;
    const newPages = [...pdfPages];
    const [moved] = newPages.splice(index, 1);
    newPages.splice(targetIdx, 0, moved);
    setPdfPages(newPages);
  };

  const movePdfPageToPosition = (fromIndex: number, targetPos: number) => {
    const targetIdx = Math.max(0, Math.min(pdfPages.length - 1, targetPos - 1));
    if (fromIndex === targetIdx) return;
    const newPages = [...pdfPages];
    const [moved] = newPages.splice(fromIndex, 1);
    newPages.splice(targetIdx, 0, moved);
    setPdfPages(newPages);
  };

  const reversePdfPages = () => {
    setPdfPages((prev) => [...prev].reverse());
  };

  // -------------------------------------------------------------
  // ACTION HANDLERS (DIRECT EXPORT & PREVIEW)
  // -------------------------------------------------------------

  // 1. Images to PDF Album
  const handleImagesToPdf = async (mode: 'export' | 'preview' = 'export') => {
    setIsProcessing(true);
    setProgressStatus('Creating high-DPI PDF Album from arranged images...');
    try {
      const galleryItems = files.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        bytes: f.bytes.slice(),
        previewUrl: f.previewUrl || '',
        rotation: f.rotation || 0,
        width: 1200,
        height: 800
      }));

      const pdfBytes = await ImageConverter.galleryToPdf(galleryItems, {
        orientation: imageOrientation,
        margin: imageMargin,
        quality: imageQuality,
        filter: imageFilter,
        layout: imageLayout,
        watermark: watermarkText
      });
      const name = `Images_Collection_${new Date().toISOString().slice(0, 10)}.pdf`;

      if (mode === 'preview') {
        setPreviewPdf({ bytes: pdfBytes, name });
      } else {
        await saveExportedFile(pdfBytes, name, 'PDF Document (*.pdf)', 'pdf');
      }
    } catch (err: any) {
      alert(`Error creating PDF: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProgressStatus(null);
    }
  };

  // 2. Images to Word (.docx) with Exact Aspect Ratio Preservation
  const handleImagesToDocx = async () => {
    setIsProcessing(true);
    setProgressStatus('Synthesizing Word Document with true-scale images...');
    try {
      const galleryItems = files.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        bytes: f.bytes.slice(),
        previewUrl: f.previewUrl || '',
        rotation: f.rotation || 0,
        width: 1200,
        height: 800
      }));

      const docxBytes = await ImageConverter.imagesToDocx(galleryItems, 'Images Gallery Document');
      const filename = `Images_Doc_${new Date().toISOString().slice(0, 10)}.docx`;

      await saveExportedFile(
        docxBytes,
        filename,
        'Word Document (*.docx)',
        'docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
    } catch (err: any) {
      alert(`Error creating Word doc: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProgressStatus(null);
    }
  };

  // 3. PDF to Images (Single page -> <PdfName>.jpg; Multi-page -> <PdfName>/<PdfName>_Page_001.jpg)
  const handlePdfToImages = async (format: 'jpg' | 'png' = 'jpg') => {
    if (!files[0]) return;
    const targetFile = files[0];
    setIsProcessing(true);
    setProgressStatus('Rendering high-DPI page images...');

    try {
      const baseName = targetFile.name.replace(/\.pdf$/i, '');
      const { totalPages, images } = await ReverseConverter.renderPdfPagesToImages(
        targetFile.bytes.slice(),
        baseName,
        2.0,
        format,
        (curr, tot) => setProgressStatus(`Rendering page ${curr} of ${tot}...`)
      );

      // Single-page PDF rule: directly prompt to save <PdfName>.jpg
      if (totalPages === 1) {
        const single = images[0];
        await saveExportedFile(
          single.bytes,
          single.name,
          format === 'jpg' ? 'JPEG Image (*.jpg)' : 'PNG Image (*.png)',
          format,
          format === 'jpg' ? 'image/jpeg' : 'image/png'
        );
      } else {
        // Multi-page PDF rule: dedicated folder named after PDF
        if (window.electronAPI?.selectFolderDialog && window.electronAPI?.saveFilesBatch) {
          const selectedFolder = await window.electronAPI.selectFolderDialog();
          if (selectedFolder) {
            const batchPayload = images.map((img) => ({
              name: img.name,
              buffer: img.bytes.slice().buffer as ArrayBuffer
            }));

            const result = await window.electronAPI.saveFilesBatch({
              baseDir: selectedFolder,
              subFolder: baseName, // creates folder named after the PDF
              files: batchPayload
            });

            showToast(
              'Batch Export Complete',
              `Exported ${totalPages} images into folder "${baseName}"`,
              result.targetDir
            );
          }
        } else {
          // Web fallback: ZIP archive
          const zip = new JSZip();
          const folder = zip.folder(baseName) || zip;
          images.forEach((img) => folder.file(img.name, img.bytes));
          const zipBytes = await zip.generateAsync({ type: 'uint8array' });
          const zipName = `${baseName}_Images.zip`;
          await saveExportedFile(zipBytes, zipName, 'ZIP Archive (*.zip)', 'zip', 'application/zip');
        }
      }
    } catch (err: any) {
      alert(`Error extracting images: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProgressStatus(null);
    }
  };

  // 4. PDF to Word (.docx)
  const handlePdfToDocx = async () => {
    if (!files[0]) return;
    setIsProcessing(true);
    setProgressStatus('Reconstructing Word document flow and paragraphs...');
    try {
      const baseName = files[0].name.replace(/\.pdf$/i, '');
      const docxBytes = await ReverseConverter.pdfToDocx(files[0].bytes.slice(), baseName);
      const outFilename = `${baseName}_converted.docx`;

      await saveExportedFile(
        docxBytes,
        outFilename,
        'Word Document (*.docx)',
        'docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
    } catch (err: any) {
      alert(`Error converting to Word: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProgressStatus(null);
    }
  };

  // 5. PDF to Excel (.xlsx)
  const handlePdfToExcel = async () => {
    if (!files[0]) return;
    setIsProcessing(true);
    setProgressStatus('Extracting tabular datasets into Excel sheets...');
    try {
      const baseName = files[0].name.replace(/\.pdf$/i, '');
      const xlsxBytes = await ReverseConverter.pdfToExcel(files[0].bytes.slice(), baseName);
      const outFilename = `${baseName}_tables.xlsx`;

      await saveExportedFile(
        xlsxBytes,
        outFilename,
        'Excel Workbook (*.xlsx)',
        'xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    } catch (err: any) {
      alert(`Error converting to Excel: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProgressStatus(null);
    }
  };

  // 6. PDF Offline OCR Vision Text
  const handlePdfOcr = async () => {
    if (!files[0]) return;
    setIsProcessing(true);
    setProgressStatus('Running offline OCR vision on pages...');
    try {
      const baseName = files[0].name.replace(/\.pdf$/i, '');
      const text = await ReverseConverter.pdfToOcrText(files[0].bytes.slice(), (curr, tot, msg) => {
        setProgressStatus(msg);
      });
      const outFilename = `${baseName}_ocr_text.txt`;
      const textBytes = new TextEncoder().encode(text);
      await saveExportedFile(textBytes, outFilename, 'Text Document (*.txt)', 'txt', 'text/plain;charset=utf-8');
    } catch (err: any) {
      alert(`Error running OCR: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProgressStatus(null);
    }
  };

  // 7. Save Modified PDF Pages (Rotations, Deletions, Reorder)
  const handleSaveModifiedPdf = async (mode: 'export' | 'preview' = 'export') => {
    if (!files[0] || pdfPages.length === 0) return;
    setIsProcessing(true);
    setProgressStatus('Compiling modified pages in the exact sequence...');
    try {
      const baseName = files[0].name.replace(/\.pdf$/i, '');
      const modifiedBytes = await PdfPageStudioService.exportModifiedPdf(files[0].bytes.slice(), pdfPages);
      const outFilename = `${baseName}_Organized.pdf`;

      if (mode === 'preview') {
        setPreviewPdf({ bytes: modifiedBytes, name: outFilename });
      } else {
        await saveExportedFile(modifiedBytes, outFilename, 'PDF Document (*.pdf)', 'pdf');
      }
    } catch (err: any) {
      alert(`Error exporting PDF: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProgressStatus(null);
    }
  };

  // 8. Extract Selective Page Range
  const handleExtractPdfRange = async (mode: 'export' | 'preview' = 'export') => {
    if (!files[0] || !pdfRangeInput.trim()) return;
    setIsProcessing(true);
    setProgressStatus(`Extracting page range (${pdfRangeInput})...`);
    try {
      const baseName = files[0].name.replace(/\.pdf$/i, '');
      const rangeBytes = await PdfPageStudioService.extractPageRange(files[0].bytes.slice(), pdfRangeInput);
      const outFilename = `${baseName}_Pages_${pdfRangeInput.replace(/[^0-9-]/g, '_')}.pdf`;

      if (mode === 'preview') {
        setPreviewPdf({ bytes: rangeBytes, name: outFilename });
      } else {
        await saveExportedFile(rangeBytes, outFilename, 'PDF Document (*.pdf)', 'pdf');
      }
    } catch (err: any) {
      alert(`Error extracting range: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProgressStatus(null);
    }
  };

  // 9. Split PDF All Pages to ZIP
  const handleSplitPdfToZip = async () => {
    if (!files[0]) return;
    setIsProcessing(true);
    setProgressStatus('Splitting PDF into single-page files...');
    try {
      const baseName = files[0].name.replace(/\.pdf$/i, '');
      const zipBytes = await PdfPageStudioService.splitIntoZip(files[0].bytes.slice(), baseName);
      const outFilename = `${baseName}_Split_Pages.zip`;

      await saveExportedFile(zipBytes, outFilename, 'ZIP Archive (*.zip)', 'zip', 'application/zip');
    } catch (err: any) {
      alert(`Error splitting PDF: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProgressStatus(null);
    }
  };

  // 10. Office Convert All (Batch)
  const handleOfficeConvertAll = async () => {
    setIsProcessing(true);
    setProgressStatus('Converting Office files to PDFs...');
    try {
      const results: Array<{ name: string; bytes: Uint8Array }> = [];
      for (const f of files) {
        let pdfBytes: Uint8Array;
        const safeBytes = f.bytes.slice();
        if (f.extension === 'docx') {
          pdfBytes = await OfficeConverter.docxToPdf(safeBytes, f.name);
        } else if (f.extension === 'xlsx' || f.extension === 'xls') {
          pdfBytes = await OfficeConverter.xlsxToPdf(safeBytes, f.name);
        } else {
          pdfBytes = await OfficeConverter.textToPdf(safeBytes, f.name);
        }
        results.push({ name: `${f.name.replace(/\.[^/.]+$/, '')}.pdf`, bytes: pdfBytes });
      }

      if (window.electronAPI?.selectFolderDialog && window.electronAPI?.saveFilesBatch) {
        const folder = await window.electronAPI.selectFolderDialog();
        if (folder) {
          await window.electronAPI.saveFilesBatch({
            baseDir: folder,
            files: results.map((r) => ({ name: r.name, buffer: r.bytes.slice().buffer as ArrayBuffer }))
          });
          showToast('Batch Conversion Complete', `Saved ${results.length} converted PDFs`, folder);
        }
      } else {
        const zip = new JSZip();
        results.forEach((r) => zip.file(r.name, r.bytes));
        const zipBytes = await zip.generateAsync({ type: 'uint8array' });
        await saveExportedFile(zipBytes, 'Converted_Office_PDFs.zip', 'ZIP Archive (*.zip)', 'zip', 'application/zip');
      }
    } catch (err: any) {
      alert(`Error converting office files: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProgressStatus(null);
    }
  };

  // 11. CAD DWG / DXF to Blueprint PDF
  const handleCadToPdf = async (mode: 'export' | 'preview' = 'export') => {
    if (!files[0]) return;
    setIsProcessing(true);
    setProgressStatus('Parsing AutoCAD vector drawing...');
    try {
      const baseName = files[0].name.replace(/\.(dwg|dxf)$/i, '');
      const pdfBytes = await CadConverter.cadToPdf(files[0].bytes.slice(), files[0].name, {
        theme: cadTheme,
        paperSize: cadPaperSize,
        orientation: 'landscape',
        scaleToFit: true
      });
      const name = `${baseName}_${cadTheme.toUpperCase()}.pdf`;

      if (mode === 'preview') {
        setPreviewPdf({ bytes: pdfBytes, name });
      } else {
        await saveExportedFile(pdfBytes, name, 'PDF Document (*.pdf)', 'pdf');
      }
    } catch (err: any) {
      alert(`Error converting CAD drawing: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProgressStatus(null);
    }
  };

  // 12. Universal Fusion: Merge heterogeneous files in visual order
  const handleUniversalFusion = async (mode: 'export' | 'preview' = 'export') => {
    setIsProcessing(true);
    setProgressStatus('Fusing multi-format documents in exact sequential order...');
    try {
      const queueItems = files.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        type: (f.extension === 'docx' ? 'docx' : f.extension === 'xlsx' || f.extension === 'xls' ? 'xlsx' : f.type === 'image' ? 'jpg' : f.extension === 'dxf' ? 'dxf' : f.type === 'pdf' ? 'pdf' : 'txt') as any,
        bytes: f.bytes.slice(),
        status: 'queued' as const
      }));

      const fusedBytes = await UniversalMerger.fuseMultipleDocuments(queueItems, (curr, tot, name) => {
        setProgressStatus(`Fusing (${curr}/${tot}): ${name}...`);
      });

      const name = `DocuFlow_Master_${new Date().toISOString().slice(0, 10)}.pdf`;

      if (mode === 'preview') {
        setPreviewPdf({ bytes: fusedBytes, name });
      } else {
        await saveExportedFile(fusedBytes, name, 'PDF Document (*.pdf)', 'pdf');
      }
    } catch (err: any) {
      alert(`Fusion failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProgressStatus(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
  };

  const totalPayloadSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] text-slate-800 overflow-hidden font-sans relative">
      {/* Global Drag Backdrop Overlay */}
      {isGlobalDragging && (
        <div className="absolute inset-0 z-50 bg-sky-950/40 backdrop-blur-xs flex flex-col items-center justify-center p-8 pointer-events-none transition-all">
          <div className="bg-white/95 border-2 border-dashed border-sky-500 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center max-w-sm animate-in zoom-in-95 duration-150">
            <div className="size-16 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center mb-3.5 shadow-sm animate-bounce">
              <UploadCloud className="size-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Drop Files to Ingest</h3>
            <p className="text-xs text-slate-500 mt-1">
              Files will be appended preserving your selection order
            </p>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* STATE A: NO FILES LOADED - PROFESSIONAL STUDIO WELCOME           */}
      {/* ---------------------------------------------------------------- */}
      {files.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 custom-scrollbar overflow-y-auto">
          <div className="w-full max-w-4xl flex flex-col items-center text-center space-y-6">
            
            {/* Studio Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200/90 shadow-2xs text-xs font-semibold text-slate-700 animate-in fade-in duration-300">
              <span className="size-2 rounded-full bg-sky-500"></span>
              <span className="font-bold text-slate-900">DocuFlow Studio Pro</span>
              <span className="text-slate-300">•</span>
              <span className="font-mono text-slate-500 text-[11px]">v26.10.30</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-600 font-medium">Burhanuddin Sounasath</span>
            </div>

            {/* Title & Tagline */}
            <div className="space-y-2 max-w-2xl">
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
                Precision Document Studio
              </h1>
              <p className="text-sm md:text-base text-slate-500 leading-relaxed">
                Drop your files to begin. DocuFlow strictly preserves your <strong className="text-slate-800 font-semibold">exact selection order</strong> and displays <strong className="text-slate-800 font-semibold">only the relevant conversion tools</strong>.
              </p>
            </div>

            {/* Master Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsGlobalDragging(true);
              }}
              onDragLeave={() => setIsGlobalDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsGlobalDragging(false);
                handleIngestFiles(e.dataTransfer.files);
              }}
              onClick={handleBrowseFiles}
              className={`w-full p-10 md:p-12 rounded-3xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center relative overflow-hidden group shadow-sm hover:shadow-xl ${
                isGlobalDragging
                  ? 'border-sky-500 bg-sky-50/70 ring-4 ring-sky-200 scale-101'
                  : 'border-slate-300 hover:border-sky-500 bg-white hover:bg-sky-50/30'
              }`}
            >
              {/* Animated Glow on Hover */}
              <div className="absolute inset-0 bg-radial from-sky-100/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

              <div className="size-20 rounded-3xl bg-sky-50 group-hover:bg-sky-100 text-sky-600 flex items-center justify-center mb-5 transition-transform group-hover:scale-105 border border-sky-100 shadow-xs">
                <UploadCloud className="size-10 text-sky-600" />
              </div>

              <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
                Drag & Drop Files Here or Click to Browse
              </h2>
              <p className="text-xs text-slate-500 max-w-lg mb-6 leading-relaxed">
                Images, PDFs, Word, Excel, CAD drawings, or plain text. Rearrange visually with arrows or drag-and-drop, then export instantly to disk.
              </p>

              {/* Supported Format Pills */}
              <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
                <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-[11px] font-semibold border border-purple-200/80">
                  🖼️ JPG / PNG / WEBP Photos
                </span>
                <span className="px-3 py-1 rounded-full bg-red-50 text-red-700 text-[11px] font-semibold border border-red-200/80">
                  📑 PDF Documents
                </span>
                <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold border border-blue-200/80">
                  📄 Word (.docx)
                </span>
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200/80">
                  📊 Excel (.xlsx, .xls)
                </span>
                <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-semibold border border-amber-200/80">
                  📐 AutoCAD (.dwg, .dxf)
                </span>
              </div>

              <button className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-md shadow-sky-600/20 transition flex items-center gap-2">
                <Plus className="size-4" />
                <span>Select Files in Order</span>
              </button>
            </div>

            {/* 4 Professional Capability Showcase Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full text-left pt-2">
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs hover:shadow-sm transition">
                <div className="size-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2.5 border border-purple-100">
                  <ImageIcon className="size-4.5" />
                </div>
                <h3 className="text-xs font-bold text-slate-800">Photo to PDF & Word</h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Sequence images in exact selection order. Export high-DPI PDF albums or true-scale Word docs.
                </p>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs hover:shadow-sm transition">
                <div className="size-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-2.5 border border-red-100">
                  <FileText className="size-4.5" />
                </div>
                <h3 className="text-xs font-bold text-slate-800">PDF Page Studio</h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Visual page table. Rotate, delete, extract ranges, and split pages into individual files.
                </p>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs hover:shadow-sm transition">
                <div className="size-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-2.5 border border-sky-100">
                  <RefreshCw className="size-4.5" />
                </div>
                <h3 className="text-xs font-bold text-slate-800">Reverse Converter</h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  PDF to high-res JPG/PNG folder, editable Word .docx, and structured Excel tables.
                </p>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs hover:shadow-sm transition">
                <div className="size-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2.5 border border-amber-100">
                  <Sparkles className="size-4.5" />
                </div>
                <h3 className="text-xs font-bold text-slate-800">Universal Fusion</h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Merge heterogeneous files (PDFs, photos, Excel, CAD) into one unified master PDF.
                </p>
              </div>
            </div>

          </div>
        </div>
      ) : (
        /* ---------------------------------------------------------------- */
        /* STATE B: FILES LOADED - PROFESSIONAL STUDIO WORKSPACE           */
        /* ---------------------------------------------------------------- */
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* TOP CONTROL BAR: Stats, Sorting, Add, Clear, View Mode */}
          <div className="bg-white border-b border-slate-200/90 px-6 py-2.5 shadow-2xs shrink-0 flex flex-wrap items-center justify-between gap-3 select-none">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Layers className="size-4 text-sky-600" />
                Arranged Queue ({files.length} {files.length === 1 ? 'file' : 'files'} • {formatSize(totalPayloadSize)})
              </span>
              <span className="text-[11px] text-emerald-700 font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 hidden sm:inline-flex items-center gap-1">
                <Check className="size-3 text-emerald-600" /> Selection Order Preserved
              </span>
              <span className="text-[11px] text-slate-500 bg-slate-100 border border-slate-200/80 px-2.5 py-0.5 rounded-full hidden md:inline-flex items-center gap-1.5 font-medium">
                <span className="text-sky-600 font-bold">Keys:</span>
                <span>← → reorder</span>
                <span className="text-slate-300">•</span>
                <span>R rotate</span>
                <span className="text-slate-300">•</span>
                <span>Del remove</span>
                <span className="text-slate-300">•</span>
                <span>Ctrl+V paste</span>
              </span>
            </div>

            {/* Quick Sorting Helpers & View Toggle */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={reverseOrder}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg border border-slate-200 transition flex items-center gap-1"
                title="Reverse Order (1 ⇄ Last)"
              >
                <ArrowLeftRight className="size-3 text-sky-600" />
                <span>Reverse (⇄)</span>
              </button>

              <button
                onClick={sortByNameAsc}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg border border-slate-200 transition"
                title="Sort A to Z"
              >
                <span>A → Z</span>
              </button>

              <button
                onClick={sortByNameDesc}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg border border-slate-200 transition"
                title="Sort Z to A"
              >
                <span>Z → A</span>
              </button>

              <div className="h-4 w-px bg-slate-200 mx-1" />

              {/* View Mode Toggle: Grid Light Table vs Horizontal Strip */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1 rounded-md transition ${viewMode === 'grid' ? 'bg-white shadow-xs text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                  title="Spacious Grid View"
                >
                  <LayoutGrid className="size-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('strip')}
                  className={`p-1 rounded-md transition ${viewMode === 'strip' ? 'bg-white shadow-xs text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                  title="Filmstrip View"
                >
                  <List className="size-3.5" />
                </button>
              </div>

              <div className="h-4 w-px bg-slate-200 mx-1" />

              <button
                onClick={handleBrowseFiles}
                className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold rounded-lg border border-sky-200 transition flex items-center gap-1"
              >
                <Plus className="size-3.5" />
                <span>Add Files</span>
              </button>

              <button
                onClick={() => { setFiles([]); setSelectedFileIndex(null); }}
                className="px-3 py-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 text-xs font-semibold rounded-lg transition"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* MAIN STAGE (FLEX-1): Large Visual Light Table with Big Thumbnails */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-[#F8FAFC] relative">
            
            {/* Animated Number Slot Bar during Drag & Drop */}
            {draggedIndex !== null && (
              <div className="sticky top-0 z-20 mb-4 py-2 px-3 bg-sky-50/95 backdrop-blur-md border border-sky-300 rounded-2xl flex items-center gap-2 overflow-x-auto shadow-md">
                <span className="text-xs font-bold text-sky-800 mr-2 flex items-center gap-1 shrink-0">
                  <ArrowRight className="size-3.5" /> Drop to position:
                </span>
                {files.map((_, slotIdx) => (
                  <button
                    key={slotIdx}
                    onDragOver={(e) => {
                      e.preventDefault();
                      handleDragOverThrottled(slotIdx);
                    }}
                    onDrop={() => handleDropToSlot(slotIdx)}
                    className={`size-8 rounded-xl text-xs font-mono font-bold flex items-center justify-center shrink-0 transition-all ${
                      dragOverIndex === slotIdx
                        ? 'bg-sky-600 text-white scale-110 shadow-md ring-2 ring-sky-300'
                        : slotIdx === draggedIndex
                        ? 'bg-sky-200 text-sky-800'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-sky-100'
                    }`}
                  >
                    #{slotIdx + 1}
                  </button>
                ))}
              </div>
            )}

            {/* Big Spacious Gallery Cards */}
            <div
              ref={filesContainerRef}
              className={`${
                viewMode === 'grid'
                  ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'
                  : 'flex items-center gap-4 overflow-x-auto pb-4 pt-1'
              }`}
            >
              {files.map((file, idx) => {
                const isSelected = selectedFileIndex === idx;
                const isBeingDragged = draggedIndex === idx;
                const isDropTarget = dragOverIndex === idx;

                return (
                  <div
                    key={file.id}
                    draggable
                    onDragStart={() => setDraggedIndex(idx)}
                    onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      handleDragOverThrottled(idx);
                    }}
                    onDrop={() => handleDropToSlot(idx)}
                    onClick={() => setSelectedFileIndex(idx)}
                    tabIndex={0}
                    className={`group relative rounded-2xl border p-2.5 cursor-grab active:cursor-grabbing transition-all select-none hardware-accelerated flex flex-col justify-between ${
                      viewMode === 'strip' ? 'shrink-0 w-52' : 'w-full'
                    } ${
                      isBeingDragged
                        ? 'opacity-40 scale-95 border-sky-500 bg-sky-50 ring-2 ring-sky-400 shadow-xl'
                        : isDropTarget
                        ? 'border-sky-500 bg-sky-50/60 scale-102 ring-2 ring-sky-300 shadow-lg'
                        : isSelected
                        ? 'bg-sky-50/40 border-sky-400 ring-2 ring-sky-300 shadow-md'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md'
                    }`}
                  >
                    {/* Top Header: Position Selector & Trash */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={idx + 1}
                          onChange={(e) => {
                            e.stopPropagation();
                            moveToPosition(idx, parseInt(e.target.value, 10));
                          }}
                          className="text-[11px] font-mono font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-md px-2 py-0.5 border-0 focus:outline-none cursor-pointer shadow-2xs transition"
                          title="Click to jump to another position"
                        >
                          {files.map((_, optIdx) => (
                            <option key={optIdx} value={optIdx + 1}>
                              #{optIdx + 1}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(idx);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                        title="Remove file"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>

                    {/* Big Thumbnail Display */}
                    <div className="h-36 sm:h-44 w-full rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden my-1 relative group/thumb">
                      {file.type === 'image' && file.previewUrl ? (
                        <img
                          src={file.previewUrl}
                          alt={file.name}
                          style={{ transform: `rotate(${file.rotation || 0}deg)` }}
                          className="h-full w-full object-contain transition-transform duration-200"
                        />
                      ) : file.type === 'pdf' ? (
                        <div className="flex flex-col items-center gap-2 text-rose-500">
                          <FileText className="size-10" />
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">PDF Doc</span>
                        </div>
                      ) : file.extension === 'docx' ? (
                        <div className="flex flex-col items-center gap-2 text-blue-500">
                          <FileText className="size-10" />
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Word Doc</span>
                        </div>
                      ) : file.extension === 'xlsx' || file.extension === 'xls' ? (
                        <div className="flex flex-col items-center gap-2 text-emerald-500">
                          <FileSpreadsheet className="size-10" />
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Excel Sheet</span>
                        </div>
                      ) : file.extension === 'dxf' ? (
                        <div className="flex flex-col items-center gap-2 text-amber-500">
                          <Compass className="size-10" />
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">AutoCAD DXF</span>
                        </div>
                      ) : (
                        <FileText className="size-10 text-slate-400" />
                      )}
                    </div>

                    {/* File Title & Size */}
                    <div className="pt-1">
                      <div className="truncate text-xs font-bold text-slate-800" title={file.name}>
                        {file.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {formatSize(file.size)}
                      </div>
                    </div>

                    {/* Bottom Action Row: Directional Arrows, First/Last, Rotate */}
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100">
                      <div className="flex items-center gap-0.5">
                        <button
                          disabled={idx === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveToFirst(idx);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 rounded"
                          title="Move to First (|←)"
                        >
                          <ChevronsLeft className="size-3.5" />
                        </button>
                        <button
                          disabled={idx === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveItem(idx, 'prev');
                          }}
                          className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-20 hover:bg-slate-100 rounded"
                          title={layoutDirection === 'horizontal' ? 'Move Left (Earlier)' : 'Move Up (Earlier)'}
                        >
                          {layoutDirection === 'horizontal' ? (
                            <ChevronLeft className="size-4" />
                          ) : (
                            <ChevronUp className="size-4" />
                          )}
                        </button>
                        <button
                          disabled={idx === files.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveItem(idx, 'next');
                          }}
                          className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-20 hover:bg-slate-100 rounded"
                          title={layoutDirection === 'horizontal' ? 'Move Right (Later)' : 'Move Down (Later)'}
                        >
                          {layoutDirection === 'horizontal' ? (
                            <ChevronRight className="size-4" />
                          ) : (
                            <ChevronDown className="size-4" />
                          )}
                        </button>
                        <button
                          disabled={idx === files.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveToLast(idx);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 rounded"
                          title="Move to Last (→|)"
                        >
                          <ChevronsRight className="size-3.5" />
                        </button>
                      </div>

                      {file.type === 'image' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            rotateImageItem(idx);
                          }}
                          className="p-1 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded transition"
                          title="Rotate 90° clockwise"
                        >
                          <RotateCw className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* BOTTOM DOCK (COMPACT STUDIO CONTROL BAR): Takes minimal vertical height */}
          <div className="bg-white border-t border-slate-200/90 px-6 py-3 shadow-lg shrink-0 z-10">
            {/* Telemetry / Status indicator if processing */}
            {progressStatus && (
              <div className="mb-2 p-2 px-3 bg-sky-50 border border-sky-200 rounded-xl flex items-center gap-2.5 text-sky-800 text-xs font-semibold shadow-xs animate-in fade-in">
                <Loader2 className="size-3.5 animate-spin text-sky-600" />
                <span>{progressStatus}</span>
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* CASE 1: ONLY IMAGES (COMPACT SUITE)                          */}
            {/* ------------------------------------------------------------ */}
            {isAllImages && (
              <div className="flex flex-col gap-3">
                {/* Upper Row: Fine-tuning Tools */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Layout Grid (Photos per Page) */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-600">Layout:</span>
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        {([1, 2, 4] as const).map((l) => (
                          <button
                            key={l}
                            onClick={() => setImageLayout(l)}
                            className={`px-2 py-0.5 text-xs font-semibold rounded-md transition ${
                              imageLayout === l
                                ? 'bg-white text-sky-700 shadow-xs font-bold'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title={l === 1 ? '1 Photo per Page' : l === 2 ? '2 Photos / Page (Front & Back IDs)' : '4 Photos / Page (Grid)'}
                          >
                            {l === 1 ? '1/Page' : l === 2 ? '2/Page' : '4/Page'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Compression / Target Quality */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-600">Quality:</span>
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        {[
                          { id: 'max', label: 'Max (300DPI)' },
                          { id: 'balanced', label: 'Web (150DPI)' },
                          { id: 'compact', label: 'Compact (<2MB)' }
                        ].map((q) => (
                          <button
                            key={q.id}
                            onClick={() => setImageQuality(q.id as any)}
                            className={`px-2 py-0.5 text-xs font-semibold rounded-md transition ${
                              imageQuality === q.id
                                ? 'bg-white text-sky-700 shadow-xs font-bold'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            {q.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Document Filter */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-600">Filter:</span>
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        {[
                          { id: 'none', label: 'Color' },
                          { id: 'grayscale', label: 'Grayscale' },
                          { id: 'bw', label: 'B&W Scan' }
                        ].map((f) => (
                          <button
                            key={f.id}
                            onClick={() => setImageFilter(f.id as any)}
                            className={`px-2 py-0.5 text-xs font-semibold rounded-md transition ${
                              imageFilter === f.id
                                ? 'bg-white text-sky-700 shadow-xs font-bold'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title={f.id === 'bw' ? 'CamScanner-style clean document enhancement' : ''}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Watermark Toggle */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setShowWatermarkInput(!showWatermarkInput)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                          watermarkText.trim()
                            ? 'bg-amber-50 text-amber-800 border-amber-300 font-bold'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {watermarkText.trim() ? `Watermark: "${watermarkText}"` : '+ Watermark'}
                      </button>
                    </div>
                  </div>

                  {/* Orientation & Margins */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-bold text-slate-600">Orientation:</span>
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        {(['auto', 'portrait', 'landscape'] as const).map((o) => (
                          <button
                            key={o}
                            onClick={() => setImageOrientation(o)}
                            className={`px-2 py-0.5 text-xs font-semibold capitalize rounded-md transition ${
                              imageOrientation === o
                                ? 'bg-white text-sky-700 shadow-xs font-bold'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-bold text-slate-600">Margin:</span>
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        {[
                          { label: '0', val: 0 },
                          { label: '15', val: 15 },
                          { label: '30', val: 30 }
                        ].map((m) => (
                          <button
                            key={m.val}
                            onClick={() => setImageMargin(m.val)}
                            className={`px-2 py-0.5 text-xs font-semibold rounded-md transition ${
                              imageMargin === m.val
                                ? 'bg-white text-sky-700 shadow-xs font-bold'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Popover / Input for Watermark */}
                {showWatermarkInput && (
                  <div className="flex items-center gap-2 p-2 bg-amber-50/70 border border-amber-200 rounded-xl animate-in fade-in">
                    <span className="text-xs font-bold text-amber-800 shrink-0">Watermark Text:</span>
                    <input
                      type="text"
                      value={watermarkText}
                      onChange={(e) => setWatermarkText(e.target.value)}
                      placeholder="e.g. CONFIDENTIAL, DRAFT, FOR VERIFICATION ONLY"
                      className="flex-1 px-3 py-1 bg-white border border-amber-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-400"
                    />
                    {watermarkText && (
                      <button
                        onClick={() => setWatermarkText('')}
                        className="px-2 py-1 text-xs text-amber-700 hover:text-rose-600 rounded"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      onClick={() => setShowWatermarkInput(false)}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg shadow-2xs"
                    >
                      Done
                    </button>
                  </div>
                )}

                {/* Lower Row: Action Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-1 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400 mr-auto hidden sm:inline">
                    💡 Tip: Press <strong className="font-mono text-slate-700">Ctrl + V</strong> anywhere to paste screenshots directly.
                  </span>

                  <button
                    onClick={() => handleImagesToPdf('preview')}
                    disabled={isProcessing}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition flex items-center gap-1.5"
                  >
                    <Eye className="size-4 text-slate-600" />
                    <span>Preview</span>
                  </button>

                  <button
                    onClick={handleImagesToDocx}
                    disabled={isProcessing}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                    title="Export to Word with 100% natural aspect ratio"
                  >
                    <FileText className="size-4" />
                    <span>Convert to Word (.docx)</span>
                  </button>

                  <button
                    onClick={() => handleImagesToPdf('export')}
                    disabled={isProcessing}
                    className="px-5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-md shadow-sky-600/20 transition flex items-center gap-2"
                  >
                    <Download className="size-4" />
                    <span>Export as PDF Album</span>
                  </button>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* CASE 2: ONLY PDF DOCUMENTS (COMPACT SUITE)                   */}
            {/* ------------------------------------------------------------ */}
            {isAllPdfs && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <FileText className="size-4 text-rose-600" />
                      PDF Engineering Tools:
                    </span>
                    <button
                      onClick={() => setShowPdfPageStudio(!showPdfPageStudio)}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg border transition flex items-center gap-1.5 ${
                        showPdfPageStudio
                          ? 'bg-rose-50 text-rose-700 border-rose-300 font-bold'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      <Layers className="size-3.5" />
                      <span>{showPdfPageStudio ? 'Hide Page Studio' : 'Open Page Studio'}</span>
                    </button>
                  </div>

                  {/* Direct Export Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handlePdfToImages('jpg')}
                      disabled={isProcessing}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                    >
                      <Download className="size-3.5" />
                      <span>Export to JPG</span>
                    </button>

                    <button
                      onClick={() => handlePdfToImages('png')}
                      disabled={isProcessing}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 transition flex items-center gap-1.5"
                    >
                      <Download className="size-3.5" />
                      <span>Export to PNG</span>
                    </button>

                    <button
                      onClick={handlePdfToDocx}
                      disabled={isProcessing}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                    >
                      <Download className="size-3.5" />
                      <span>Export to Word</span>
                    </button>

                    <button
                      onClick={handlePdfToExcel}
                      disabled={isProcessing}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                    >
                      <Download className="size-3.5" />
                      <span>Export to Excel</span>
                    </button>

                    <button
                      onClick={handlePdfOcr}
                      disabled={isProcessing}
                      className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                    >
                      <ScanText className="size-3.5" />
                      <span>OCR Text</span>
                    </button>

                    <button
                      onClick={handleSplitPdfToZip}
                      disabled={isProcessing}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition"
                    >
                      Split ZIP
                    </button>
                  </div>
                </div>

                {/* Collapsible PDF Page Studio Drawer */}
                {showPdfPageStudio && pdfPages.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">
                        Reorder or delete pages ({pdfPages.length} total):
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={reversePdfPages}
                          className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded-lg border border-slate-200"
                        >
                          Reverse
                        </button>
                        <button
                          onClick={() => handleSaveModifiedPdf('preview')}
                          className="px-3 py-1 bg-slate-100 text-slate-700 text-xs rounded-lg border border-slate-200 flex items-center gap-1"
                        >
                          <Eye className="size-3 text-slate-500" /> Preview
                        </button>
                        <button
                          onClick={() => handleSaveModifiedPdf('export')}
                          className="px-4 py-1 bg-rose-600 text-white text-xs font-bold rounded-lg shadow-xs"
                        >
                          Save Organized PDF
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                      {pdfPages.map((page, idx) => (
                        <div
                          key={page.pageNum}
                          className={`rounded-xl border p-1.5 flex flex-col justify-between ${
                            page.isDeleted ? 'opacity-30 bg-rose-50 border-rose-300' : 'bg-white border-slate-200 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-mono font-bold bg-slate-800 text-white px-1.5 py-0.2 rounded">
                              P.{idx + 1}
                            </span>
                            <button
                              onClick={() => {
                                setPdfPages((prev) =>
                                  prev.map((p, pIdx) => (pIdx === idx ? { ...p, isDeleted: !p.isDeleted } : p))
                                );
                              }}
                              className="text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>

                          <div className="h-20 w-full flex items-center justify-center overflow-hidden my-1">
                            {page.thumbnailUrl ? (
                              <img
                                src={page.thumbnailUrl}
                                alt={`Page ${page.pageNum}`}
                                style={{ transform: `rotate(${page.rotation || 0}deg)` }}
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <FileText className="size-6 text-slate-300" />
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                            <button
                              disabled={idx === 0}
                              onClick={() => movePdfPageItem(idx, 'prev')}
                              className="text-slate-500 disabled:opacity-20"
                            >
                              <ChevronLeft className="size-3" />
                            </button>
                            <button
                              onClick={() => {
                                setPdfPages((prev) =>
                                  prev.map((p, pIdx) =>
                                    pIdx === idx ? { ...p, rotation: ((p.rotation || 0) + 90) % 360 } : p
                                  )
                                );
                              }}
                              className="text-slate-500 hover:text-amber-600"
                              title="Rotate 90°"
                            >
                              <RotateCw className="size-3" />
                            </button>
                            <button
                              disabled={idx === pdfPages.length - 1}
                              onClick={() => movePdfPageItem(idx, 'next')}
                              className="text-slate-500 disabled:opacity-20"
                            >
                              <ChevronRight className="size-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* CASE 3: ONLY OFFICE DOCUMENTS (COMPACT SUITE)                */}
            {/* ------------------------------------------------------------ */}
            {isAllOffice && (
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Office Conversion Suite</h4>
                  <p className="text-[11px] text-slate-500">Convert Word (.docx) & Excel (.xlsx) files to high-fidelity PDFs.</p>
                </div>
                <button
                  onClick={handleOfficeConvertAll}
                  disabled={isProcessing}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <Download className="size-4" />
                  <span>Convert All to Individual PDFs</span>
                </button>
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* CASE 4: ONLY CAD DXF (COMPACT SUITE)                         */}
            {/* ------------------------------------------------------------ */}
            {isAllCad && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-600">Theme:</span>
                    {(['blueprint', 'monochrome', 'layers'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setCadTheme(t)}
                        className={`px-2.5 py-1 text-xs capitalize rounded-md transition ${
                          cadTheme === t ? 'bg-amber-100 text-amber-800 font-bold border border-amber-300' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-600">Size:</span>
                    {(['a4', 'a3', 'a2', 'a1'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setCadPaperSize(s)}
                        className={`px-2 py-1 text-xs uppercase rounded-md transition ${
                          cadPaperSize === s ? 'bg-amber-100 text-amber-800 font-bold border border-amber-300' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCadToPdf('preview')}
                    disabled={isProcessing}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition flex items-center gap-1.5"
                  >
                    <Eye className="size-4 text-slate-600" />
                    <span>Preview</span>
                  </button>
                  <button
                    onClick={() => handleCadToPdf('export')}
                    disabled={isProcessing}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                  >
                    <Download className="size-4" />
                    <span>Export Blueprint PDF</span>
                  </button>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* CASE 5: MIXED MULTI-FORMAT (FUSION MODE)                     */}
            {/* ------------------------------------------------------------ */}
            {isMixed && (
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="size-4 text-sky-600" />
                    Universal Multi-Format Fusion
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Merges {files.length} diverse files in the exact sequential order (#1, #2...) arranged above.
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => handleUniversalFusion('preview')}
                    disabled={isProcessing}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition flex items-center gap-1.5"
                  >
                    <Eye className="size-4 text-slate-600" />
                    <span>Preview Fusion</span>
                  </button>

                  <button
                    onClick={() => handleUniversalFusion('export')}
                    disabled={isProcessing}
                    className="px-5 py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-md shadow-sky-600/20 transition flex items-center gap-2"
                  >
                    <Download className="size-4" />
                    <span>Fuse All into Master PDF</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Floating Export Toast Notification */}
      {toast && (
        <div className="fixed bottom-10 right-6 z-50 bg-white border border-slate-200 rounded-2xl p-4 shadow-xl flex items-center gap-3.5 max-w-md animate-in slide-in-from-bottom-5 duration-300">
          <div className="size-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
            <CheckCircle2 className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-slate-900">{toast.title}</h4>
            <p className="text-[11px] text-slate-500 truncate" title={toast.message}>
              {toast.message}
            </p>
          </div>
          {toast.filePath && window.electronAPI?.revealInFolder && (
            <button
              onClick={() => window.electronAPI?.revealInFolder(toast.filePath!)}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg border border-slate-200 transition shrink-0 flex items-center gap-1"
            >
              <FolderOpen className="size-3.5 text-slate-600" />
              <span>Show</span>
            </button>
          )}
          <button
            onClick={() => setToast(null)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Instant PDF Preview Modal */}
      {previewPdf && (
        <PdfPreviewModal
          pdfBytes={previewPdf.bytes}
          filename={previewPdf.name}
          onClose={() => setPreviewPdf(null)}
          onSave={async () => {
            await saveExportedFile(previewPdf.bytes, previewPdf.name, 'PDF Document (*.pdf)', 'pdf');
          }}
        />
      )}
    </div>
  );
};
