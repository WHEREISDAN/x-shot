export type TooltipPlacement = 'top' | 'bottom';
export type TooltipAlign = 'start' | 'center' | 'end';

/** A tooltip drawn by Tooltip.module.css from data attributes. */
export interface TooltipProps {
  tooltip?: string;
  tooltipPlacement?: TooltipPlacement;
  tooltipAlign?: TooltipAlign;
}
