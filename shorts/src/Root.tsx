import React from "react";
import { Composition } from "remotion";
import { episodes } from "./episodes";
import { calculateShortMetadata, Short, type ShortProps } from "./Short";
import { FPS, HEIGHT, WIDTH } from "./lib/timing";

/** Eine Composition pro Episode; ID = Episode-ID (z.B. 2026-10-25-treu-zu-allen-zeiten). */
export const Root: React.FC = () => (
  <>
    {episodes.map((ep) => (
      <Composition
        key={ep.id}
        id={ep.id}
        component={Short}
        width={WIDTH}
        height={HEIGHT}
        fps={FPS}
        durationInFrames={FPS * 30}
        defaultProps={{ episode: ep } satisfies ShortProps}
        calculateMetadata={calculateShortMetadata}
      />
    ))}
  </>
);
