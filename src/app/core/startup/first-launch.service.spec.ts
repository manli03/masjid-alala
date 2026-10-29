import { Capacitor } from '@capacitor/core';
import { of, throwError } from 'rxjs';
import { FirstLaunchService } from './first-launch.service';
import { PrayerZoneSelectorComponent } from '../../features/prayer/components/prayer-zone-selector/prayer-zone-selector.component';
import { NotificationSettingsComponent } from '../../features/prayer/components/notification-settings/notification-settings.component';

describe('First launch onboarding', () => {
  let service: FirstLaunchService;
  let values: Map<string, string>;
  let modals: any;
  let prayers: any;
  let notifications: any;
  let alerts: any;
  beforeEach(() => {
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
    values = new Map();
    const dismissed = { present: async () => undefined, onDidDismiss: async () => ({ data: { zone: { code: 'sgr01' } } }) };
    modals = { create: jasmine.createSpy().and.resolveTo(dismissed) };
    alerts = { create: jasmine.createSpy().and.resolveTo(dismissed) };
    prayers = {
      getPrayerTimes: jasmine.createSpy().and.returnValue(of({ status: 'OK!', prayerTime: [{}] })),
      getTodayPrayerTimes: () => ({}), saveYearlyPrayerTimes: jasmine.createSpy().and.resolveTo(),
    };
    notifications = {
      initializeNotifications: jasmine.createSpy().and.callFake(async () => {
        expect(values.get('first-launch-zone-ready')).toBe('true');
        return false;
      }),
      checkPermissionAndSchedule: jasmine.createSpy().and.resolveTo(),
    };
    service = new FirstLaunchService(modals, alerts, prayers, notifications, {
      get: async ({ key }: { key: string }) => ({ value: values.get(key) ?? null }),
      set: async ({ key, value }: { key: string; value: string }) => { values.set(key, value); },
    } as any);
  });

  it('requires and saves the chosen zone before asking for notifications', async () => {
    await service.run();
    const picker = modals.create.calls.first().args[0];
    expect(picker.component).toBe(PrayerZoneSelectorComponent);
    expect(picker.componentProps.required).toBeTrue();
    expect(picker.backdropDismiss).toBeFalse();
    expect(await picker.canDismiss(undefined, 'backdrop')).toBeFalse();
    expect(await picker.canDismiss(undefined, 'selected')).toBeTrue();
    expect(prayers.saveYearlyPrayerTimes).toHaveBeenCalledWith('sgr01', [{}], undefined, 'zone');
    expect(notifications.initializeNotifications).toHaveBeenCalledWith();
  });

  it('retries notifications on the next open even if the old offered flag was saved', async () => {
    values.set('first-launch-zone-ready', 'true');
    values.set('first-launch-notifications-offered', 'true');
    await service.run();
    await service.run();
    expect(notifications.initializeNotifications).toHaveBeenCalledTimes(2);
    expect(modals.create).not.toHaveBeenCalled();
  });

  it('guides accepted users into prayer settings once', async () => {
    values.set('first-launch-zone-ready', 'true');
    notifications.initializeNotifications.and.resolveTo(true);
    await service.run();
    await service.run();
    expect(modals.create).toHaveBeenCalledTimes(1);
    expect(modals.create.calls.first().args[0].component).toBe(NotificationSettingsComponent);
    expect(values.get('first-launch-notifications-configured')).toBe('true');
    expect(notifications.checkPermissionAndSchedule.calls.first().args).toEqual([true]);
    expect(notifications.checkPermissionAndSchedule.calls.mostRecent().args).toEqual([false]);
  });

  it('keeps onboarding incomplete after a failed zone fetch and retries selection', async () => {
    prayers.getPrayerTimes.and.returnValues(throwError(() => new Error('Offline')), of({ status: 'OK!', prayerTime: [{}] }));
    await service.run();
    expect(alerts.create).toHaveBeenCalledTimes(1);
    expect(prayers.getPrayerTimes).toHaveBeenCalledTimes(2);
    expect(prayers.saveYearlyPrayerTimes).toHaveBeenCalledTimes(1);
  });

  it('shares an in-flight onboarding run to avoid stacked prompts', async () => {
    const first = service.run();
    expect(service.run()).toBe(first);
    await first;
    expect(modals.create).toHaveBeenCalledTimes(1);
  });
});
