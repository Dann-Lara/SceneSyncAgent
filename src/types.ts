export interface SubtitleLine {
  startFrame: number;
  endFrame: number;
  text: string;
}

export type TransitionType = "fade" | "radial" | "glitch" | "flash" | "zoom-blur" | "shatter" | "crossfade" | "slide-left" | "slide-right" | "slide-up" | "slide-down" | "whip" | "zoom-in" | "zoom-out" | "pixelate";

export type Sentiment = "calm" | "tension" | "drama" | "terror" | "resolution" | "mystery" | "rage" | "despair" | "triumph" | "dread";
export type Climate = "clear" | "rain" | "storm";

export interface ContentPalette {
  primaryColor: string;
  secondaryColor: string;
}

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
  videoType?: "narrativo" | "lista";
  trackSchedule?: Record<string, string>;
  musicVideoMaxChapter?: number;
  introAccessLines?: string[];
  introStamp?: string;
  outroStatusFormat?: string;
  outroEndLabel?: string;
  outroContinuation?: string;
  outroSubtitle?: string;
  outroNextLabel?: string;
  outroNextSubtext?: string;
  contentPalettes?: Record<string, ContentPalette>;
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
  protagonist?: string;
}

export interface SilenceRegion {
  startFrame: number;
  endFrame: number;
  durationInFrames: number;
}

export interface Scene {
  chapterIndex: number;
  title: string;
  audioPath: string;
  audioDurationSeconds: number;
  durationInFrames: number;
  images: ImageMeta[];
  subtitles?: { start: number; end: number; text: string }[];
  climate?: Climate;
  silences?: SilenceRegion[];
}

export interface MusicTrack {
  path: string;
  startFrame: number;
  durationInFrames: number;
  actualFrames: number;
  trackNumber?: number;
  chapterStart?: number;
  chapterEnd?: number;
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
  subtitles?: SubtitleLine[];
  authorName?: string;
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
  protagonist?: string;
}

export interface DirectionChapter {
  chapterIndex: number;
  images: DirectionImage[];
  climate?: Climate;
  silences?: SilenceRegion[];
}

export interface VideoDirections {
  scenes: DirectionChapter[];
}
