// Canvas patch helper to temporarily solve OKLCH and OKLAB color issues in html2canvas
import html2canvas from 'html2canvas';

const memoizedColors: Record<string, string> = {};
let canvas1x1: HTMLCanvasElement | null = null;
try {
  if (typeof document !== 'undefined') {
    canvas1x1 = document.createElement('canvas');
    canvas1x1.width = 1;
    canvas1x1.height = 1;
  }
} catch (e) {
  // Ignore
}

const resolveColor = (colorStr: string): string => {
  if (memoizedColors[colorStr]) return memoizedColors[colorStr];
  
  // Try using canvas 2d context fillStyle to convert the color to standard rgb/rgba
  try {
    if (canvas1x1) {
      const ctx = canvas1x1.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = colorStr;
        ctx.fillRect(0, 0, 1, 1);
        const imgData = ctx.getImageData(0, 0, 1, 1).data;
        if (imgData[3] > 0 || imgData[0] !== 0 || imgData[1] !== 0 || imgData[2] !== 0) {
          const rgba = `rgba(${imgData[0]}, ${imgData[1]}, ${imgData[2]}, ${imgData[3] / 255})`;
          memoizedColors[colorStr] = rgba;
          return rgba;
        }
      }
    }
  } catch (err) {
    // Ignore canvas errors
  }

  // Fallback to createElement/getComputedStyle for standard resolution
  try {
    if (typeof document !== 'undefined') {
      const tempSpan = document.createElement('span');
      tempSpan.style.color = colorStr;
      tempSpan.style.display = 'none';
      document.body.appendChild(tempSpan);
      const resolved = window.getComputedStyle(tempSpan).color;
      document.body.removeChild(tempSpan);
      
      if (resolved && !resolved.includes('oklch') && !resolved.includes('oklab')) {
        memoizedColors[colorStr] = resolved;
        return resolved;
      }
    }
  } catch (err) {
    // Ignore
  }

  // Ultimate fallback (e.g. pure black color so it doesn't crash HTMLCanvas/PDF generator)
  memoizedColors[colorStr] = 'rgb(0, 0, 0)';
  return 'rgb(0, 0, 0)';
};

const replaceOklchAndOklab = (val: string): string => {
  if (!val || typeof val !== 'string') return val;
  if (!val.includes('oklch') && !val.includes('oklab')) return val;
  
  try {
    let result = val;
    // Replace standard oklch(...)
    result = result.replace(/oklch\([^)]+\)/g, (match) => resolveColor(match));
    // Replace standard oklab(...)
    result = result.replace(/oklab\([^)]+\)/g, (match) => resolveColor(match));
    // Replace modern color(oklch ...)
    result = result.replace(/color\(oklch\s+[^)]+\)/g, (match) => resolveColor(match));
    // Replace modern color(oklab ...)
    result = result.replace(/color\(oklab\s+[^)]+\)/g, (match) => resolveColor(match));
    return result;
  } catch (err) {
    return val;
  }
};

/**
 * Runs a function (usually containing html2canvas execution) with temporary oklch/oklab patches
 * applied to window.getComputedStyle, CSSRule, and CSSStyleDeclaration, then restores them.
 */
export async function withOklabOklchPatch<T>(fn: () => Promise<T>): Promise<T> {
  const originalDescriptor = Object.getOwnPropertyDescriptor(CSSRule.prototype, 'cssText');
  const originalGetPropertyValue = CSSStyleDeclaration.prototype.getPropertyValue;
  const originalStyleCssTextDesc = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'cssText');
  const originalGetComputedStyle = window.getComputedStyle;

  // 1. Temp patch CSSRule.prototype.cssText
  try {
    if (originalDescriptor) {
      Object.defineProperty(CSSRule.prototype, 'cssText', {
        get: function() {
          const rawText = originalDescriptor.get ? originalDescriptor.get.call(this) : '';
          return replaceOklchAndOklab(rawText);
        },
        configurable: true
      });
    }
  } catch (e) {
    // Ignore
  }

  // 2. Temp patch CSSStyleDeclaration.prototype.getPropertyValue
  try {
    CSSStyleDeclaration.prototype.getPropertyValue = function(propertyName: string) {
      const val = originalGetPropertyValue.call(this, propertyName);
      return replaceOklchAndOklab(val);
    };
  } catch (e) {
    // Ignore
  }

  // 3. Temp patch CSSStyleDeclaration.prototype.cssText
  try {
    if (originalStyleCssTextDesc) {
      Object.defineProperty(CSSStyleDeclaration.prototype, 'cssText', {
        get: function() {
          const rawText = originalStyleCssTextDesc.get ? originalStyleCssTextDesc.get.call(this) : '';
          return replaceOklchAndOklab(rawText);
        },
        set: function(val) {
          if (originalStyleCssTextDesc.set) {
            originalStyleCssTextDesc.set.call(this, val);
          }
        },
        configurable: true
      });
    }
  } catch (e) {
    // Ignore
  }

  // 4. Temp patch window.getComputedStyle
  try {
    window.getComputedStyle = function(elt, pseudoElt) {
      const style = originalGetComputedStyle.call(window, elt, pseudoElt);
      return new Proxy(style, {
        get(target, prop, receiver) {
          if (prop === 'getPropertyValue') {
            return function(propertyName: string) {
              const val = target.getPropertyValue(propertyName);
              return replaceOklchAndOklab(val);
            };
          }
          
          const value = (target as any)[prop];
          if (typeof prop === 'string' && typeof value === 'string') {
            return replaceOklchAndOklab(value);
          }
          
          if (typeof value === 'function') {
            return value.bind(target);
          }
          return value;
        }
      });
    };
  } catch (e) {
    // Ignore
  }

  try {
    return await fn();
  } finally {
    // Restore CSSRule.prototype.cssText
    try {
      if (originalDescriptor) {
        Object.defineProperty(CSSRule.prototype, 'cssText', originalDescriptor);
      } else {
        delete (CSSRule.prototype as any).cssText;
      }
    } catch (e) {
      // Ignore
    }

    // Restore CSSStyleDeclaration.prototype.getPropertyValue
    try {
      CSSStyleDeclaration.prototype.getPropertyValue = originalGetPropertyValue;
    } catch (e) {
      // Ignore
    }

    // Restore CSSStyleDeclaration.prototype.cssText
    try {
      if (originalStyleCssTextDesc) {
        Object.defineProperty(CSSStyleDeclaration.prototype, 'cssText', originalStyleCssTextDesc);
      } else {
        delete (CSSStyleDeclaration.prototype as any).cssText;
      }
    } catch (e) {
      // Ignore
    }

    // Restore window.getComputedStyle
    try {
      window.getComputedStyle = originalGetComputedStyle;
    } catch (e) {
      // Ignore
    }
  }
}
