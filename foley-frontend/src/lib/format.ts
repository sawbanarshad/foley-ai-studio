export function formatSeconds(sec: number): string {
  return `${sec.toFixed(2)}s`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatFrameTime(time: number, fps: number): string {
  const frame = Math.round(time * fps);
  return `${time.toFixed(2)}s · f${frame}`;
}