/**
 * Shared bounds for presentation controls in the editor UI and validation in
 * preferences-schema, ensuring UI values round-trip without silent clamping.
 */
const PRESENTATION_BOUNDS = {
  padding: { min: 0, max: 400, schemaMax: 512 },
  inset: { min: 0, max: 200, schemaMax: 256 },
  radius: { min: 0, max: 200, schemaMax: 512 },
  shadowX: { min: -64, max: 64, schemaMin: -200, schemaMax: 200 },
  shadowY: { min: -64, max: 64, schemaMin: -200, schemaMax: 200 },
  shadowBlur: { min: 0, max: 296, schemaMax: 300 },
  shadowSpread: { min: 0, max: 264, schemaMin: -100, schemaMax: 264 },
  customAspect: { min: 1, max: 10000 },
} as const;

export default PRESENTATION_BOUNDS;
