import React, { memo } from 'react';
import type { PresentationSettings } from '../../hooks/use-presentation-state';
import { toCssGradient } from './gradient-presets';
import type { EditorShape, RectShape } from '../../hooks/use-editor-state';
import { StageLayers } from './editor-stage-layers';

export interface EditorStageProps {
  natural: { width: number; height: number };
  presentationDisabled: boolean;
  layout: {
    frame: {
      x: number;
      y: number;
      width: number;
      height: number;
      radius: number;
    };
    shot: { x: number; y: number; width: number; height: number };
    canvas: { width: number; height: number };
  };
  pan: { x: number; y: number };
  viewScale: number;
  presentation: PresentationSettings;
  screenshotUrl: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  imgRef: React.RefObject<HTMLImageElement | null>;
  exportStageRef?: React.RefObject<HTMLDivElement> | null;
  onWheel: (e: React.WheelEvent) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  shapes: EditorShape[];
  piiMasks: RectShape[];
  provisionalShape: EditorShape | null;
  showOcrOverlay: boolean;
  ocrBoxes: Array<{ x: number; y: number; width: number; height: number }>;
  ocrKeyPrefix: string;
  isExporting?: boolean;
  renderSelectionOverlay: (() => React.ReactNode) | undefined;
}

export const EditorStage = memo(function EditorStage({
  natural,
  presentationDisabled,
  layout,
  pan,
  viewScale,
  presentation,
  screenshotUrl,
  containerRef,
  imgRef,
  exportStageRef = null,
  onWheel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onDoubleClick,
  onKeyDown,
  onContextMenu,
  shapes,
  piiMasks,
  provisionalShape,
  showOcrOverlay,
  ocrBoxes,
  ocrKeyPrefix,
  isExporting = false,
  renderSelectionOverlay,
}: EditorStageProps) {
  const canvasW = presentationDisabled ? natural.width : layout.canvas.width;
  const canvasH = presentationDisabled ? natural.height : layout.canvas.height;

  let stageBackground = 'transparent';
  if (!presentationDisabled) {
    if (presentation.backgroundImageUrl) {
      stageBackground = `url(${presentation.backgroundImageUrl}) center / cover no-repeat`;
    } else {
      stageBackground = toCssGradient(presentation.gradient);
    }
  }

  return (
    <div
      ref={containerRef}
      onWheel={onWheel}
      style={{
        position: 'relative',
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <div
        ref={exportStageRef}
        style={{
          position: 'relative',
          width: canvasW,
          height: canvasH,
          minWidth: canvasW,
          minHeight: canvasH,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${viewScale})`,
          transformOrigin: 'center center',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          background: stageBackground,
          borderRadius: presentationDisabled ? 0 : 24,
        }}
      >
        {!presentationDisabled ? (
          <div
            style={{
              position: 'absolute',
              left: layout.frame.x,
              top: layout.frame.y,
              width: layout.frame.width,
              height: layout.frame.height,
              borderRadius: layout.frame.radius,
              boxShadow: presentation.shadow.enabled
                ? `${presentation.shadow.x}px ${presentation.shadow.y}px ${presentation.shadow.blur}px ${presentation.shadow.spread}px ${presentation.shadow.color}`
                : 'none',
              background: presentation.borderColor,
              overflow: 'hidden',
            }}
          >
            {(() => {
              const innerRadius = Math.max(
                0,
                Math.min(
                  layout.frame.radius - presentation.inset,
                  Math.min(layout.shot.width, layout.shot.height) / 2,
                ),
              );
              return (
                <div
                  style={{
                    position: 'absolute',
                    left: layout.shot.x - layout.frame.x,
                    top: layout.shot.y - layout.frame.y,
                    width: layout.shot.width,
                    height: layout.shot.height,
                    borderRadius: innerRadius,
                    overflow: 'hidden',
                  }}
                >
                  <img
                    ref={imgRef}
                    src={screenshotUrl}
                    alt="Screenshot"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      background: '#0f0f10',
                    }}
                  />
                  <svg
                    width={layout.shot.width}
                    height={layout.shot.height}
                    viewBox={`0 0 ${natural.width} ${natural.height}`}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      pointerEvents: 'auto',
                    }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onDoubleClick={onDoubleClick}
                    onKeyDown={onKeyDown}
                    onContextMenu={onContextMenu}
                  >
                    <StageLayers
                      shapes={shapes}
                      piiMasks={piiMasks}
                      provisionalShape={provisionalShape}
                      showOcrOverlay={showOcrOverlay}
                      ocrBoxes={ocrBoxes}
                      ocrKeyPrefix={ocrKeyPrefix}
                      isExporting={isExporting}
                      renderSelectionOverlay={renderSelectionOverlay}
                    />
                  </svg>
                </div>
              );
            })()}
          </div>
        ) : (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: natural.width,
              height: natural.height,
              overflow: 'hidden',
            }}
          >
            <img
              ref={imgRef}
              src={screenshotUrl}
              alt="Screenshot"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                background: '#0f0f10',
              }}
            />
            <svg
              width={natural.width}
              height={natural.height}
              viewBox={`0 0 ${natural.width} ${natural.height}`}
              style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              <StageLayers
                shapes={shapes}
                piiMasks={piiMasks}
                provisionalShape={provisionalShape}
                showOcrOverlay={showOcrOverlay}
                ocrBoxes={ocrBoxes}
                ocrKeyPrefix={ocrKeyPrefix}
                isExporting={isExporting}
                renderSelectionOverlay={renderSelectionOverlay}
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
});
