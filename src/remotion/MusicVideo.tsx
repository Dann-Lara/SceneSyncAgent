import React, { useMemo } from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { MusicVideoChapter } from "./MusicVideoChapter";
import { MusicVideoIntro } from "./MusicVideoIntro";
import { MusicVideoOutro } from "./MusicVideoOutro";
import { MusicVideoVisualizer } from "./MusicVideoVisualizer";
import { MusicVideoTitleBar } from "./MusicVideoTitleBar";
import { LyricsOverlay } from "./LyricsOverlay";
import type { Scene, ChannelStyle, SubtitleLine } from "../types";

const CROSSFADE_FRAMES = 90;
const TRANSITION_FRAMES = 30;

interface MusicVideoInput {
  channelStyle: ChannelStyle;
  scenes: Scene[];
  songPath: string;
  introDuration: number;
  outroDuration: number;
  totalFrames: number;
  subtitles?: SubtitleLine[];
  authorName?: string;
}

export const MusicVideo: React.FC<MusicVideoInput & Record<string, unknown>> = ({
  channelStyle,
  scenes = [],
  songPath,
  introDuration = 150,
  outroDuration = 120,
  totalFrames,
  subtitles = [],
  authorName: authorNameProp,
}) => {
  const frame = useCurrentFrame();

  const HOLD_FRAMES = 90;
  const FADE_FRAMES = 15;

  const songTitle = songPath.replace(/\.mp3$/i, "").split(/[/\\]/).pop() || "Music Video";
  const authorName = authorNameProp || "drdann";

  const globalActiveRanges = useMemo(() => {
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

  const globalOverlayOpacity = useMemo(() => {
    for (const r of globalActiveRanges) {
      if (frame >= r.start && frame < r.end) {
        const fadeIn = Math.min(1, (frame - r.start) / FADE_FRAMES);
        const fadeOut = Math.min(1, (r.end - frame) / FADE_FRAMES);
        return Math.min(fadeIn, fadeOut);
      }
    }
    for (const r of globalActiveRanges) {
      const toStart = r.start - frame;
      if (toStart > 0 && toStart <= FADE_FRAMES) return (FADE_FRAMES - toStart) / FADE_FRAMES;
      const toEnd = frame - r.end;
      if (toEnd > 0 && toEnd <= FADE_FRAMES) return (FADE_FRAMES - toEnd) / FADE_FRAMES;
    }
    return 0;
  }, [frame, globalActiveRanges]);

  if (frame >= totalFrames) return null;

  const sceneAudioStarts: number[] = [];
  let acc = introDuration;
  for (const s of scenes) {
    sceneAudioStarts.push(acc);
    acc += s.durationInFrames;
  }

  const transitionChildren: React.ReactNode[] = [];

  transitionChildren.push(
    <TransitionSeries.Sequence key="intro" durationInFrames={introDuration}>
      <MusicVideoIntro
        channelName={channelStyle.channelName}
        songTitle={songTitle}
        authorName={authorName}
        primaryColor={channelStyle.primaryColor}
        secondaryColor={channelStyle.secondaryColor}
        backgroundColor={channelStyle.backgroundColor}
        fontFamily={channelStyle.fontFamily}
      />
    </TransitionSeries.Sequence>
  );

  let audioStartAcc = introDuration;
  scenes.forEach((scene, i) => {
    const isLast = i === scenes.length - 1;
    const inTransDuration = i === 0 ? TRANSITION_FRAMES : 1;

    transitionChildren.push(
      <TransitionSeries.Transition
        key={`t-in-${i}`}
        presentation={fade() as never}
        timing={linearTiming({ durationInFrames: inTransDuration })}
      />
    );
    transitionChildren.push(
      <TransitionSeries.Sequence key={`s-${i}`} durationInFrames={scene.durationInFrames}>
    <MusicVideoChapter
      scene={scene}
      style={channelStyle}
      songPath={songPath}
      audioStartFrame={audioStartAcc}
      transitionDuration={channelStyle.transitionDuration}
      subtitles={subtitles}
    />
      </TransitionSeries.Sequence>
    );
    audioStartAcc += scene.durationInFrames;
  });

  if (scenes.length > 0) {
    transitionChildren.push(
      <TransitionSeries.Transition
        key="outro-t"
        presentation={fade() as never}
        timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
      />
    );
  }

  transitionChildren.push(
    <TransitionSeries.Sequence key="outro" durationInFrames={outroDuration}>
      <MusicVideoOutro
        channelName={channelStyle.channelName}
        songTitle={songTitle}
        authorName={authorName}
        primaryColor={channelStyle.primaryColor}
        secondaryColor={channelStyle.secondaryColor}
        backgroundColor={channelStyle.backgroundColor}
        fontFamily={channelStyle.fontFamily}
      />
    </TransitionSeries.Sequence>
  );

  const vizStartFade = 150;
  const vizEndFade = totalFrames - 120;
  const vizOpacity = frame < vizStartFade
    ? interpolate(frame, [0, vizStartFade], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : frame > vizEndFade
      ? interpolate(frame, [vizEndFade, totalFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: channelStyle.backgroundColor }}>
      <TransitionSeries>
        {transitionChildren}
      </TransitionSeries>

      <Sequence from={0} durationInFrames={totalFrames}>
        <Audio src={staticFile(songPath)} volume={1} />
      </Sequence>

      {globalOverlayOpacity > 0 && <div style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.2)",
        opacity: globalOverlayOpacity,
        zIndex: 5,
        pointerEvents: "none",
      }} />}

      <MusicVideoTitleBar
        title={songTitle}
        authorName={authorName}
        primaryColor={channelStyle.primaryColor}
        secondaryColor={channelStyle.secondaryColor}
        fontFamily={channelStyle.fontFamily}
        fadeInStart={introDuration + 30}
        fadeInEnd={introDuration + 60}
        fadeOutStart={totalFrames - outroDuration - 60}
        fadeOutEnd={totalFrames - outroDuration - 30}
      />

      <div style={{ opacity: vizOpacity }}>
        <MusicVideoVisualizer
          songPath={songPath}
          colorA={channelStyle.primaryColor}
          colorB={channelStyle.secondaryColor}
        />
      </div>

      {subtitles.length > 0 && (
        <LyricsOverlay
          subtitles={subtitles}
          fontFamily={channelStyle.fontFamily}
          primaryColor={channelStyle.primaryColor}
        />
      )}
    </AbsoluteFill>
  );
};
