import * as pdfjsLib from 'pdfjs-dist';

// Configure workerSrc globally once for web, desktop (Electron), and mobile
if (typeof window !== 'undefined') {
  try {
    const isFileProtocol = window.location.protocol === 'file:';
    if (isFileProtocol) {
      // In Electron / file protocol, use relative or CDN fallback so workers are not blocked by CORS
      pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.mjs';
    } else {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('/pdf.worker.min.mjs', window.location.href).href;
    }
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
  }
}

export { pdfjsLib };

/**
 * Robust document loader that works seamlessly on modern and legacy browsers
 */
export function getSafePdfDocument(options: {
  data: Uint8Array | ArrayBuffer;
  password?: string;
  cMapUrl?: string;
  cMapPacked?: boolean;
}) {
  const safeData = options.data instanceof Uint8Array ? options.data.slice() : new Uint8Array(options.data).slice();
  return pdfjsLib.getDocument({
    data: safeData,
    password: options.password,
    cMapUrl: options.cMapUrl || 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: options.cMapPacked ?? true,
  });
}
