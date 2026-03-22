import { useState, useEffect, useRef } from 'react';

export const useBarcode = () => {
  const [barcodeData, setBarcodeData] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const bufferRef = useRef('');
  const timeoutRef = useRef(null);

  // Handle keyboard barcode scanner input
  const handleKeyDown = (event) => {
    if (!isScanning) return;

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Handle Enter key (end of barcode scan)
    if (event.key === 'Enter') {
      event.preventDefault();
      if (bufferRef.current.length > 0) {
        setBarcodeData(bufferRef.current.trim());
        bufferRef.current = '';
      }
      return;
    }

    // Handle regular characters
    if (event.key.length === 1) {
      bufferRef.current += event.key;
      
      // Auto-submit after 100ms of no input (typical for barcode scanners)
      timeoutRef.current = setTimeout(() => {
        if (bufferRef.current.length > 0) {
          setBarcodeData(bufferRef.current.trim());
          bufferRef.current = '';
        }
      }, 100);
    }
  };

  // Handle manual input from text field
  const handleManualInput = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const value = event.target.value.trim();
      if (value) {
        setBarcodeData(value);
        event.target.value = '';
      }
    }
  };

  const startScanning = () => {
    setIsScanning(true);
    setError(null);
    bufferRef.current = '';
    
    // Focus on the input field if it exists
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const stopScanning = () => {
    setIsScanning(false);
    bufferRef.current = '';
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const clearBarcodeData = () => {
    setBarcodeData(null);
  };

  // Add global keyboard event listener for barcode scanner
  useEffect(() => {
    if (isScanning) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isScanning]);

  // Reset barcode data after processing
  useEffect(() => {
    if (barcodeData) {
      const timer = setTimeout(() => {
        setBarcodeData(null);
      }, 1000); // Give more time for processing
      return () => clearTimeout(timer);
    }
  }, [barcodeData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    barcodeData,
    isScanning,
    error,
    startScanning,
    stopScanning,
    clearBarcodeData,
    BarcodeInput: ({ placeholder = "Scan barcode or type manually...", className = "" }) => (
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
          onKeyDown={handleManualInput}
          disabled={!isScanning}
        />
        {isScanning && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-600">Scanning</span>
            </div>
          </div>
        )}
      </div>
    ),
  };
}; 