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
  totalChapters: number;
  protagonistPalettes?: Record<string, { primaryColor: string; secondaryColor: string }>;
}

export const ChapterScene: React.FC<ChapterProps> = ({
  scene,
  style,
  currentFrame,
  isFirst,
  isLast,
  transitionDuration,
  totalChapters,
  protagonistPalettes,
}) => {
  const { fps } = useVideoConfig();

  const isPause = currentFrame >= scene.durationInFrames - CHAPTER_PAUSE;
  const isListaEdge = style.videoType === "lista" && (scene.chapterIndex === 0 || scene.chapterIndex === totalChapters - 1);

  let primaryColor = style.primaryColor;
  let secondaryColor = style.secondaryColor;

  if (scene.images.length === 0) {
    return (
      <div style={chapterContainer(style)}>
          {isPause ? (
            <CrtChannelChange />
          ) : (
            <>
              {!isListaEdge && <ChapterTitleCard scene={scene} style={style} currentFrame={currentFrame} fps={fps} totalChapters={totalChapters} primaryColor={primaryColor} />}
            <SubtitleOverlay
              subtitles={scene.subtitles}
              currentFrame={currentFrame}
              fps={fps}
              style={style}
              primaryColor={primaryColor}
            />
          </>
        )}
      </div>
    );
  }

  const titleCardFrames = 5 * fps;
  const showTitleCard = currentFrame < titleCardFrames && !isPause && !isListaEdge;

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
  const prevImage = currentImageIndex > 0
    ? scene.images[currentImageIndex - 1]
    : undefined;

  const imageDuration = image.durationInFrames;

  const currentProtagonist = image.protagonist;
  const protagonistPalette = currentProtagonist && protagonistPalettes ? protagonistPalettes[currentProtagonist] : undefined;
  if (protagonistPalette) {
    primaryColor = protagonistPalette.primaryColor;
    secondaryColor = protagonistPalette.secondaryColor;
  }

  // Forward transition: last half of transitionFrames from this image
  const fwdTotal = Math.round(image.transitionDuration * fps);
  const fwdHalf = Math.max(1, Math.round(fwdTotal / 2));
  const showFwd = nextImage && frameInImage > imageDuration - fwdHalf && !isPause;

  // Backward transition: first half of transitionFrames from this image (carried over from prev)
  const bwdTotal = Math.round((prevImage?.transitionDuration ?? 0) * fps);
  const bwdHalf = Math.max(1, Math.round(bwdTotal / 2));
  const showBwd = prevImage && frameInImage < bwdHalf && !isPause;

  // progress: 0→0.5 during showFwd, 0.5→1 during showBwd (continuous across the boundary)
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

  let currentOpacityValue: number;
  if (showFwd) {
    currentOpacityValue = 1 - p;
  } else if (showBwd) {
    currentOpacityValue = p;
  } else if (prevImage && frameInImage >= bwdHalf) {
    // After backward transition (p reached 1.0), skip fade-in — already full opacity
    currentOpacityValue = 1;
  } else {
    currentOpacityValue = opacity;
  }
  const mainOpacity = chapterFadeIn * currentOpacityValue;

  const nextOpacity = showFwd ? p : 0;
  const prevOpacity = showBwd ? 1 - p : 0;

  const overlay = showFwd || showBwd ? getTransitionOverlay(p, tType, primaryColor) : null;
  const nextOverlay = showFwd
    ? getTransitionOverlay(p, image.transitionType, primaryColor)
    : null;
  const prevOverlay = showBwd
    ? getTransitionOverlay(p, prevImage!.transitionType, primaryColor)
    : null;

  return (
    <div style={chapterContainer(style)}>
      {!isPause && (
        <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${kenBurnsScale})${showFwd ? " " + getTransitionTransform(p, image.transitionType) : ""}`,
          opacity: mainOpacity,
        }}
      >
        <Img
          src={staticFile(image.path)}
          style={imageFill}
        />
        <div style={overlayGradient} />
      </div>

      {nextImage && showFwd && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: chapterFadeIn * nextOpacity,
            transform: getTransitionTransform(p, image.transitionType),
          }}
        >
          <Img
            src={staticFile(nextImage.path)}
            style={imageFill}
          />
          <div style={overlayGradient} />
        </div>
      )}

      {prevImage && showBwd && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: chapterFadeIn * prevOpacity,
            transform: getTransitionTransform(p, prevImage!.transitionType),
          }}
        >
          <Img
            src={staticFile(prevImage.path)}
            style={imageFill}
          />
          <div style={overlayGradient} />
        </div>
      )}

      {overlay && <div style={overlay} />}
      {nextOverlay && showFwd && <div style={nextOverlay} />}
      {prevOverlay && showBwd && <div style={prevOverlay} />}

      {showTitleCard && (
        <ChapterTitleCard scene={scene} style={style} currentFrame={currentFrame} fps={fps} totalChapters={totalChapters} primaryColor={primaryColor} />
      )}

      <SubtitleOverlay
        subtitles={scene.subtitles}
        currentFrame={currentFrame}
        fps={fps}
        style={style}
        primaryColor={primaryColor}
      />

      <ParticleOverlay
        frame={currentFrame}
        count={15}
        color={primaryColor}
        speed={0.3}
        sizeRange={[1, 3]}
        opacityRange={[0.02, 0.08]}
      />

      <SceneOverlays sentiment={image.sentiment} color={primaryColor} climate={scene.climate} />

      <GlowShader />
      </>
      )}

      {isPause && (
        <CrtChannelChange />
      )}

      {!isListaEdge && (
      <ProgressBar
        frame={currentFrame}
        totalFrames={scene.durationInFrames}
        color={primaryColor}
        chapterIndex={scene.chapterIndex}
        totalChapters={totalChapters}
        displayIndex={style.videoType === "lista" && scene.chapterIndex > 0 ? scene.chapterIndex : undefined}
        displayTotal={style.videoType === "lista" ? totalChapters - 2 : undefined}
      />
      )}
    </div>
  );
};

const CHAPTER_PAUSE = 15;

const ChapterTitleCard: React.FC<{
  scene: Scene;
  style: ChannelStyle;
  currentFrame: number;
  fps: number;
  totalChapters: number;
  primaryColor?: string;
}> = ({ scene, style, currentFrame, fps, totalChapters, primaryColor: propPrimary }) => {
  const primaryColor = propPrimary ?? style.primaryColor;
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

  if (style.videoType === "lista") {
    const circSpring = spring({
      frame: currentFrame,
      fps,
      config: { damping: 10, mass: 0.6, stiffness: 120 },
    });
    const circScale = interpolate(circSpring, [0, 1], [0.3, 1], { extrapolateRight: "clamp" });

    const numFade = interpolate(currentFrame, [0, 12], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    });

    const titleSlide = interpolate(currentFrame, [10, 35], [30, 0], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    });
    const titleFade = interpolate(currentFrame, [10, 35], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    });

    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: titleOpacity,
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            backgroundColor: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            padding: "50px 80px 40px 80px",
            borderRadius: 16,
            boxShadow: `0 8px 60px rgba(0,0,0,0.8), 0 0 ${80 * glowPulse}px ${primaryColor}33`,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: "50%",
              border: `4px solid ${primaryColor}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px auto",
              transform: `scale(${circScale})`,
              boxShadow: `0 0 50px ${primaryColor}44, inset 0 0 40px ${primaryColor}22`,
              backgroundColor: "rgba(0,0,0,0.5)",
            }}
          >
            <span
              style={{
                color: primaryColor,
                fontSize: 68,
                fontWeight: 900,
                fontFamily: "'Courier New', monospace",
                opacity: numFade,
                textShadow: `0 0 30px ${primaryColor}88`,
              }}
            >
              {String(scene.chapterIndex).padStart(2, "0")}
            </span>
          </div>
          <div
            style={{
              color: "#ffffff",
              fontSize: 40,
              fontWeight: 700,
              lineHeight: 1.3,
              transform: `translateY(${titleSlide}px)`,
              opacity: titleFade,
              textShadow: `0 2px 15px rgba(0,0,0,0.5)`,
            }}
          >
            {scene.title}
          </div>
        </div>
      </div>
    );
  }

  const titleParts = (() => {
    // 1) Pipe separator (explicit 3-part format) — backward compat
    if (scene.title.includes("|")) {
      return scene.title.split("|").map((p: string) => p.trim());
    }
    // 2) Period + colon parsing: "Large. Medium: Small"
    const dotIdx = scene.title.indexOf(".");
    if (dotIdx !== -1) {
      const large = scene.title.slice(0, dotIdx).trim();
      const rest = scene.title.slice(dotIdx + 1).trim();
      const colonIdx = rest.indexOf(":");
      if (colonIdx !== -1) {
        return [large, rest.slice(0, colonIdx).trim(), rest.slice(colonIdx + 1).trim()];
      }
      return [large, rest];
    }
    // 3) Colon only: "Large: Medium"
    const colonIdx = scene.title.indexOf(":");
    if (colonIdx !== -1) {
      return [scene.title.slice(0, colonIdx).trim(), scene.title.slice(colonIdx + 1).trim()];
    }
    return [scene.title.trim()];
  })();

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
          padding: "32px 52px 36px 52px",
          borderRadius: 6,
          borderLeft: `3px solid ${primaryColor}`,
          boxShadow: `0 4px 40px rgba(0,0,0,0.7), 0 0 ${60 * glowPulse}px ${primaryColor}55`,
          maxWidth: 800,
        }}
      >
        <div
          style={{
            color: "#ffffff",
            fontSize: 23,
            letterSpacing: 4,
            textTransform: "uppercase",
            fontWeight: 700,
            marginBottom: 10,
            textShadow: `0 0 20px ${primaryColor}66`,
          }}
        >
          &gt;&gt; CAPÍTULO {String(scene.chapterIndex + 1).padStart(2, "0")}
        </div>
        {titleParts.length === 1 ? (
          <div
            style={{
              color: "#ffffff",
              fontSize: 54,
              fontWeight: 500,
              lineHeight: 1.35,
              textShadow: `0 2px 15px rgba(0,0,0,0.5), 0 0 ${20 * glowPulse}px ${primaryColor}66`,
            }}
          >
            {titleParts[0]}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div
              style={{
                color: "#ffffff",
                fontSize: 48,
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: 3,
                textShadow: `0 2px 15px rgba(0,0,0,0.5), 0 0 ${20 * glowPulse}px ${primaryColor}66`,
              }}
            >
              {titleParts[0]}
            </div>
            <div
              style={{
                color: primaryColor,
                fontSize: 30,
                fontWeight: 400,
                lineHeight: 1.3,
                letterSpacing: 2,
                textShadow: `0 2px 10px rgba(0,0,0,0.4)`,
              }}
            >
              {titleParts[1]}
            </div>
            {titleParts[2] && (
              <div
                style={{
                  color: "#888888",
                  fontSize: 20,
                  fontWeight: 300,
                  fontStyle: "italic",
                  lineHeight: 1.3,
                  letterSpacing: 1,
                  marginTop: 4,
                }}
              >
                {titleParts[2]}
              </div>
            )}
          </div>
        )}
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
