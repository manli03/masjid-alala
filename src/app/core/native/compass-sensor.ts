import { PluginListenerHandle, registerPlugin } from '@capacitor/core';

export interface CompassReading {
  quaternion: number[];
  heading: number | null;
  accuracy: number;
  headingAccuracy: number | null;
}

export interface CompassPlugin {
  start(): Promise<void>;
  stop(): Promise<void>;
  addListener(event: 'reading', listener: (reading: CompassReading) => void): Promise<PluginListenerHandle>;
  getDeclination(location: { latitude: number; longitude: number }): Promise<{ degrees: number }>;
}

export const NativeCompass = registerPlugin<CompassPlugin>('Compass');

// Serialize start/stop across instances so cleanup from a previous compass
// cannot stop the new one when the app resumes quickly.
let lifecycle = Promise.resolve();
function enqueue(operation: () => Promise<void>): Promise<void> {
  const result = lifecycle.then(operation);
  lifecycle = result.catch(() => undefined);
  return result;
}

/** Native sensor with a small OrientationSensor-compatible event interface. */
export class NativeCompassSensor {
  quaternion: number[] | null = null;
  heading: number | null = null;
  accuracy: number | null = null;
  headingAccuracy: number | null = null;
  private running = false;
  private listener?: PluginListenerHandle;
  private handlers = new Map<string, Set<(event?: any) => void>>();

  constructor(private api: CompassPlugin = NativeCompass) {}

  addEventListener(name: string, handler: (event?: any) => void): void {
    if (!this.handlers.has(name)) this.handlers.set(name, new Set());
    this.handlers.get(name)!.add(handler);
  }

  removeEventListener(name: string, handler: (event?: any) => void): void {
    this.handlers.get(name)?.delete(handler);
  }

  start(): void {
    this.running = true;
    void enqueue(async () => {
      if (!this.running) return;
      this.listener = await this.api.addListener('reading', reading => {
        if (!this.running) return;
        Object.assign(this, reading);
        this.handlers.get('reading')?.forEach(handler => handler());
      });
      if (this.running) await this.api.start();
    }).catch(() => {
      if (this.running) this.handlers.get('error')?.forEach(handler => handler({ error: { name: 'NotReadableError' } }));
    });
  }

  stop(): void {
    this.running = false;
    void enqueue(async () => {
      await this.api.stop();
      await this.listener?.remove();
      this.listener = undefined;
    }).catch(() => undefined);
  }
}
