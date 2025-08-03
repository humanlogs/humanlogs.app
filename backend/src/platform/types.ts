export interface PlatformService {
  init(...args: any[]): Promise<this>;
}

export interface ImageBaseGenerators {
  inpainting(
    prompt: string,
    image: string,
    mask: string,
    loras: { url: string; weight: number }[],
    options: {
      nsfw?: boolean;
      size?: { width: number; height: number };
      strength?: number;
    }
  ): Promise<{
    images: {
      url: string;
    }[];
  }>;

  generateImage(
    prompt: string,
    loras: { url: string; weight: number }[],
    options: {
      nsfw?: boolean;
      size?: { width: number; height: number };
      controlnets?: ControlNetType[];
    }
  ): Promise<{
    images: {
      url: string;
    }[];
  }>;

  upscale(
    image: string,
    factor: 2 | 4
  ): Promise<{
    images: {
      url: string;
    }[];
  }>;
}

export type ControlNetType = {
  model: "blur" | "pose" | "depth" | "canny" | "low_quality";
  guideImage: string;
  weight?: number;
  startStepPercentage?: number;
  endStepPercentage?: number;
  controlMode?: "balanced";
};
