declare module 'dom-to-image-more' {
  export interface Options {
    width?: number;
    height?: number;
    style?: Record<string, any>;
    bgcolor?: string;
    filter?: (node: Node) => boolean;
    quality?: number;
    cacheBust?: boolean;
  }

  export function toPng(element: HTMLElement, options?: Options): Promise<string>;
  export function toBlob(element: HTMLElement, options?: Options): Promise<Blob>;
  export function toSvg(element: HTMLElement, options?: Options): Promise<string>;
  export function toJpeg(element: HTMLElement, options?: Options): Promise<string>;

  const domtoimage: {
    toPng: typeof toPng;
    toBlob: typeof toBlob;
    toSvg: typeof toSvg;
    toJpeg: typeof toJpeg;
  };

  export default domtoimage;
}