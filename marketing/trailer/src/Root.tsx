import { Composition } from "remotion";
import timeline from "./timeline.json";
import { Trailer, type TrailerProps } from "./Trailer";

const defaultProps: TrailerProps = { music: true };

export const Root: React.FC = () => (
  <Composition
    id="Trailer"
    component={Trailer}
    durationInFrames={timeline.durationInFrames}
    fps={timeline.fps}
    width={timeline.width}
    height={timeline.height}
    defaultProps={defaultProps}
  />
);
