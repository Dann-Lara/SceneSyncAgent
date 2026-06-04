import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { ChapterScene } from "./Chapter";
import { Intro } from "./Intro";
import { Outro } from "./Outro";
import type { VideoInput } from "../types";

const CROSSFADE_FRAMES = 90;
const MUSIC_VOLUME = 0.10;
const TRANSITION_FRAMES = 30;
const CHAPTER_PAUSE_FRAMES = 60;

const ChapterPlayer: React.FC<{
  scene: VideoInput["scenes"][number];
  style: VideoInput["channelStyle"];
  isFirst: boolean;
  isLast: boolean;
  transitionDuration: number;
}> = ({ scene, style, isFirst, isLast, transitionDuration }) => {
  const frame = useCurrentFrame();
  return (
    <ChapterScene
      scene={scene}
      style={style}
      currentFrame={frame}
      isFirst={isFirst}
      isLast={isLast}
      transitionDuration={transitionDuration}
    />
  );
};

const OutroPlayer: React.FC<{
  duration: number;
  style: VideoInput["channelStyle"];
  videoPath?: string;
}> = ({ duration, style, videoPath }) => {
  const frame = useCurrentFrame();
  return <Outro duration={duration} channelStyle={style} videoPath={videoPath} />;
};

export const Main: React.FC<VideoInput & Record<string, unknown>> = ({
  scenes = [],
  channelStyle,
  introDuration = 150,
  outroDuration = 150,
  introVideo,
  outroVideo,
  backgroundMusic,
  musicTracks,
}) => {
  const frame = useCurrentFrame();

  const seqDuration = (s: VideoInput["scenes"][number]) => s.durationInFrames || 1;
  const sumScenes = (sum: number, s: VideoInput["scenes"][number]) => sum + seqDuration(s);

  const audioTotal = introDuration + scenes.reduce(sumScenes, 0) + outroDuration;
  const numPauses = Math.max(0, scenes.length - 1);
  const interChapterTransitions = scenes.length > 1 ? (scenes.length - 1) * 1 : 0;

  const sequencesTotal = introDuration
    + scenes.reduce(sumScenes, 0)
    + outroDuration;
  const transitionsTotal = (scenes.length > 0 ? 2 : 0) * TRANSITION_FRAMES
    + interChapterTransitions;
  const visualTotal = sequencesTotal - transitionsTotal;

  if (frame >= sequencesTotal) return null;

  const transitionChildren: React.ReactNode[] = [];

  transitionChildren.push(
    <TransitionSeries.Sequence key="intro" durationInFrames={introDuration}>
      <Intro duration={introDuration} channelStyle={channelStyle} videoPath={introVideo} />
    </TransitionSeries.Sequence>
  );

  scenes.forEach((scene, i) => {
    const isLast = i === scenes.length - 1;

    const inTransDuration = i === 0 ? TRANSITION_FRAMES : 1;
    transitionChildren.push(
      <TransitionSeries.Transition key={`t-in-${i}`} presentation={fade() as never} timing={linearTiming({ durationInFrames: inTransDuration })} />
    );
    transitionChildren.push(
      <TransitionSeries.Sequence key={`s-${i}`} durationInFrames={scene.durationInFrames}>
        <ChapterPlayer
          scene={scene}
          style={channelStyle}
          isFirst={i === 0}
          isLast={isLast}
          transitionDuration={channelStyle.transitionDuration}
        />
      </TransitionSeries.Sequence>
    );

    // Chapter handles its own CRT via CHAPTER_PAUSE; next t-in-{i+1} transitions directly
  });

  if (scenes.length > 0) {
    transitionChildren.push(
      <TransitionSeries.Transition key="outro-t" presentation={fade() as never} timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })} />
    );
  }
  transitionChildren.push(
    <TransitionSeries.Sequence key="outro" durationInFrames={outroDuration}>
      <OutroPlayer duration={outroDuration} style={channelStyle} videoPath={outroVideo} />
    </TransitionSeries.Sequence>
  );

  const sceneAudioStarts: number[] = [];
  let acc = introDuration;
  for (const s of scenes) {
    sceneAudioStarts.push(acc);
    acc += s.durationInFrames;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: channelStyle.backgroundColor }}>
      <TransitionSeries>
        {transitionChildren}
      </TransitionSeries>

      {scenes.map((s, i) => (
        <Sequence key={i} from={sceneAudioStarts[i]} durationInFrames={s.durationInFrames}>
          <Audio
            src={s.audioPath ? staticFile(s.audioPath) : undefined}
            volume={1}
          />
        </Sequence>
      ))}

      {musicTracks?.map((track) => {
        const firstCh = track.chapterStart;
        const lastCh = Math.min(track.chapterEnd, scenes.length - 1);
        const chStart = sceneAudioStarts[firstCh];
        const chEnd = sceneAudioStarts[lastCh] + scenes[lastCh].durationInFrames;
        const coversLastChapter = lastCh === scenes.length - 1;
        const extendToEnd = coversLastChapter;
        const endFrame = extendToEnd ? visualTotal : Math.min(visualTotal, chEnd + CROSSFADE_FRAMES);
        const startFrame = firstCh === 0 ? 0 : Math.max(0, chStart - CROSSFADE_FRAMES);
        const dur = Math.max(1, endFrame - startFrame);
        const skipFadeIn = extendToEnd;
        return (
          <Sequence key={track.path} from={startFrame} durationInFrames={dur}>
            <Audio
              src={staticFile(track.path)}
              volume={(f) => {
                if (!skipFadeIn && f < CROSSFADE_FRAMES) return MUSIC_VOLUME * (f / CROSSFADE_FRAMES);
                const fadeOutStart = dur - CROSSFADE_FRAMES;
                if (f > fadeOutStart) return MUSIC_VOLUME * ((dur - f) / CROSSFADE_FRAMES);
                return MUSIC_VOLUME;
              }}
            />
          </Sequence>
        );
      })}

      {!musicTracks && backgroundMusic && (
        <Sequence from={0} durationInFrames={visualTotal}>
          <Audio src={staticFile(backgroundMusic)} volume={MUSIC_VOLUME} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
