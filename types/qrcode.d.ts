// Type definitions for QRCode library loaded from CDN
declare global {
  interface Window {
    QRCode: any;
  }
  
  class QRCode {
    constructor(element: HTMLElement | string, options: {
      text: string;
      width?: number;
      height?: number;
      colorDark?: string;
      colorLight?: string;
      correctLevel?: number;
    });
    clear(): void;
    makeCode(text: string): void;
  }
}

export {};
