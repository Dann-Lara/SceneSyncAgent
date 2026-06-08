import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Scene, ChannelStyle } from "../types";
import { SubtitleOverlay } from "./SubtitleOverlay";
import { applyTransition, getTransitionTransform, getTransitionOverlay } from "./Transitions";
import { ProgressBar } from "./ProgressBar";
import { ParticleOverlay } from "./ParticleOverlay";
import { CrtChannelChange } from "./CrtChannelChange";
import { SceneOverlays } from "./SceneOverlays";
import { GlowShader } from "./GlowShader";

interface ChapterProps {
  scene: Scene;
  style: ChannelStyle;
  currentFrame: number;
  isFirst: boolean;
  isLast: boolean;
  transitionDuration: number;
}

export const ChapterScene: React.FC<ChapterProps> = ({
  scene,
  style,
  currentFrame,
  isFirst,
  isLast,
  transitionDuration,
}) => {
  const { fps } = useVideoConfig();

  const isPause = currentFrame >= scene.durationInFrames - CHAPTER_PAUSE;

  if (scene.images.length === 0) {
    return (
      <div style={chapterContainer(style)}>
        {isPause ? (
          <CrtChannelChange />
        ) : (
          <>
            <ChapterTitleCard scene={scene} style={style} currentFrame={currentFrame} fps={fps} />
            <SubtitleOverlay
              subtitles={scene.subtitles}
              currentFrame={currentFrame}
              fps={fps}
              style={style}
            />
          </>
        )}
      </div>
    );
  }

  const titleCardFrames = 5 * fps;
  const showTitleCard = currentFrame < titleCardFrames && !isPause;

  let frameInImage = currentFrame;
  let currentImageIndex = 0;
  let accumulated = 0;

  for (let i = 0; i < scene.images.length; i++) {
    const imgDur = scene.images[i].durationInFrames;
    if (currentFrame < accumulated + imgDur) {
      currentImageIndex = i;
      frameInImage = currentFrame - accumulated;
      break;
    }
    accumulated += imgDur;
    if (i === scene.images.length - 1) {
      currentImageIndex = i;
      frameInImage = Math.min(currentFrame - accumulated, imgDur - 1);
    }
  }

  const image = scene.images[currentImageIndex];
  const nextImage = currentImageIndex < scene.images.length - 1
    ? scene.images[currentImageIndex + 1]
    : undefined;

  const imageDuration = image.durationInFrames;
  const transitionFrames = Math.round(image.transitionDuration * fps);
  const showTransition = nextImage && frameInImage > imageDuration - transitionFrames && !isPause;
  const transitionProgress = showTransition
    ? (frameInImage - (imageDuration - transitionFrames)) / transitionFrames
    : 0;

  const opacity = interpolate(frameInImage, [0, Math.min(15, imageDuration * 0.1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const chapterFadeIn = interpolate(currentFrame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const kenBurnsScale = interpolate(
    frameInImage,
    [0, imageDuration],
    [image.kenBurnsStart, image.kenBurnsEnd],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const currentOpacity = showTransition ? applyTransition(transitionProgress, image.transitionType) : opacity;
  const overlay = getTransitionOverlay(transitionProgress, image.transitionType, style.primaryColor);
  const nextOverlay = showTransition
    ? getTransitionOverlay(transitionProgress, nextImage!.transitionType, style.primaryColor)
    : null;

  return (
    <div style={chapterContainer(style)}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${kenBurnsScale})${showTransition ? " " + getTransitionTransform(transitionProgress, image.transitionType) : ""}`,
          opacity: chapterFadeIn * (showTransition ? applyTransition(transitionProgress, image.transitionType) : opacity),
        }}
      >
        <Img
          src={staticFile(image.path)}
          style={imageFill}
        />
        <div style={overlayGradient} />
      </div>

      {nextImage && showTransition && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: chapterFadeIn * applyTransition(transitionProgress, nextImage.transitionType),
            transform: getTransitionTransform(transitionProgress, nextImage.transitionType),
          }}
        >
          <Img
            src={staticFile(nextImage.path)}
            style={imageFill}
          />
          <div style={overlayGradient} />
        </div>
      )}

      {overlay && <div style={overlay} />}
      {nextOverlay && showTransition && <div style={nextOverlay} />}

      {showTitleCard && (
        <ChapterTitleCard scene={scene} style={style} currentFrame={currentFrame} fps={fps} />
      )}

      {!isPause && (
        <SubtitleOverlay
          subtitles={scene.subtitles}
          currentFrame={currentFrame}
          fps={fps}
          style={style}
        />
      )}

      {isPause && (
        <CrtChannelChange />
      )}

      <ProgressBar
        frame={currentFrame}
        totalFrames={scene.durationInFrames}
        color={style.primaryColor}
        chapterIndex={scene.chapterIndex}
        totalChapters={12}
      />

      <ParticleOverlay
        frame={currentFrame}
        count={15}
        color={style.primaryColor}
        speed={0.3}
        sizeRange={[1, 3]}
        opacityRange={[0.02, 0.08]}
      />

      {!isPause && (
        <SceneOverlays sentiment={image.sentiment} color={style.primaryColor} />
      )}

      {!isPause && <GlowShader />}
    </div>
  );
};

const CHAPTER_PAUSE = 60;

const ChapterTitleCard: React.FC<{
  scene: Scene;
  style: ChannelStyle;
  currentFrame: number;
  fps: number;
}> = ({ scene, style, currentFrame, fps }) => {
  const titleCardTotal = 5 * fps;
  const titleProgress = currentFrame / titleCardTotal;

  const slideIn = interpolate(titleProgress, [0, 0.1, 0.9, 1], [30, 0, 0, -15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleOpacity = interpolate(titleProgress, [0, 0.1, 0.9, 1], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glowPulse = interpolate(titleProgress, [0, 0.3, 0.7, 1], [0, 1, 0.8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        left: 60,
        opacity: titleOpacity,
        transform: `translateY(${slideIn}px)`,
        zIndex: 10,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(0,0,0,0.9)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          padding: "24px 36px 28px 36px",
          borderRadius: 6,
          borderLeft: `3px solid ${style.primaryColor}`,
          boxShadow: `0 4px 40px rgba(0,0,0,0.7), 0 0 ${60 * glowPulse}px ${style.primaryColor}55`,
          maxWidth: 800,
        }}
      >
        <div
          style={{
            color: "#ffffff",
            fontSize: 15,
            letterSpacing: 4,
            textTransform: "uppercase",
            fontWeight: 700,
            marginBottom: 10,
            textShadow: `0 0 20px ${style.primaryColor}66`,
          }}
        >
          &gt;&gt; CAPÍTULO {String(scene.chapterIndex + 1).padStart(2, "0")}
        </div>
        <div
          style={{
            color: "#ffffff",
            fontSize: 36,
            fontWeight: 500,
            lineHeight: 1.35,
            textShadow: `0 2px 15px rgba(0,0,0,0.5), 0 0 ${20 * glowPulse}px ${style.primaryColor}66`,
          }}
        >
          {scene.title}
        </div>
      </div>
    </div>
  );
};

const chapterContainer = (style: ChannelStyle): React.CSSProperties => ({
  width: "100%",
  height: "100%",
  position: "relative",
  overflow: "hidden",
  fontFamily: style.fontFamily,
});

const imageFill: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const overlayGradient: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.3) 100%)",
};
