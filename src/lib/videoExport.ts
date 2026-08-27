import type { Background, CanvasDimensions, ParsedSlide, TemplateId } from '../types';
import { drawTextOverlay, drawVideoCover } from './render';

function adaptiveBitrate(durationSec: number): number {
  if (durationSec <= 30) return 8_000_000;
  if (durationSec <= 90) return 5_000_000;
  return 4_000_000;
}

export async function exportVideoSlide(
  slide: ParsedSlide,
  background: Background,
  template: TemplateId,
  dims: CanvasDimensions,
  video: HTMLVideoElement,
  durationSec: number,
  onProgress?: (progress: number) => void,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = dims.width;
  canvas.height = dims.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const stream = canvas.captureStream(30);
  const mimeCandidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  let recorder: MediaRecorder | null = null;
  const bitrate = adaptiveBitrate(durationSec);
  for (const mime of mimeCandidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
      break;
    }
  }
  if (!recorder) recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const useRVFC = typeof video.requestVideoFrameCallback === 'function';

  return new Promise<Blob | null>((resolve) => {
    recorder!.onstop = () => resolve(chunks.length > 0 ? new Blob(chunks, { type: 'video/webm' }) : null);

    const drawFrame = () => {
      ctx.clearRect(0, 0, dims.width, dims.height);
      drawVideoCover(ctx, video, dims.width, dims.height);
      const overlayAlpha = template === 'minimal' ? 0.4 : 0.25;
      ctx.fillStyle = `rgba(0,0,0,${overlayAlpha})`;
      ctx.fillRect(0, 0, dims.width, dims.height);
      drawTextOverlay(ctx, slide, template, dims);
    };

    video.currentTime = 0;
    video.muted = true;
    video.play().then(() => {
      recorder!.start(1000);
      const startTime = performance.now();

      const finish = () => {
        video.pause();
        if (recorder!.state !== 'inactive') recorder!.stop();
      };

      if (useRVFC) {
        const tick = () => {
          drawFrame();
          const elapsed = (performance.now() - startTime) / 1000;
          onProgress?.(Math.min(elapsed / durationSec, 1));
          if (elapsed >= durationSec) {
            finish();
            return;
          }
          video.requestVideoFrameCallback(tick);
        };
        video.requestVideoFrameCallback(tick);
      } else {
        const tick = () => {
          drawFrame();
          const elapsed = (performance.now() - startTime) / 1000;
          onProgress?.(Math.min(elapsed / durationSec, 1));
          if (elapsed >= durationSec) {
            finish();
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }).catch(() => {
      resolve(null);
    });
  });
}
