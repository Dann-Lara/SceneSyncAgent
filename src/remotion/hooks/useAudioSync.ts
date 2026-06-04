export interface WordTiming {
  word: string;
  startFrame: number;
  endFrame: number;
}

interface AudioSyncResult {
  currentWord: WordTiming | null;
  currentIndex: number;
  wordProgress: number;
  revealedCount: number;
  totalWords: number;
}

export function useAudioSync(
  frame: number,
  wordTimings: WordTiming[]
): AudioSyncResult {
  if (wordTimings.length === 0) {
    return { currentWord: null, currentIndex: -1, wordProgress: 0, revealedCount: 0, totalWords: 0 };
  }

  let currentIndex = -1;
  for (let i = 0; i < wordTimings.length; i++) {
    if (frame >= wordTimings[i].startFrame && frame < wordTimings[i].endFrame) {
      currentIndex = i;
      break;
    }
    if (frame < wordTimings[i].startFrame) break;
  }

  // If past the last word, keep last index
  if (currentIndex === -1 && frame >= wordTimings[wordTimings.length - 1].endFrame) {
    currentIndex = wordTimings.length - 1;
  }

  const currentWord = currentIndex >= 0 ? wordTimings[currentIndex] : null;
  const wordProgress = currentWord
    ? (frame - currentWord.startFrame) / (currentWord.endFrame - currentWord.startFrame)
    : 0;

  // Count fully revealed words (past their endFrame)
  let revealedCount = 0;
  for (const w of wordTimings) {
    if (frame >= w.endFrame) revealedCount++;
    else break;
  }

  return {
    currentWord,
    currentIndex,
    wordProgress: Math.max(0, Math.min(1, wordProgress)),
    revealedCount,
    totalWords: wordTimings.length,
  };
}

export function generateWordTimings(
  text: string,
  startFrame: number,
  totalFrames: number
): WordTiming[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const framesPerWord = totalFrames / words.length;
  return words.map((word, i) => ({
    word,
    startFrame: startFrame + Math.round(i * framesPerWord),
    endFrame: startFrame + Math.round((i + 1) * framesPerWord),
  }));
}
