/* eslint import/prefer-default-export: off */
import { URL, pathToFileURL } from 'url';
import path from 'path';

export function resolveHtmlPath(htmlFileName: string) {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || 1212;
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  }
  return pathToFileURL(path.resolve(__dirname, '../renderer/', htmlFileName))
    .href;
}
