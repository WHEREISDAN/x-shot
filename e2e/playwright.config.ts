import path from 'path';
import { defineConfig } from '@playwright/test';
import webpackPaths from '../.erb/configs/webpack.paths';

export default defineConfig({
  testDir: __dirname,
  testMatch: '*.spec.ts',
  timeout: 180_000,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  outputDir: path.join(webpackPaths.smokeBuildPath, 'test-results'),
});
