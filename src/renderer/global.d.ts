type WindowMode = "windowed" | "borderless" | "fullscreen";

type GravityAppInfo = {
  version: string;
  windowMode: WindowMode;
  captureDirectory: string;
  maxCaptureDimension: number;
  maxCapturePixels: number;
};

type GravityApi = {
  getAppInfo: () => Promise<GravityAppInfo>;
  setWindowMode: (mode: WindowMode) => void;
  quit: () => void;
  openCaptureFolder: () => Promise<string>;
  beginCapture: (spec: Record<string, unknown>) => Promise<{ jobId: string; captureDirectory: string }>;
  writeCaptureTile: (payload: Record<string, unknown>) => Promise<{ written: number; expected: number }>;
  finishCapture: (payload: Record<string, unknown>) => Promise<{ finalPath: string; recipePath?: string; captureDirectory: string }>;
  cancelCapture: (jobId: string) => Promise<boolean>;
  saveUniverse: (record: Record<string, unknown>) => Promise<{ path: string }>;
  loadUniverse: () => Promise<{ path: string; record: Record<string, unknown> | null }>;
  chooseRecipe: () => Promise<{ path: string; recipe: Record<string, unknown> } | null>;
  reportReady: (details: Record<string, unknown>) => void;
  reportFailure: (message: string) => void;
};

interface Window {
  gravityAPI: GravityApi;
  __gravityTest: {
    run: (capture: boolean | "large" | "huge" | "empty" | "calligraphy" | "zoom") => Promise<Record<string, unknown>>;
  };
}
