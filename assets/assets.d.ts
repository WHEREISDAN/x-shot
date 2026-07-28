type Styles = Record<string, string>;

declare module '*.svg' {
  import React = require('react');

  export const ReactComponent: React.FC<React.SVGProps<SVGSVGElement>>;

  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.scss' {
  const content: Styles;
  export default content;
}

declare module '*.sass' {
  const content: Styles;
  export default content;
}

declare module '*.css' {
  const content: Styles;
  export default content;
}

declare module 'tesseract.js/dist/worker.min.js' {
  const content: string;
  export default content;
}

declare module 'tesseract.js-core/tesseract-core.wasm.js' {
  const content: string;
  export default content;
}

declare module '*.traineddata.gz' {
  const content: string;
  export default content;
}
