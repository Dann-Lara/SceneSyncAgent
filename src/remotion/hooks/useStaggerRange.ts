interface StaggerOptions {
  startFrame: number;
  staggerPerChild: number;
  total: number;
  initialDelay?: number;
}

export function useStaggerIndex(
  frame: number,
  options: StaggerOptions
): { activeIndex: number; childProgress: number; isActive: boolean } {
  const {
    startFrame,
    staggerPerChild,
    total,
    initialDelay = 0,
  } = options;

  const localFrame = Math.max(0, frame - startFrame - initialDelay);

  if (localFrame < 0) {
    return { activeIndex: -1, childProgress: 0, isActive: false };
  }

  const rawIndex = localFrame / staggerPerChild;
  const activeIndex = Math.min(Math.floor(rawIndex), total - 1);
  const childProgress = rawIndex - Math.floor(rawIndex);

  return {
    activeIndex,
    childProgress,
    isActive: activeIndex >= 0 && activeIndex < total,
  };
}
