'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui';
import { Flags } from '@/lib/flags';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onError?: (error: string) => void;
  mode?: 'usb' | 'camera' | 'manual';
  disabled?: boolean;
  autoFocus?: boolean;
}

export default function BarcodeScanner({
  onScan,
  onError,
  mode = 'usb',
  disabled = false,
  autoFocus = true,
}: BarcodeScannerProps) {
  const [buffer, setBuffer] = useState('');
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // USB Scanner Mode - Capture keyboard input
  useEffect(() => {
    if (mode !== 'usb' || disabled) return;

    let scanBuffer = '';
    let scanTimeout: NodeJS.Timeout;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'Enter') {
        // Barcode complete
        if (scanBuffer.length > 0) {
          handleScan(scanBuffer);
          scanBuffer = '';
        }
      } else if (e.key.length === 1 && /[0-9A-Za-z]/.test(e.key)) {
        // Accumulate barcode digits/letters
        scanBuffer += e.key;
        
        // Reset buffer if typing is too slow (not a scanner)
        clearTimeout(scanTimeout);
        scanTimeout = setTimeout(() => {
          scanBuffer = '';
        }, 100);
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    
    return () => {
      window.removeEventListener('keypress', handleKeyPress);
      clearTimeout(scanTimeout);
    };
  }, [mode, disabled]);

  // Camera Mode - Use device camera (requires ZXing or similar)
  useEffect(() => {
    if (mode !== 'camera' || disabled) return;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }, // Use back camera on mobile
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
        }

        // TODO: Integrate ZXing library for barcode detection
        // For now, just show camera feed
        setIsScanning(true);
      } catch (error: any) {
        console.error('[BarcodeScanner] Camera error:', error);
        onError?.('Failed to access camera: ' + error.message);
      }
    };

    startCamera();

    return () => {
      // Cleanup camera stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setIsScanning(false);
    };
  }, [mode, disabled, onError]);

  const handleScan = useCallback((barcode: string) => {
    if (disabled) return;

    // Prevent duplicate scans within 1 second
    if (lastScan === barcode && Date.now() - (timeoutRef.current as any) < 1000) {
      return;
    }

    setLastScan(barcode);
    setBuffer(barcode);
    (timeoutRef.current as any) = Date.now();

    // Visual feedback
    playBeep();
    flashScreen();

    // Call parent handler
    onScan(barcode);

    // Clear buffer after 2 seconds
    setTimeout(() => {
      setBuffer('');
    }, 2000);
  }, [disabled, lastScan, onScan]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleScan(manualInput.trim());
      setManualInput('');
    }
  };

  const playBeep = () => {
    // Create a simple beep sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3;

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  };

  const flashScreen = () => {
    const flash = document.createElement('div');
    flash.style.position = 'fixed';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100%';
    flash.style.height = '100%';
    flash.style.backgroundColor = 'rgba(0, 255, 0, 0.3)';
    flash.style.pointerEvents = 'none';
    flash.style.zIndex = '9999';
    flash.style.transition = 'opacity 0.3s';
    
    document.body.appendChild(flash);
    
    setTimeout(() => {
      flash.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(flash);
      }, 300);
    }, 100);
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Mode Indicator */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                Barcode Scanner
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {mode === 'usb' && 'Scan with USB barcode scanner'}
                {mode === 'camera' && 'Scan with device camera'}
                {mode === 'manual' && 'Enter barcode manually'}
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              disabled 
                ? 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400'
                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
            }`}>
              {disabled ? 'Disabled' : 'Ready'}
            </div>
          </div>

          {/* USB Mode - Instructions */}
          {mode === 'usb' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
                    USB Scanner Ready
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-400 mt-1">
                    Simply scan a barcode with your USB scanner. The barcode will be captured automatically.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Camera Mode - Video Feed */}
          {mode === 'camera' && (
            <div className="relative bg-neutral-900 rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!isScanning && (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/80">
                  <div className="text-center text-white">
                    <svg className="w-12 h-12 mx-auto mb-2 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-sm">Initializing camera...</p>
                  </div>
                </div>
              )}
              {/* Scanning reticle */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-48 border-2 border-green-500 rounded-lg relative">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-green-500"></div>
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-green-500"></div>
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-green-500"></div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-green-500"></div>
                </div>
              </div>
            </div>
          )}

          {/* Manual Mode - Input Field */}
          {mode === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label htmlFor="manual-barcode" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Enter Barcode
                </label>
                <input
                  id="manual-barcode"
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Type or paste barcode..."
                  disabled={disabled}
                  autoFocus={autoFocus}
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-neutral-800 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <button
                type="submit"
                disabled={disabled || !manualInput.trim()}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Add Barcode
              </button>
            </form>
          )}

          {/* Last Scanned Barcode */}
          {buffer && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900 dark:text-green-300">
                    Scanned Successfully
                  </p>
                  <p className="text-lg font-mono text-green-800 dark:text-green-400 mt-1">
                    {buffer}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Feature Flag Warning */}
          {mode === 'camera' && !Flags.SCAN_CAMERA && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-300">
                    Camera Scanning Disabled
                  </p>
                  <p className="text-sm text-yellow-800 dark:text-yellow-400 mt-1">
                    The FF_SCAN_CAMERA feature flag is not enabled. Contact your administrator to enable camera scanning.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
