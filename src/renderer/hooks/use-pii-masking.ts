import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PiiDetectors } from '../../shared/ipc-types';
import type { RectShape, EditorShape } from './use-editor-state';
import type {
  OcrLine,
  OcrParagraph,
  OcrStatus,
  OcrWord,
} from './use-text-detection';
import safeLocalStorage from '../utils/storage';
import { createRendererLogger } from '../utils/logger';

const logger = createRendererLogger('use-pii-masking');

export interface PiiMaskRect {
  x: number;
  y: number;
  width: number;
  height: number;
  tag: string; // 'pii-email' | 'pii-phone' | 'pii-address' | 'pii-manual'
}

interface UsePiiMaskingParams {
  screenshot: { imageDataUrl: string; width: number; height: number };
  ocr: {
    status: OcrStatus;
    words: OcrWord[];
    lines: OcrLine[];
    paragraphs: OcrParagraph[];
  };
  createRectForBox: (
    box: { x: number; y: number; width: number; height: number },
    options: {
      fillColor: string;
      strokeColor?: string;
      strokeWidth?: number;
      opacity?: number;
      radius?: number;
      tag?: string;
    },
  ) => RectShape;
  editorApi: {
    shapes: EditorShape[];
    addShapes: (newShapes: EditorShape[]) => string[];
    deleteShapesByIds: (ids: string[]) => void;
    getShapeById: (id: string) => EditorShape | undefined;
    getBoundsForShape: (shape: EditorShape) => {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
}

interface UsePiiMaskingResult {
  censorPII: boolean;
  setCensorPII: (next: boolean) => void;
  defaultStyle: 'blur' | 'black';
  recordManualMaskOnCommit: (
    shape: EditorShape,
    bounds: {
      x: number;
      y: number;
      width: number;
      height: number;
    },
  ) => void;
  updateMaskForShape: (
    shapeId: string,
    rect: { x: number; y: number; width: number; height: number },
  ) => void;
  syncDraggedMaskBounds: (shapeId: string) => void;
  deletePiiForShapeId: (shapeId: string) => void;
}

export function usePiiMasking(
  params: UsePiiMaskingParams,
): UsePiiMaskingResult {
  const { screenshot, ocr, createRectForBox, editorApi } = params;
  const {
    shapes,
    addShapes,
    deleteShapesByIds,
    getShapeById,
    getBoundsForShape,
  } = editorApi;

  // Toggle with persistence via preferences
  const [censorPII, setCensorPII] = useState<boolean>(false);
  const [defaultStyle, setDefaultStyle] = useState<'blur' | 'black'>('black');
  const [detectors, setDetectors] = useState<PiiDetectors | null>(null);

  // Load PII preferences
  useEffect(() => {
    const loadPiiPreferences = async () => {
      try {
        const api = window?.electron?.ipcRenderer;
        if (!api) return;

        const preferences = await api.invoke('get-preferences', {});
        if (preferences?.pii) {
          setCensorPII(preferences.pii.autoDetect);
          setDefaultStyle(preferences.pii.defaultStyle);
          setDetectors(preferences.pii.detectors ?? null);
        }
      } catch (error) {
        logger.warn('Failed to load PII preferences', error);
      }
    };

    loadPiiPreferences();
  }, []);

  // Update preferences when censorPII changes
  const updateCensorPII = useCallback(async (enabled: boolean) => {
    setCensorPII(enabled);

    try {
      const api = window?.electron?.ipcRenderer;
      if (!api) return;

      // Get current preferences to preserve defaultStyle and detectors
      const currentPrefs = await api.invoke('get-preferences', {});

      await api.invoke('set-preferences', {
        preferences: {
          pii: {
            autoDetect: enabled,
            defaultStyle: currentPrefs?.pii?.defaultStyle || 'black',
            detectors: currentPrefs?.pii?.detectors,
          },
        },
      });
    } catch (error) {
      logger.warn('Failed to save PII preferences', error);
    }
  }, []);

  // Persisted per-screenshot masks
  const [piiMasks, setPiiMasks] = useState<PiiMaskRect[]>([]);
  const piiMasksRef = useRef<PiiMaskRect[]>(piiMasks);
  useEffect(() => {
    piiMasksRef.current = piiMasks;
  }, [piiMasks]);

  // Map of editor shape id -> mask index within piiMasks
  const piiMaskIdsRef = useRef<Map<string, number>>(new Map());
  const autoCensorIdsRef = useRef<string[]>([]);
  const censorAppliedRef = useRef<boolean>(false);

  const piiStorageKey = useMemo(() => {
    const str = screenshot.imageDataUrl || '';
    const len = Math.min(4096, str.length);
    let hash = 0;
    for (let i = 0; i < len; i += 1) {
      // Large prime modulus to limit overflow
      hash = (hash * 31 + str.charCodeAt(i)) % 4294967291;
    }
    return `pii-masks:${screenshot.width}x${screenshot.height}:${hash.toString(16)}`;
  }, [screenshot.imageDataUrl, screenshot.width, screenshot.height]);

  useEffect(() => {
    const raw = safeLocalStorage.getItem(piiStorageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as PiiMaskRect[];
        if (Array.isArray(parsed)) setPiiMasks(parsed);
      } catch (error) {
        logger.warn('Failed to parse stored PII masks', error);
      }
    }
  }, [piiStorageKey]);
  useEffect(() => {
    safeLocalStorage.setItem(piiStorageKey, JSON.stringify(piiMasks));
  }, [piiStorageKey, piiMasks]);

  // Keep refs to editor actions to avoid stale closures
  const addShapesRef = useRef(addShapes);
  const deleteShapesByIdsRef = useRef(deleteShapesByIds);
  const shapesRef = useRef(shapes);
  useEffect(() => {
    addShapesRef.current = addShapes;
  }, [addShapes]);
  useEffect(() => {
    deleteShapesByIdsRef.current = deleteShapesByIds;
  }, [deleteShapesByIds]);
  useEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);

