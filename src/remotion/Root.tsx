import { Composition, registerRoot } from "remotion";
import { Main } from "./Main";

const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Main"
      component={Main as React.FC<Record<string, unknown>>}
      durationInFrames={30 * 60 * 30}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};

registerRoot(RemotionRoot);
