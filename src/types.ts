export type TransitionType = "fade" | "radial" | "glitch" | "flash" | "zoom-blur" | "shatter" | "crossfade" | "slide-left" | "slide-right" | "slide-up" | "slide-down" | "whip" | "3d-flip" | "zoom-in" | "zoom-out" | "pixelate";

export type Sentiment = "calm" | "tension" | "drama" | "terror" | "resolution" | "mystery" | "rage" | "despair" | "triumph" | "dread";

export interface ChannelStyle {
  channelName: string;
  videoTitle: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  fontFamily: string;
  transitionType: TransitionType;
  transitionDuration: number;
  mood: string;
}

export interface SceneImage {
  path: string;
  fileType: "image" | "video";
  caption?: string;
}

export interface ImageMeta extends SceneImage {
  durationInFrames: number;
  transitionType: TransitionType;
  transitionDuration: number;
  sentiment: Sentiment;
  kenBurnsStart: number;
  kenBurnsEnd: number;
}

export interface Scene {
  chapterIndex: number;
  title: string;
  audioPath: string;
  audioDurationSeconds: number;
  durationInFrames: number;
  images: ImageMeta[];
  subtitles?: { start: number; end: number; text: string }[];
}

export interface MusicTrack {
  path: string;
  chapterStart: number;
  chapterEnd: number;
}

export interface VideoInput {
  channelStyle: ChannelStyle;
  scenes: Scene[];
  introDuration: number;
  outroDuration: number;
  introVideo?: string;
  outroVideo?: string;
  backgroundMusic?: string;
  musicTracks?: MusicTrack[];
}

export interface ContentValidatorResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DirectionImage {
  imageFile: string;
  textInclude: string;
  scriptParagraphs: number[];
  transitionToNext: TransitionType;
  transitionDuration: number;
  kenBurnsStart: number;
  kenBurnsEnd: number;
  sentiment: Sentiment;
  contextNote: string;
  durationInFrames?: number;
}

export interface DirectionChapter {
  chapterIndex: number;
  images: DirectionImage[];
}

export interface VideoDirections {
  scenes: DirectionChapter[];
}
