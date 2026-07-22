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
const DUCK_RAMP_FRAMES = 15;
const FULL_VOLUME_FADE = 15;
const CHAPTER_AUDIO_EXTRA = 15;

const easeInOut = (t: number) => t * t * (3 - 2 * t);

const ChapterPlayer: React.FC<{
  scene: VideoInput["scenes"][number];
  style: VideoInput["channelStyle"];
  isFirst: boolean;
  isLast: boolean;
  transitionDuration: number;
  totalChapters: number;
  protagonistPalettes?: Record<string, { primaryColor: string; secondaryColor: string }>;
}> = ({ scene, style, isFirst, isLast, transitionDuration, totalChapters, protagonistPalettes }) => {
  const frame = useCurrentFrame();
  return (
    <ChapterScene
      scene={scene}
      style={style}
      currentFrame={frame}
      isFirst={isFirst}
      isLast={isLast}
      transitionDuration={transitionDuration}
      totalChapters={totalChapters}
      protagonistPalettes={protagonistPalettes}
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

  const protagonistPalettes = channelStyle.contentPalettes;

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
            totalChapters={scenes.length}
            protagonistPalettes={protagonistPalettes}
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

  const chapterFirstWord: number[] = [];
  const chapterLastWord: number[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    const scStart = sceneAudioStarts[i];
    let fw = scStart;
    if (sc.silences?.[0]?.startFrame === 0) fw = scStart + sc.silences[0].endFrame;
    chapterFirstWord.push(fw);
    let lw = scStart + sc.durationInFrames;
    const ls = sc.silences?.at(-1);
    if (ls && ls.endFrame >= sc.durationInFrames * 0.8) lw = scStart + ls.startFrame;
    chapterLastWord.push(lw);
  }

  let firstWordFrame = chapterFirstWord[0] ?? sceneAudioStarts[0];
  let lastWordEnd = chapterLastWord.at(-1) ?? (sceneAudioStarts[scenes.length - 1] + scenes[scenes.length - 1].durationInFrames);

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

      {musicTracks?.map((track, i) => {
        return (
          <Sequence key={track.path} from={track.startFrame} durationInFrames={track.durationInFrames}>
            <Audio
              src={staticFile(track.path)}
              volume={(f) => {
                const globalFrame = track.startFrame + f;

                let crossfadeFactor = 1;
                if (i > 0 && f < CROSSFADE_FRAMES) crossfadeFactor = f / CROSSFADE_FRAMES;
                else if (f > track.durationInFrames - CROSSFADE_FRAMES) crossfadeFactor = (track.durationInFrames - f) / CROSSFADE_FRAMES;

                if (globalFrame < firstWordFrame) {
                  const fadeStart = firstWordFrame - FULL_VOLUME_FADE;
                  if (globalFrame <= fadeStart) return 1.0 * crossfadeFactor;
                  const t = (globalFrame - fadeStart) / FULL_VOLUME_FADE;
                  return (1.0 * (1 - t) + MUSIC_VOLUME * t) * crossfadeFactor;
                }

                if (globalFrame >= lastWordEnd) {
                  const fadeEnd = lastWordEnd + FULL_VOLUME_FADE;
                  if (globalFrame >= fadeEnd) return 1.0 * crossfadeFactor;
                  const t = (globalFrame - lastWordEnd) / FULL_VOLUME_FADE;
                  return (MUSIC_VOLUME * (1 - t) + 1.0 * t) * crossfadeFactor;
                }

                for (let ci = 0; ci < scenes.length - 1; ci++) {
                  const gapStart = chapterLastWord[ci];
                  const gapEnd = chapterFirstWord[ci + 1];
                  if (globalFrame >= gapStart && globalFrame < gapEnd) {
                    const boost = Math.min((gapEnd - gapStart) / 30 * 0.5, 2.0);
                    const rampUp = gapStart + DUCK_RAMP_FRAMES;
                    const rampDown = gapEnd - DUCK_RAMP_FRAMES;
                    if (globalFrame < rampUp) {
                      const t = (globalFrame - gapStart) / DUCK_RAMP_FRAMES;
                      return MUSIC_VOLUME * crossfadeFactor * (1 + boost * easeInOut(t));
                    }
                    if (globalFrame >= rampDown) {
                      const t = (globalFrame - rampDown) / DUCK_RAMP_FRAMES;
                      return MUSIC_VOLUME * crossfadeFactor * (1 + boost * easeInOut(1 - t));
                    }
                    return MUSIC_VOLUME * crossfadeFactor * (1 + boost);
                  }
                }

                for (let s = 0; s < scenes.length; s++) {
                  const sc = scenes[s];
                  const scStart = sceneAudioStarts[s];
                  const scEnd = scStart + sc.durationInFrames;
                  if (globalFrame >= scStart && globalFrame < scEnd && sc.silences) {
                    const localFrame = globalFrame - scStart;
                    for (const sil of sc.silences) {
                      if (sil.startFrame === 0) continue;
                      if (sil.endFrame >= sc.durationInFrames * 0.8) continue;
                      const minRamp = sil.startFrame - DUCK_RAMP_FRAMES;
                      const maxRamp = sil.endFrame + DUCK_RAMP_FRAMES;
                      if (localFrame < minRamp || localFrame >= maxRamp) continue;
                      const boost = Math.min(sil.durationInFrames / 30 * 0.5, 2.0);
                      if (localFrame >= sil.startFrame && localFrame < sil.endFrame) {
                        return MUSIC_VOLUME * crossfadeFactor * (1 + boost);
                      }
                      if (localFrame >= minRamp && localFrame < sil.startFrame) {
                        return MUSIC_VOLUME * crossfadeFactor * (1 + boost * easeInOut((localFrame - minRamp) / DUCK_RAMP_FRAMES));
                      }
                      if (localFrame >= sil.endFrame && localFrame < maxRamp) {
                        return MUSIC_VOLUME * crossfadeFactor * (1 + boost * easeInOut(1 - (localFrame - sil.endFrame) / DUCK_RAMP_FRAMES));
                      }
                    }
                    return MUSIC_VOLUME * crossfadeFactor;
                  }
                }
                return MUSIC_VOLUME * crossfadeFactor;
              }}
            />
          </Sequence>
        );
      })}

      {!musicTracks && backgroundMusic && (
        <Sequence from={0} durationInFrames={visualTotal}>
          <Audio
            src={staticFile(backgroundMusic)}
            volume={(f) => {
              if (f < firstWordFrame) {
                const fadeStart = firstWordFrame - FULL_VOLUME_FADE;
                if (f <= fadeStart) return 1.0;
                const t = (f - fadeStart) / FULL_VOLUME_FADE;
                return 1.0 * (1 - t) + MUSIC_VOLUME * t;
              }

              if (f >= lastWordEnd) {
                const fadeEnd = lastWordEnd + FULL_VOLUME_FADE;
                if (f >= fadeEnd) return 1.0;
                const t = (f - lastWordEnd) / FULL_VOLUME_FADE;
                return MUSIC_VOLUME * (1 - t) + 1.0 * t;
              }

              for (let s = 0; s < scenes.length; s++) {
                const sc = scenes[s];
                const scStart = sceneAudioStarts[s];
                const scEnd = scStart + sc.durationInFrames;
                if (f >= scStart && f < scEnd && sc.silences) {
                  const localFrame = f - scStart;
                  for (const sil of sc.silences) {
                    const minRamp = sil.startFrame - DUCK_RAMP_FRAMES;
                    const maxRamp = sil.endFrame + DUCK_RAMP_FRAMES;
                    if (localFrame < minRamp || localFrame >= maxRamp) continue;
                    const boost = Math.min(sil.durationInFrames / 30 * 0.5, 2.0);
                    if (localFrame >= sil.startFrame && localFrame < sil.endFrame) {
                      return MUSIC_VOLUME * (1 + boost);
                    }
                    if (localFrame >= minRamp && localFrame < sil.startFrame) {
                      return MUSIC_VOLUME * (1 + boost * easeInOut((localFrame - minRamp) / DUCK_RAMP_FRAMES));
                    }
                    if (localFrame >= sil.endFrame && localFrame < maxRamp) {
                      return MUSIC_VOLUME * (1 + boost * easeInOut(1 - (localFrame - sil.endFrame) / DUCK_RAMP_FRAMES));
                    }
                  }
                  return MUSIC_VOLUME;
                }
              }
              return MUSIC_VOLUME;
            }}
          />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
