import { useState, useEffect, memo, useRef } from 'react';
import placeholderImage from '../../assets/placeholder-product.svg';

// Global cache for resolved URLs
const urlCache = new Map();

// Pending resolution requests - batches IPC calls
const pendingRequests = new Map();
let batchTimeout = null;
const BATCH_DELAY = 16; // ~1 frame

const hasNativeResolver = () =>
  typeof window !== 'undefined' && !!window.ThesisPOS?.resolveAsset;

/**
 * Checks if a URL is already resolved (not a relative path)
 */
function isResolvedUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('file://') ||
    url.startsWith('local-file://') ||
    url.startsWith('data:')
  );
}

/**
 * Resolve a single asset URL, batching requests to reduce IPC overhead
 */
function resolveAssetUrl(src) {
  if (!hasNativeResolver()) {
    return Promise.resolve(src);
  }

  // Return cached result immediately
  if (urlCache.has(src)) {
    return Promise.resolve(urlCache.get(src));
  }

  // If already pending, return existing promise
  if (pendingRequests.has(src)) {
    return pendingRequests.get(src).promise;
  }

  // Create new pending request
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  pendingRequests.set(src, { promise, resolve });

  // Schedule batch processing
  if (!batchTimeout) {
    batchTimeout = setTimeout(processBatch, BATCH_DELAY);
  }

  return promise;
}

async function processBatch() {
  batchTimeout = null;
  const batch = Array.from(pendingRequests.entries());
  
  if (batch.length === 0) return;

  // Process all pending requests
  for (const [src, { resolve }] of batch) {
    pendingRequests.delete(src);
    
    try {
      if (typeof window !== 'undefined' && window.ThesisPOS?.resolveAsset) {
        const resolved = await window.ThesisPOS.resolveAsset(src);
        if (resolved) {
          urlCache.set(src, resolved);
          resolve(resolved);
        } else {
          resolve(null);
        }
      } else {
        // No native bridge, use as-is
        resolve(src);
      }
    } catch (error) {
      console.warn('[AsyncImage] Failed to resolve:', src, error);
      resolve(null);
    }
  }
}

/**
 * AsyncImage component that handles async image URL resolution for Electron
 * Properly resolves /uploads/ paths through the native bridge with batching
 */
const AsyncImage = memo(({ 
  src, 
  alt = '', 
  className = '', 
  fallback = null,
  onLoad,
  onError,
  ...props 
}) => {
  // Compute initial resolved URL synchronously from cache
  const getInitialSrc = () => {
    if (!src) return placeholderImage;
    if (isResolvedUrl(src)) return src;
    if (!hasNativeResolver()) return src;
    if (urlCache.has(src)) return urlCache.get(src);
    return null; // Will trigger async resolution
  };

  const initialSrc = getInitialSrc();
  const [resolvedSrc, setResolvedSrc] = useState(initialSrc || placeholderImage);
  const [hasError, setHasError] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!src) {
      setResolvedSrc(placeholderImage);
      return;
    }

    // Already resolved URL
    if (isResolvedUrl(src)) {
      setResolvedSrc(src);
      return;
    }

    if (!hasNativeResolver()) {
      setResolvedSrc(src);
      urlCache.set(src, src);
      return;
    }

    // Check cache synchronously
    if (urlCache.has(src)) {
      setResolvedSrc(urlCache.get(src));
      return;
    }

    // Need to resolve asynchronously
    setHasError(false);
    
    resolveAssetUrl(src).then((resolved) => {
      if (mountedRef.current) {
        setResolvedSrc(resolved || placeholderImage);
      }
    });
  }, [src]);

  const handleError = (e) => {
    if (resolvedSrc !== placeholderImage) {
      setResolvedSrc(placeholderImage);
      setHasError(true);
    }
    onError?.(e);
  };

  const handleLoad = (e) => {
    onLoad?.(e);
  };

  if (hasError && fallback) {
    return fallback;
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      onError={handleError}
      onLoad={handleLoad}
      {...props}
    />
  );
}, (prevProps, nextProps) => {
  return prevProps.src === nextProps.src && 
         prevProps.className === nextProps.className &&
         prevProps.alt === nextProps.alt;
});

AsyncImage.displayName = 'AsyncImage';

/**
 * Clear the URL cache (useful after image updates/deletions)
 */
export const clearAsyncImageCache = () => {
  urlCache.clear();
  pendingRequests.clear();
};

/**
 * Preload images into cache (call with array of src URLs)
 */
export const preloadImages = async (srcList) => {
  if (!Array.isArray(srcList)) return;
  
  const toResolve = srcList.filter(src => 
    src && typeof src === 'string' && !isResolvedUrl(src) && !urlCache.has(src)
  );

  // Resolve all in parallel
  await Promise.all(toResolve.map(src => resolveAssetUrl(src)));
};

export default AsyncImage;






