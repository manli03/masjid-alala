import { CompassReading, NativeCompassSensor } from './compass-sensor';

describe('NativeCompassSensor lifecycle', () => {
  let api: any;
  let sensors: NativeCompassSensor[];
  let callbacks: ((reading: CompassReading) => void)[];
  let operations: string[];
  let removed: jasmine.Spy;

  async function drain() {
    for (let i = 0; i < 30; i++) await Promise.resolve();
  }

  beforeEach(() => {
    sensors = [];
    callbacks = [];
    operations = [];
    removed = jasmine.createSpy().and.resolveTo();
    api = {
      addListener: async (_: string, callback: (reading: CompassReading) => void) => {
        callbacks.push(callback);
        return { remove: removed };
      },
      start: jasmine.createSpy().and.callFake(async () => { operations.push('start'); }),
      stop: jasmine.createSpy().and.callFake(async () => { operations.push('stop'); }),
    };
  });

  afterEach(async () => {
    sensors.forEach(sensor => sensor.stop());
    await drain();
  });

  function create() {
    const sensor = new NativeCompassSensor(api);
    sensors.push(sensor);
    return sensor;
  }

  it('publishes heading and accuracy together before notifying the reader', async () => {
    const sensor = create();
    const observed: (number | null)[][] = [];
    sensor.addEventListener('reading', () => observed.push([sensor.heading, sensor.accuracy, sensor.headingAccuracy]));
    sensor.start();
    await drain();
    callbacks[0]({ quaternion: [0, 0, 0, 1], heading: 90, accuracy: 1, headingAccuracy: 20 });
    callbacks[0]({ quaternion: [0, 0, 0, 1], heading: 100, accuracy: 3, headingAccuracy: 2 });
    expect(observed).toEqual([[90, 1, 20], [100, 3, 2]]);
  });

  it('cleans up the old sensor before starting another after resume', async () => {
    const old = create();
    const reading = jasmine.createSpy();
    old.addEventListener('reading', reading);
    old.start();
    await drain();
    old.stop();
    create().start();
    await drain();
    expect(operations).toEqual(['start', 'stop', 'start']);
    expect(removed).toHaveBeenCalledTimes(1);
    callbacks[0]({ quaternion: [0, 0, 0, 1], heading: 90, accuracy: 3, headingAccuracy: 2 });
    expect(reading).not.toHaveBeenCalled();
  });

  it('does not start a native sensor if destroyed while its listener is being attached', async () => {
    let finish!: (value: any) => void;
    api.addListener = () => new Promise(resolve => { finish = resolve; });
    const sensor = create();
    sensor.start();
    await drain();
    sensor.stop();
    finish({ remove: removed });
    await drain();
    expect(api.start).not.toHaveBeenCalled();
    expect(api.stop).toHaveBeenCalled();
    expect(removed).toHaveBeenCalledTimes(1);
  });
});
