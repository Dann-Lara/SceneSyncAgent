import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import type { Scene, ChannelStyle, SubtitleLine } from "../types";
import { applyTransition, getTransitionTransform, getTransitionOverlay } from "./Transitions";
import { Storm } from "./Storm";
import { useMemo } from "react";

interface MusicVideoChapterProps {
  scene: Scene;
  style: ChannelStyle;
  transitionDuration: number;
  songPath: string;
  audioStartFrame: number;
  subtitles: SubtitleLine[];
}

export const MusicVideoChapter: React.FC<MusicVideoChapterProps> = ({
  scene,
  style,
  transitionDuration,
  songPath,
  audioStartFrame,
  subtitles,
}) => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const audioData = useAudioData(staticFile(songPath));

  const HOLD_FRAMES = 90;
  const FADE_FRAMES = 15;
  const globalFrame = audioStartFrame + frame;

  const activeRanges = useMemo(() => {
    if (!subtitles.length) return [];
    const sorted = [...subtitles].sort((a, b) => a.startFrame - b.startFrame);
    const merged: { start: number; end: number }[] = [];
    let cur = { start: sorted[0].startFrame, end: sorted[0].endFrame + HOLD_FRAMES };
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startFrame <= cur.end) {
        cur.end = Math.max(cur.end, sorted[i].endFrame + HOLD_FRAMES);
      } else {
        merged.push(cur);
        cur = { start: sorted[i].startFrame, end: sorted[i].endFrame + HOLD_FRAMES };
      }
    }
    merged.push(cur);
    return merged;
  }, [subtitles]);

  const overlayOpacity = useMemo(() => {
    for (const r of activeRanges) {
      if (globalFrame >= r.start && globalFrame < r.end) {
        const fadeIn = Math.min(1, (globalFrame - r.start) / FADE_FRAMES);
        const fadeOut = Math.min(1, (r.end - globalFrame) / FADE_FRAMES);
        return Math.min(fadeIn, fadeOut);
      }
    }
    for (const r of activeRanges) {
      const toStart = r.start - globalFrame;
      if (toStart > 0 && toStart <= FADE_FRAMES) return (FADE_FRAMES - toStart) / FADE_FRAMES;
      const toEnd = globalFrame - r.end;
      if (toEnd > 0 && toEnd <= FADE_FRAMES) return (FADE_FRAMES - toEnd) / FADE_FRAMES;
    }
    return 0;
  }, [globalFrame, activeRanges]);

  const rawFreqs = audioData
    ? visualizeAudio({ audioData, frame: audioStartFrame + frame, fps, numberOfSamples: 32 })
    : new Array(32).fill(0);

  const highFreqSum = rawFreqs.slice(16).reduce((sum, v) => sum + v, 0);
  const highFreqEnergy = rawFreqs.slice(16).length > 0 ? highFreqSum / 16 : 0;

  if (scene.images.length === 0) return null;

  let frameInImage = frame;
  let currentImageIndex = 0;
  let accumulated = 0;

  for (let i = 0; i < scene.images.length; i++) {
    const imgDur = scene.images[i].durationInFrames;
    if (frame < accumulated + imgDur) {
      currentImageIndex = i;
      frameInImage = frame - accumulated;
      break;
    }
    accumulated += imgDur;
    if (i === scene.images.length - 1) {
      currentImageIndex = i;
      frameInImage = Math.min(frame - accumulated, imgDur - 1);
    }
  }

  const image = scene.images[currentImageIndex];
  const nextImage = currentImageIndex < scene.images.length - 1
    ? scene.images[currentImageIndex + 1]
    : undefined;
  const prevImage = currentImageIndex > 0
    ? scene.images[currentImageIndex - 1]
    : undefined;

  const imageDuration = image.durationInFrames;

  const fwdTotal = Math.round((image.transitionDuration ?? transitionDuration) * fps);
  const fwdHalf = Math.max(1, Math.round(fwdTotal / 2));
  const showFwd = nextImage && frameInImage > imageDuration - fwdHalf;

  const bwdTotal = Math.round((prevImage?.transitionDuration ?? transitionDuration) * fps);
  const bwdHalf = Math.max(1, Math.round(bwdTotal / 2));
  const showBwd = prevImage && frameInImage < bwdHalf;

  let p = 0;
  let tType = image.transitionType;
  if (showFwd) {
    p = (frameInImage - (imageDuration - fwdHalf)) / fwdTotal;
  } else if (showBwd) {
    p = (bwdHalf + frameInImage) / bwdTotal;
    tType = prevImage!.transitionType;
  }

  const opacity = interpolate(frameInImage, [0, Math.min(15, imageDuration * 0.1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const kenBurnsScale = interpolate(
    frameInImage,
    [0, imageDuration],
    [image.kenBurnsStart, image.kenBurnsEnd],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  let currentOpacityValue: number;
  if (showFwd) {
    currentOpacityValue = 1 - p;
  } else if (showBwd) {
    currentOpacityValue = p;
  } else if (prevImage && frameInImage >= bwdHalf) {
    currentOpacityValue = 1;
  } else {
    currentOpacityValue = opacity;
  }

  const nextOpacity = showFwd ? p : 0;
  const prevOpacity = showBwd ? 1 - p : 0;

  const overlay = showFwd || showBwd ? getTransitionOverlay(p, tType, style.primaryColor) : null;
  const nextOverlay = showFwd
    ? getTransitionOverlay(p, image.transitionType, style.primaryColor)
    : null;
  const prevOverlay = showBwd
    ? getTransitionOverlay(p, prevImage!.transitionType, style.primaryColor)
    : null;

  const ENERGY_THRESHOLD = 0.12;
  const isTransitioning = showFwd || showBwd;
  const audioHit = isTransitioning && highFreqEnergy > ENERGY_THRESHOLD;
  const flashOpacity = audioHit
    ? interpolate(p, [0, 0.08, 0.2], [0, Math.min(0.35, highFreqEnergy * 3), 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;

  return (
    <div style={{
      width: "100%",
      height: "100%",
      position: "relative",
      overflow: "hidden",
      fontFamily: style.fontFamily,
    }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${kenBurnsScale})${showFwd ? " " + getTransitionTransform(p, image.transitionType) : ""}`,
          opacity: currentOpacityValue,
        }}
      >
        <Img
          src={staticFile(image.path)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        {overlayOpacity > 0 && <div style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0.5) 70%, rgba(0,0,0,0.7) 100%)",
          opacity: overlayOpacity,
        }} />}
      </div>

      {nextImage && showFwd && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: nextOpacity,
            transform: getTransitionTransform(p, image.transitionType),
          }}
        >
          <Img
            src={staticFile(nextImage.path)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          {overlayOpacity > 0 && <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0.5) 70%, rgba(0,0,0,0.7) 100%)",
            opacity: overlayOpacity,
          }} />}
        </div>
      )}

      {prevImage && showBwd && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: prevOpacity,
            transform: getTransitionTransform(p, prevImage!.transitionType),
          }}
        >
          <Img
            src={staticFile(prevImage.path)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          {overlayOpacity > 0 && <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0.5) 70%, rgba(0,0,0,0.7) 100%)",
            opacity: overlayOpacity,
          }} />}
        </div>
      )}

      {overlay && <div style={overlay} />}
      {nextOverlay && showFwd && <div style={nextOverlay} />}
      {prevOverlay && showBwd && <div style={prevOverlay} />}
      {flashOpacity > 0 && (
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "#ffffff",
          opacity: flashOpacity,
          zIndex: 50,
          pointerEvents: "none",
        }} />
      )}

      {scene.climate && scene.climate !== "clear" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 40, pointerEvents: "none" }}>
          <Storm
            frame={frame}
            fps={fps}
            width={width}
            height={height}
            color={style.primaryColor}
            climate={scene.climate}
          />
        </div>
      )}
    </div>
  );
};
