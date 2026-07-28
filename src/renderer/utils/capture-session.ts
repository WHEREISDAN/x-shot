let currentCaptureSessionId: string | null = null;

export function setCurrentCaptureSessionId(sessionId?: string): void {
  currentCaptureSessionId = sessionId ?? null;
}

export function getCurrentCaptureSessionId(): string | null {
  return currentCaptureSessionId;
}
