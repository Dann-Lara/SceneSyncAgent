import { Composition, registerRoot } from "remotion";
import { MusicVideo } from "./MusicVideo";

const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MusicVideo"
      component={MusicVideo as React.FC<Record<string, unknown>>}
      durationInFrames={30 * 60 * 30}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};

registerRoot(RemotionRoot);