  // Helper for removing all existing PII-tagged shapes
  const removeAllTagged = useCallback(() => {
    const taggedIds = shapesRef.current
      .filter((s) => {
        const t = s.tag;
        return (
          t === 'pii-email' ||
          t === 'pii-phone' ||
          t === 'pii-address' ||
          t === 'pii-ipv4' ||
          t === 'pii-url' ||
          t === 'pii-ssn' ||
          t === 'pii-cc' ||
          t === 'pii-dob' ||
          t === 'pii-postal-us' ||
          t === 'pii-postal-ca' ||
          t === 'pii-postal-uk' ||
          t === 'pii-uuid' ||
          t === 'pii-mac' ||
          t === 'pii-iban' ||
          t === 'pii-po-box' ||
          t === 'pii-token' ||
          t === 'pii-manual'
        );
      })
      .map((s) => s.id);
    if (taggedIds.length > 0) deleteShapesByIdsRef.current(taggedIds);
    autoCensorIdsRef.current = [];
    piiMaskIdsRef.current.clear();
    censorAppliedRef.current = false;
  }, []);

  // Apply masks as editor shapes and build mapping
  const applyMasks = useCallback(
    (masks: PiiMaskRect[]) => {
      if (!masks || masks.length === 0) return;

      // Determine style based on defaultStyle preference
      const isBlur = defaultStyle === 'blur';
      const fillColor = isBlur ? '#808080' : '#000000'; // Gray for blur effect, black for solid
      const opacity = isBlur ? 0.8 : 1; // Semi-transparent for blur effect

      const shapesToAdd = masks.map((m) => {
        // For blur mode, expand the bounds to ensure full coverage
        if (isBlur) {
          const padding = Math.max(4, Math.min(m.width, m.height) * 0.15); // 15% padding or 4px minimum

          // Calculate expanded bounds with padding
          const expandedX = m.x - padding;
          const expandedY = m.y - padding;
          const expandedWidth = m.width + padding * 2;
          const expandedHeight = m.height + padding;

          // Clamp to image bounds to prevent overflow
          const clampedX = Math.max(0, Math.round(expandedX));
          const clampedY = Math.max(0, Math.round(expandedY));
          const clampedWidth = Math.round(
            Math.min(expandedWidth, screenshot.width - clampedX),
          );
          const clampedHeight = Math.round(
            Math.min(expandedHeight, screenshot.height - clampedY),
          );

          return createRectForBox(
            {
              x: clampedX,
              y: clampedY,
              width: clampedWidth,
              height: clampedHeight,
            },
            {
              fillColor,
              strokeColor: 'transparent',
              strokeWidth: 0,
              opacity,
              radius: 4, // Slightly larger radius for blur
              tag: m.tag,
            },
          );
        }

        // For black mode, use exact bounds
        return createRectForBox(
          {
            x: Math.round(m.x),
            y: Math.round(m.y),
            width: Math.round(m.width),
            height: Math.round(m.height),
          },
          {
            fillColor,
            strokeColor: 'transparent',
            strokeWidth: 0,
            opacity,
            radius: 2,
            tag: m.tag,
          },
        );
      });
      const ids = addShapesRef.current(shapesToAdd);
      autoCensorIdsRef.current = ids;
      piiMaskIdsRef.current.clear();
      ids.forEach((id, idx) => piiMaskIdsRef.current.set(id, idx));
      censorAppliedRef.current = true;
    },
    [createRectForBox, defaultStyle, screenshot.width, screenshot.height],
  );

