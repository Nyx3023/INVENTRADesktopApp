import placeholderImage from '../assets/placeholder-product.svg';

// Cache for resolved image URLs to avoid repeated IPC calls
const resolvedUrlCache = new Map();

/**
 * Resolves the correct image URL for display (synchronous version)
 * Returns the imageUrl as-is if already resolved, or placeholder if not available
 * @param {string} imageUrl - The image URL from the database
 * @returns {string} - The resolved image URL
 */
export const resolveImageUrl = (imageUrl) => {
  if (!imageUrl) {
    return placeholderImage;
  }
  
  // If it's already a file/data/http URL, return as is
  if (
    imageUrl.startsWith('http://') ||
    imageUrl.startsWith('https://') ||
    imageUrl.startsWith('file://') ||
    imageUrl.startsWith('data:')
  ) {
    return imageUrl;
  }

  // Check cache for previously resolved URLs
  if (resolvedUrlCache.has(imageUrl)) {
    return resolvedUrlCache.get(imageUrl);
  }
  
  // For unresolved local paths, trigger async resolution and return placeholder for now
  if (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('uploads/')) {
    // Attempt async resolution in background
    resolveImageUrlAsync(imageUrl).then(resolved => {
      if (resolved && resolved !== placeholderImage) {
        resolvedUrlCache.set(imageUrl, resolved);
      }
    }).catch(() => {});
    
    // Return placeholder until resolved
    return placeholderImage;
  }
  
  // Fallback to placeholder
  return placeholderImage;
};

/**
 * Asynchronously resolves an image URL through the native bridge
 * @param {string} imageUrl - The image URL to resolve
 * @returns {Promise<string>} - The resolved image URL
 */
export const resolveImageUrlAsync = async (imageUrl) => {
  if (!imageUrl) {
    return placeholderImage;
  }
  
  // If it's already a resolved URL, return as is
  if (
    imageUrl.startsWith('http://') ||
    imageUrl.startsWith('https://') ||
    imageUrl.startsWith('file://') ||
    imageUrl.startsWith('data:')
  ) {
    return imageUrl;
  }

  // Check cache
  if (resolvedUrlCache.has(imageUrl)) {
    return resolvedUrlCache.get(imageUrl);
  }
  
  // Try to resolve through native bridge
  if (typeof window !== 'undefined' && window.ThesisPOS?.resolveAsset) {
    try {
      const resolved = await window.ThesisPOS.resolveAsset(imageUrl);
      if (resolved) {
        resolvedUrlCache.set(imageUrl, resolved);
        return resolved;
      }
    } catch (error) {
      console.warn('[imageUtils] Failed to resolve image:', imageUrl, error);
    }
  }
  
  return placeholderImage;
};

/**
 * Clears the resolved URL cache (useful after image updates)
 */
export const clearImageCache = () => {
  resolvedUrlCache.clear();
};

/**
 * Handles image load errors by setting a placeholder
 * @param {Event} event - The image error event
 */
export const handleImageError = (event) => {
  if (event.target.src !== placeholderImage) {
    event.target.src = placeholderImage;
  }
  event.target.onerror = null; // Prevent infinite loop
}; 