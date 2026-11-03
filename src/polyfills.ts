/**
 * PrintMate Browser Compatibility Polyfills
 * Ensures flawless execution across modern browsers and legacy browsers
 * (including Windows 7 Chrome 109 and Firefox 115 ESR).
 */

// 1. Promise.withResolvers (Required by PDF.js v4+ / pdfjs-dist)
if (typeof Promise !== 'undefined' && typeof (Promise as any).withResolvers === 'undefined') {
  (Promise as any).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// 2. Object.hasOwn
if (typeof Object !== 'undefined' && typeof (Object as any).hasOwn === 'undefined') {
  (Object as any).hasOwn = function (object: any, property: PropertyKey): boolean {
    if (object == null) {
      throw new TypeError('Cannot convert undefined or null to object');
    }
    return Object.prototype.hasOwnProperty.call(Object(object), property);
  };
}

// 3. Array.prototype.findLast and findLastIndex
if (typeof Array !== 'undefined') {
  if (!Array.prototype.findLast) {
    Array.prototype.findLast = function (predicate: any, thisArg?: any) {
      for (let i = this.length - 1; i >= 0; i--) {
        if (predicate.call(thisArg, this[i], i, this)) return this[i];
      }
      return undefined;
    };
  }
  if (!Array.prototype.findLastIndex) {
    Array.prototype.findLastIndex = function (predicate: any, thisArg?: any) {
      for (let i = this.length - 1; i >= 0; i--) {
        if (predicate.call(thisArg, this[i], i, this)) return i;
      }
      return -1;
    };
  }
  if (!Array.prototype.at) {
    Array.prototype.at = function (n: number) {
      n = Math.trunc(n) || 0;
      if (n < 0) n += this.length;
      if (n < 0 || n >= this.length) return undefined;
      return this[n];
    };
  }
}

// 4. crypto.randomUUID
if (typeof window !== 'undefined') {
  if (!window.crypto) {
    (window as any).crypto = {};
  }
  if (!window.crypto.randomUUID) {
    window.crypto.randomUUID = function () {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }) as `${string}-${string}-${string}-${string}-${string}`;
    };
  }
}

// 5. structuredClone
if (typeof globalThis !== 'undefined' && typeof (globalThis as any).structuredClone === 'undefined') {
  (globalThis as any).structuredClone = function <T>(val: T): T {
    if (val === undefined) return undefined as any;
    try {
      return JSON.parse(JSON.stringify(val));
    } catch {
      return val;
    }
  };
}

export {};