  // Compute masks from OCR and auto-apply when enabled
  const { status, words, lines } = ocr;
  useEffect(() => {
    if (!censorPII) {
      removeAllTagged();
      return;
    }
    // Only proceed when OCR done or persisted masks are available
    if (status !== 'done' && piiMasksRef.current.length === 0) return;
    if (censorAppliedRef.current) return;

    // Use existing masks for this screenshot if available
    if (piiMasksRef.current.length > 0) {
      applyMasks(piiMasksRef.current);
      return;
    }

    // Ensure detectors are loaded
    const enabled = detectors;
    if (!enabled) return;

    // use words, lines from dependencies
    const emailRegex = /[a-zA-Z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}/g;
    const phoneRegex =
      /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?|\d{2,4}[\s.-]?)\d{3,4}[\s.-]?\d{3,4}(?:\s*(?:x|ext\.?|extension)\s*\d{1,5})?/g;
    const streetType =
      '(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Ln|Lane|Dr|Drive|Ct|Court|Pkwy|Parkway|Way|Ter|Terrace|Pl|Place|Sq|Square|Hwy|Highway|Cir|Circle)\\.?';
    const dir = '(?:N|S|E|W|NE|NW|SE|SW)';
    const addressRegex = new RegExp(
      String.raw`\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+)*\s+${streetType}(?:\s+${dir})?(?:\s+(?:Apt|Apartment|Unit|Suite|Ste|#)\s*\w+)?\b`,
      'gi',
    );

    const obfuscatedEmailRegex =
      /\b[A-Za-z0-9._%+-]+\s*(?:\(|\[)?at(?:\)|\])\s*[A-Za-z0-9.-]+\s*(?:\(|\[)?dot(?:\)|\])\s*[A-Za-z]{2,}\b/gi;

    const ipv4Regex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
    const urlRegex = /\bhttps?:\/\/[^\s/$.?#].[^\s]*\b/gi;
    const domainRegex =
      /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi;
    const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
    const ssnLabelRegex = /(ssn|social\s*security)/i;
    const ccRegex = /\b(?:\d[ -]?){13,19}\b/g;
    const dobRegex =
      /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/g;
    const dobLabelRegex = /(dob|date\s*of\s*birth|birthday)/i;
    const zipUSRegex = /\b\d{5}(?:-\d{4})?\b/g;
    const postalCARegex =
      /\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d\b/g;
    const postalUKRegex =
      /\b([Gg][Ii][Rr] 0[Aa]{2})|((([A-Za-z][0-9]{1,2})|(([A-Za-z]{2}[0-9]{1,2})|([A-Za-z][0-9][A-Za-z])|([A-Za-z]{2}[0-9][A-Za-z])))[ ]?[0-9][A-Za-z]{2})\b/g;
    const uuidRegex =
      /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b/g;
    const macRegex = /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g;
    const ibanRegex = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g;
    const poBoxRegex = /\bP(?:ost)?\.?\s*O(?:ffice)?\.?\s*Box\s*\d+\b/gi;
    const tokensRegex =
      /\b(?:sk_(?:live|test)_[A-Za-z0-9]{16,}|gh[pous]_[A-Za-z0-9]{36}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g;

    const boxesFromTokensByRegex = (
      tokens: Array<{
        text: string;
        bbox: { x: number; y: number; width: number; height: number };
      }>,
      pattern: RegExp,
    ) => {
      if (tokens.length === 0)
        return [] as Array<{
          x: number;
          y: number;
          width: number;
          height: number;
        }>;
      const parts = tokens.map((t) => t.text);
      const joined = parts.join(' ');
      const spans: Array<{ start: number; end: number }> = [];
      let m: RegExpExecArray | null;
      const rx = new RegExp(pattern.source, pattern.flags);
      // eslint-disable-next-line no-cond-assign
      while ((m = rx.exec(joined)) !== null)
        spans.push({ start: m.index, end: m.index + m[0].length });
      if (spans.length === 0) return [];
      const ranges: Array<{ start: number; end: number }> = [];
      let pos = 0;
      for (let i = 0; i < parts.length; i += 1) {
        const len = parts[i].length;
        ranges.push({ start: pos, end: pos + len });
        pos += len + (i < parts.length - 1 ? 1 : 0);
      }
      const results: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
      }> = [];
      spans.forEach((s) => {
        const startIdx = ranges.findIndex(
          (r) => s.start < r.end && s.end > r.start,
        );
        if (startIdx < 0) return;
        let endIdx = startIdx;
        for (let j = startIdx + 1; j < ranges.length; j += 1) {
          if (s.end > ranges[j].start) endIdx = j;
          else break;
        }
        const sliceB = tokens.slice(startIdx, endIdx + 1).map((t) => t.bbox);
        const minY = Math.min(...sliceB.map((b) => b.y));
        const maxY = Math.max(...sliceB.map((b) => b.y + b.height));
        const startTok = tokens[startIdx];
        const endTok = tokens[endIdx];
        const startLocal = Math.max(0, s.start - ranges[startIdx].start);
        const endLocal = Math.min(
          endTok.text.length,
          s.end - ranges[endIdx].start,
        );
        const startFrac =
          startTok.text.length > 0 ? startLocal / startTok.text.length : 0;
        const endFrac =
          endTok.text.length > 0 ? endLocal / endTok.text.length : 1;
        const startX = startTok.bbox.x + startFrac * startTok.bbox.width;
        const endX = endTok.bbox.x + endFrac * endTok.bbox.width;
        const minX = Math.min(startX, endX);
        const maxX = Math.max(startX, endX);
        results.push({
          x: Math.round(minX),
          y: minY,
          width: Math.round(maxX - minX),
          height: maxY - minY,
        });
      });
      return results;
    };

    const lineBoxesFor = (rx: RegExp) =>
      ocr.lines.flatMap((ln) => {
        const ly0 = ln.bbox.y;
        const ly1 = ln.bbox.y + ln.bbox.height;
        const lineWords = words
          .filter((w) => {
            const wy0 = w.bbox.y;
            const wy1 = w.bbox.y + w.bbox.height;
            const overlap = Math.max(
              0,
              Math.min(ly1, wy1) - Math.max(ly0, wy0),
            );
            const minH = Math.min(ln.bbox.height, w.bbox.height);
            return minH > 0 && overlap / minH >= 0.5;
          })
          .sort((a, b) => a.bbox.x - b.bbox.x);
        return boxesFromTokensByRegex(lineWords, rx);
      });

    const lineBoxesForWithLabel = (valueRx: RegExp, labelRx: RegExp) =>
      ocr.lines.flatMap((ln) => {
        if (!labelRx.test(ln.text || ''))
          return [] as Array<{
            x: number;
            y: number;
            width: number;
            height: number;
          }>;
        const ly0 = ln.bbox.y;
        const ly1 = ln.bbox.y + ln.bbox.height;
        const lineWords = words
          .filter((w) => {
            const wy0 = w.bbox.y;
            const wy1 = w.bbox.y + w.bbox.height;
            const overlap = Math.max(
              0,
              Math.min(ly1, wy1) - Math.max(ly0, wy0),
            );
            const minH = Math.min(ln.bbox.height, w.bbox.height);
            return minH > 0 && overlap / minH >= 0.5;
          })
          .sort((a, b) => a.bbox.x - b.bbox.x);
        return boxesFromTokensByRegex(lineWords, valueRx);
      });

    // Variant that allows match-level filter (e.g., Luhn)
    const boxesFromTokensByRegexWithFilter = (
      tokens: Array<{
        text: string;
        bbox: { x: number; y: number; width: number; height: number };
      }>,
      pattern: RegExp,
      accept: (matchedText: string) => boolean,
    ) => {
      if (tokens.length === 0)
        return [] as Array<{
          x: number;
          y: number;
          width: number;
          height: number;
        }>;
      const parts = tokens.map((t) => t.text);
      const joined = parts.join(' ');
      const spans: Array<{ start: number; end: number; text: string }> = [];
      let m: RegExpExecArray | null;
      const rx = new RegExp(pattern.source, pattern.flags);
      // eslint-disable-next-line no-cond-assign
      while ((m = rx.exec(joined)) !== null) {
        if (accept(m[0]))
          spans.push({
            start: m.index,
            end: m.index + m[0].length,
            text: m[0],
          });
      }
      if (spans.length === 0) return [];
      const ranges: Array<{ start: number; end: number }> = [];
      let pos = 0;
      for (let i = 0; i < parts.length; i += 1) {
        const len = parts[i].length;
        ranges.push({ start: pos, end: pos + len });
        pos += len + (i < parts.length - 1 ? 1 : 0);
      }
      const results: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
      }> = [];
      spans.forEach((s) => {
        const startIdx = ranges.findIndex(
          (r) => s.start < r.end && s.end > r.start,
        );
        if (startIdx < 0) return;
        let endIdx = startIdx;
        for (let j = startIdx + 1; j < ranges.length; j += 1) {
          if (s.end > ranges[j].start) endIdx = j;
          else break;
        }
        const sliceB = tokens.slice(startIdx, endIdx + 1).map((t) => t.bbox);
        const minY = Math.min(...sliceB.map((b) => b.y));
        const maxY = Math.max(...sliceB.map((b) => b.y + b.height));
        const startTok = tokens[startIdx];
        const endTok = tokens[endIdx];
        const startLocal = Math.max(0, s.start - ranges[startIdx].start);
        const endLocal = Math.min(
          endTok.text.length,
          s.end - ranges[endIdx].start,
        );
        const startFrac =
          startTok.text.length > 0 ? startLocal / startTok.text.length : 0;
        const endFrac =
          endTok.text.length > 0 ? endLocal / endTok.text.length : 1;
        const startX = startTok.bbox.x + startFrac * startTok.bbox.width;
        const endX = endTok.bbox.x + endFrac * endTok.bbox.width;
        const minX = Math.min(startX, endX);
        const maxX = Math.max(startX, endX);
        results.push({
          x: Math.round(minX),
          y: minY,
          width: Math.round(maxX - minX),
          height: maxY - minY,
        });
      });
      return results;
    };

    const luhnValid = (raw: string) => {
      const digits = raw.replace(/[^0-9]/g, '');
      if (digits.length < 13 || digits.length > 19) return false;
      let sum = 0;
      let shouldDouble = false;
      for (let i = digits.length - 1; i >= 0; i -= 1) {
        let d = parseInt(digits[i], 10);
        if (shouldDouble) {
          d *= 2;
          if (d > 9) d -= 9;
        }
        sum += d;
        shouldDouble = !shouldDouble;
      }
      return sum % 10 === 0;
    };

    const fallbackWordBoxesFor = (
      rx: RegExp,
      existing: Array<{ x: number; y: number; width: number; height: number }>,
    ) => {
      if (existing.length > 0)
        return [] as Array<{
          x: number;
          y: number;
          width: number;
          height: number;
        }>;
      if (!words || words.length === 0)
        return [] as Array<{
          x: number;
          y: number;
          width: number;
          height: number;
        }>;
      const sorted = [...words].sort(
        (a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x,
      );
      const yTol = (h: number) => Math.max(2, Math.round(h * 0.6));
      const groups = sorted.reduce<Array<typeof sorted>>((acc, w) => {
        const last = acc[acc.length - 1];
        if (!last) return [[w]];
        const avgY = last.reduce((s, it) => s + it.bbox.y, 0) / last.length;
        const avgH =
          last.reduce((s, it) => s + it.bbox.height, 0) / last.length;
        return Math.abs(w.bbox.y - avgY) <= yTol(avgH)
          ? (last.push(w), acc)
          : [...acc, [w]];
      }, []);
      return groups.flatMap((g) =>
        boxesFromTokensByRegex(
          g.sort((a, b) => a.bbox.x - b.bbox.x),
          rx,
        ),
      );
    };

    const lineBoxesEmail = enabled.email ? lineBoxesFor(emailRegex) : [];
    const lineBoxesEmailObf = enabled.email
      ? lineBoxesFor(obfuscatedEmailRegex)
      : [];
    const lineBoxesPhone = enabled.phone ? lineBoxesFor(phoneRegex) : [];
    const lineBoxesAddress = enabled.address ? lineBoxesFor(addressRegex) : [];
    const wordBoxesEmail = enabled.email
      ? fallbackWordBoxesFor(emailRegex, [
          ...lineBoxesEmail,
          ...lineBoxesEmailObf,
        ])
      : [];
    const wordBoxesEmailObf = enabled.email
      ? fallbackWordBoxesFor(obfuscatedEmailRegex, [
          ...lineBoxesEmail,
          ...lineBoxesEmailObf,
        ])
      : [];
    const wordBoxesPhone = enabled.phone
      ? fallbackWordBoxesFor(phoneRegex, lineBoxesPhone)
      : [];
    const wordBoxesAddress = enabled.address
      ? fallbackWordBoxesFor(addressRegex, lineBoxesAddress)
      : [];

    const lineBoxesIpv4 = enabled.ipv4 ? lineBoxesFor(ipv4Regex) : [];
    const wordBoxesIpv4 = enabled.ipv4
      ? fallbackWordBoxesFor(ipv4Regex, lineBoxesIpv4)
      : [];
    const lineBoxesUrl = enabled.url
      ? [...lineBoxesFor(urlRegex), ...lineBoxesFor(domainRegex)]
      : [];
    const wordBoxesUrl = enabled.url
      ? [
          ...fallbackWordBoxesFor(urlRegex, lineBoxesUrl),
          ...fallbackWordBoxesFor(domainRegex, lineBoxesUrl),
        ]
      : [];
    const lineBoxesSsn = enabled.ssn
      ? lineBoxesForWithLabel(ssnRegex, ssnLabelRegex)
      : [];
    const wordBoxesSsn = enabled.ssn
      ? fallbackWordBoxesFor(ssnRegex, lineBoxesSsn)
      : [];
    const lineBoxesDob = enabled.dob
      ? lineBoxesForWithLabel(dobRegex, dobLabelRegex)
      : [];
    const wordBoxesDob = enabled.dob
      ? fallbackWordBoxesFor(dobRegex, lineBoxesDob)
      : [];
    const lineBoxesZipUS = enabled.postalUS ? lineBoxesFor(zipUSRegex) : [];
    const wordBoxesZipUS = enabled.postalUS
      ? fallbackWordBoxesFor(zipUSRegex, lineBoxesZipUS)
      : [];
    const lineBoxesPostalCA = enabled.postalCA
      ? lineBoxesFor(postalCARegex)
      : [];
    const wordBoxesPostalCA = enabled.postalCA
      ? fallbackWordBoxesFor(postalCARegex, lineBoxesPostalCA)
      : [];
    const lineBoxesPostalUK = enabled.postalUK
      ? lineBoxesFor(postalUKRegex)
      : [];
    const wordBoxesPostalUK = enabled.postalUK
      ? fallbackWordBoxesFor(postalUKRegex, lineBoxesPostalUK)
      : [];
    const lineBoxesUuid = enabled.uuid ? lineBoxesFor(uuidRegex) : [];
    const wordBoxesUuid = enabled.uuid
      ? fallbackWordBoxesFor(uuidRegex, lineBoxesUuid)
      : [];
    const lineBoxesMac = enabled.mac ? lineBoxesFor(macRegex) : [];
    const wordBoxesMac = enabled.mac
      ? fallbackWordBoxesFor(macRegex, lineBoxesMac)
      : [];
    const lineBoxesIban = enabled.iban ? lineBoxesFor(ibanRegex) : [];
    const wordBoxesIban = enabled.iban
      ? fallbackWordBoxesFor(ibanRegex, lineBoxesIban)
      : [];
    const lineBoxesPoBox = enabled.poBox ? lineBoxesFor(poBoxRegex) : [];
    const wordBoxesPoBox = enabled.poBox
      ? fallbackWordBoxesFor(poBoxRegex, lineBoxesPoBox)
      : [];
    const lineBoxesTokens = enabled.tokens ? lineBoxesFor(tokensRegex) : [];
    const wordBoxesTokens = enabled.tokens
      ? fallbackWordBoxesFor(tokensRegex, lineBoxesTokens)
      : [];

    const ccBoxesLine = enabled.creditCard
      ? ocr.lines.flatMap((ln) => {
          const ly0 = ln.bbox.y;
          const ly1 = ln.bbox.y + ln.bbox.height;
          const lineWords = words
            .filter((w) => {
              const wy0 = w.bbox.y;
              const wy1 = w.bbox.y + w.bbox.height;
              const overlap = Math.max(
                0,
                Math.min(ly1, wy1) - Math.max(ly0, wy0),
              );
              const minH = Math.min(ln.bbox.height, w.bbox.height);
              return minH > 0 && overlap / minH >= 0.5;
            })
            .sort((a, b) => a.bbox.x - b.bbox.x);
          return boxesFromTokensByRegexWithFilter(
            lineWords,
            ccRegex,
            luhnValid,
          );
        })
      : [];
    const ccBoxesWord = enabled.creditCard
      ? boxesFromTokensByRegexWithFilter(
          [...words].sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x),
          ccRegex,
          luhnValid,
        )
      : [];

    const boxesRawEmail = [
      ...lineBoxesEmail,
      ...lineBoxesEmailObf,
      ...wordBoxesEmail,
      ...wordBoxesEmailObf,
    ];
    const boxesRawPhone = [...lineBoxesPhone, ...wordBoxesPhone];
    const boxesRawAddress = [...lineBoxesAddress, ...wordBoxesAddress];
    const boxesRawIpv4 = [...lineBoxesIpv4, ...wordBoxesIpv4];
    const boxesRawUrl = [...lineBoxesUrl, ...wordBoxesUrl];
    const boxesRawSsn = [...lineBoxesSsn, ...wordBoxesSsn];
    const boxesRawDob = [...lineBoxesDob, ...wordBoxesDob];
    const boxesRawZipUS = [...lineBoxesZipUS, ...wordBoxesZipUS];
    const boxesRawPostalCA = [...lineBoxesPostalCA, ...wordBoxesPostalCA];
    const boxesRawPostalUK = [...lineBoxesPostalUK, ...wordBoxesPostalUK];
    const boxesRawUuid = [...lineBoxesUuid, ...wordBoxesUuid];
    const boxesRawMac = [...lineBoxesMac, ...wordBoxesMac];
    const boxesRawIban = [...lineBoxesIban, ...wordBoxesIban];
    const boxesRawPoBox = [...lineBoxesPoBox, ...wordBoxesPoBox];
    const boxesRawTokens = [...lineBoxesTokens, ...wordBoxesTokens];

    const dedup = (
      arr: Array<{ x: number; y: number; width: number; height: number }>,
    ) => {
      const map = new Map<
        string,
        { x: number; y: number; width: number; height: number }
      >();
      arr.forEach((b) => {
        const key = `${b.x}|${b.y}|${b.width}|${b.height}`;
        if (!map.has(key)) map.set(key, b);
      });
      return Array.from(map.values());
    };
    const dedupEmail = dedup(boxesRawEmail);
    const dedupPhone = dedup(boxesRawPhone);
    const dedupAddress = dedup(boxesRawAddress);
    const dedupIpv4 = dedup(boxesRawIpv4);
    const dedupUrl = dedup(boxesRawUrl);
    const dedupSsn = dedup(boxesRawSsn);
    const dedupDob = dedup(boxesRawDob);
    const dedupZipUS = dedup(boxesRawZipUS);
    const dedupPostalCA = dedup(boxesRawPostalCA);
    const dedupPostalUK = dedup(boxesRawPostalUK);
    const dedupUuid = dedup(boxesRawUuid);
    const dedupMac = dedup(boxesRawMac);
    const dedupIban = dedup(boxesRawIban);
    const dedupPoBox = dedup(boxesRawPoBox);
    const dedupTokens = dedup(boxesRawTokens);

    const mergeOverlap = (
      input: Array<{ x: number; y: number; width: number; height: number }>,
    ) => {
      const V_OVERLAP_RATIO = 0.5;
      const result: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
      }> = [];
      input.forEach((b) => {
        const idx = result.findIndex((r) => {
          const x1 = Math.max(r.x, b.x);
          const y1 = Math.max(r.y, b.y);
          const x2 = Math.min(r.x + r.width, b.x + b.width);
          const y2 = Math.min(r.y + r.height, b.y + b.height);
          const overlap = x2 > x1 && y2 > y1;
          const vertOverlap =
            Math.max(0, y2 - y1) / Math.min(r.height, b.height);
          return overlap && vertOverlap >= V_OVERLAP_RATIO;
        });
        if (idx >= 0) {
          const r = result[idx];
          const minX = Math.min(r.x, b.x);
          const minY = Math.min(r.y, b.y);
          const maxX = Math.max(r.x + r.width, b.x + b.width);
          const maxY = Math.max(r.y + r.height, b.y + b.height);
          result[idx] = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
          };
        } else {
          result.push(b);
        }
      });
      return result;
    };

    const masks: PiiMaskRect[] = [
      ...mergeOverlap(dedupEmail).map((b) => ({ ...b, tag: 'pii-email' })),
      ...mergeOverlap(dedupPhone).map((b) => ({ ...b, tag: 'pii-phone' })),
      ...mergeOverlap(dedupAddress).map((b) => ({ ...b, tag: 'pii-address' })),
      ...mergeOverlap(dedupIpv4).map((b) => ({ ...b, tag: 'pii-ipv4' })),
      ...mergeOverlap(dedupUrl).map((b) => ({ ...b, tag: 'pii-url' })),
      ...mergeOverlap(dedupSsn).map((b) => ({ ...b, tag: 'pii-ssn' })),
      ...mergeOverlap([...ccBoxesLine, ...ccBoxesWord]).map((b) => ({
        ...b,
        tag: 'pii-cc',
      })),
      ...mergeOverlap(dedupDob).map((b) => ({ ...b, tag: 'pii-dob' })),
      ...mergeOverlap(dedupZipUS).map((b) => ({ ...b, tag: 'pii-postal-us' })),
      ...mergeOverlap(dedupPostalCA).map((b) => ({
        ...b,
        tag: 'pii-postal-ca',
      })),
      ...mergeOverlap(dedupPostalUK).map((b) => ({
        ...b,
        tag: 'pii-postal-uk',
      })),
      ...mergeOverlap(dedupUuid).map((b) => ({ ...b, tag: 'pii-uuid' })),
      ...mergeOverlap(dedupMac).map((b) => ({ ...b, tag: 'pii-mac' })),
      ...mergeOverlap(dedupIban).map((b) => ({ ...b, tag: 'pii-iban' })),
      ...mergeOverlap(dedupPoBox).map((b) => ({ ...b, tag: 'pii-po-box' })),
      ...mergeOverlap(dedupTokens).map((b) => ({ ...b, tag: 'pii-token' })),
    ];
    setPiiMasks(masks);
    applyMasks(masks);
  }, [
    status,
    words,
    lines,
    censorPII,
    applyMasks,
    removeAllTagged,
    ocr.lines,
    detectors,
  ]);

  // Reset all PII state if screenshot changes
  useEffect(() => {
    censorAppliedRef.current = false;
    piiMasksRef.current = [];
    piiMaskIdsRef.current.clear();
    autoCensorIdsRef.current = [];
    setPiiMasks([]);
  }, [screenshot.imageDataUrl]);

  // Public helpers for editor interactions
  const recordManualMaskOnCommit = useCallback(
    (
      shape: EditorShape,
      bounds: { x: number; y: number; width: number; height: number },
    ) => {
      const { tag } = shape;
      if (!tag || !tag.startsWith('pii-')) return;
      const shapeId = shape.id;
      setPiiMasks((prev) => {
        const newIndex = prev.length;
        piiMaskIdsRef.current.set(shapeId, newIndex);
        return [
          ...prev,
          {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            tag,
          },
        ];
      });
    },
    [],
  );

  const updateMaskForShape = useCallback(
    (
      shapeId: string,
      rect: { x: number; y: number; width: number; height: number },
    ) => {
      const maskIndex = piiMaskIdsRef.current.get(shapeId);
      if (maskIndex === undefined) return;
      setPiiMasks((prev) => {
        if (maskIndex < 0 || maskIndex >= prev.length) return prev;
        const next = prev.slice();
        next[maskIndex] = {
          ...next[maskIndex],
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        };
        return next;
      });
    },
    [],
  );

  const syncDraggedMaskBounds = useCallback(
    (shapeId: string) => {
      const shape = getShapeById(shapeId);
      if (!shape) return;
      const { tag } = shape;
      if (!tag || !tag.startsWith('pii-')) return;
      const b = getBoundsForShape(shape);
      const idx = piiMaskIdsRef.current.get(shapeId);
      if (idx === undefined) return;
      setPiiMasks((prev) => {
        if (idx < 0 || idx >= prev.length) return prev;
        const next = prev.slice();
        next[idx] = {
          ...next[idx],
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
        };
        return next;
      });
    },
    [getShapeById, getBoundsForShape],
  );

  const deletePiiForShapeId = useCallback(
    (shapeId: string) => {
      const shape = getShapeById(shapeId);
      if (!shape) return;
      const { tag } = shape;
      if (!tag || !tag.startsWith('pii-')) return;
      const idx = piiMaskIdsRef.current.get(shapeId);
      if (idx === undefined) return;
      setPiiMasks((prev) => {
        if (idx < 0 || idx >= prev.length) return prev;
        const next = prev.slice();
        next.splice(idx, 1);
        return next;
      });
      piiMaskIdsRef.current.delete(shapeId);
      Array.from(piiMaskIdsRef.current.entries()).forEach(([key, value]) => {
        if (value > idx) piiMaskIdsRef.current.set(key, value - 1);
      });
    },
    [getShapeById],
  );

  return {
    censorPII,
    setCensorPII: updateCensorPII,
    defaultStyle,
    recordManualMaskOnCommit,
    updateMaskForShape,
    syncDraggedMaskBounds,
    deletePiiForShapeId,
  };
}

export default usePiiMasking;
