import path from 'path';
import { app } from 'electron';

export default function getResourcesPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');
}
