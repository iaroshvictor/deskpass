declare module 'rtsp-ffmpeg' {
  interface FFMpegOptions {
    input: string;
    rate?: number | string;
    resolution?: string;
    quality?: number;
    arguments?: string[];
  }

  class FFMpeg {
    constructor(options: FFMpegOptions);
    on(event: 'data', listener: (data: Buffer) => void): this;
    on(event: 'error', listener: (error: any) => void): this;
    removeListener(event: string, listener: (...args: any[]) => void): this;
    removeAllListeners(event?: string): this;
    stop(): void;
  }

  class RtspFfmpeg {
    static FFMpeg: typeof FFMpeg;
  }
  export = RtspFfmpeg;
}