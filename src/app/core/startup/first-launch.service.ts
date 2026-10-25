import { Inject, Injectable, InjectionToken } from '@angular/core';
import { AlertController, ModalController } from '@ionic/angular';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { firstValueFrom, timeout } from 'rxjs';
import { PrayerTimesService } from '../../features/prayer/services/prayer-times.service';
import { PrayerNotificationsService } from '../../features/prayer/services/prayer-notifications.service';
import { PrayerZoneSelectorComponent } from '../../features/prayer/components/prayer-zone-selector/prayer-zone-selector.component';
import { NotificationSettingsComponent } from '../../features/prayer/components/notification-settings/notification-settings.component';

export const FIRST_LAUNCH_PREFERENCES = new InjectionToken<typeof Preferences>('FIRST_LAUNCH_PREFERENCES', {
  providedIn: 'root', factory: () => Preferences,
});

@Injectable({ providedIn: 'root' })
export class FirstLaunchService {
  private running?: Promise<void>;
  constructor(private modals: ModalController, private alerts: AlertController,
    private prayers: PrayerTimesService, private notifications: PrayerNotificationsService,
    @Inject(FIRST_LAUNCH_PREFERENCES) private preferences: typeof Preferences = Preferences) {}

  run(): Promise<void> {
    return this.running ??= this.configure().finally(() => { this.running = undefined; });
  }

  private async configure(): Promise<void> {
    if ((await this.preferences.get({ key: 'first-launch-zone-ready' })).value !== 'true') {
      let ready = false;
      while (!ready) {
        const picker = await this.modals.create({ component: PrayerZoneSelectorComponent,
          componentProps: { required: true }, backdropDismiss: false,
          canDismiss: (_data, role) => Promise.resolve(role === 'selected') });
        await picker.present();
        const { data } = await picker.onDidDismiss<{ zone: { code: string } }>();
        if (!data?.zone) continue;
        try {
          const result = await firstValueFrom(this.prayers.getPrayerTimes(data.zone.code, 'year').pipe(timeout(20000)));
          if (result.status !== 'OK!' || !result.prayerTime?.length ||
            !this.prayers.getTodayPrayerTimes(result.prayerTime, new Date())) throw new Error('No daily schedule');
          await this.prayers.saveYearlyPrayerTimes(data.zone.code, result.prayerTime, result.bearing, 'zone');
          await this.preferences.set({ key: 'first-launch-zone-ready', value: 'true' });
          window.dispatchEvent(new Event('prayerZoneConfigured'));
          ready = true;
        } catch {
          const error = await this.alerts.create({ header: 'Waktu Solat Belum Dimuatkan',
            message: 'Semak sambungan Internet dan pilih zon semula untuk meneruskan.', buttons: ['Cuba Lagi'], backdropDismiss: false });
          await error.present();
          await error.onDidDismiss();
        }
      }
    }
    if (!Capacitor.isNativePlatform() ||
      (await this.preferences.get({ key: 'first-launch-notifications-offered' })).value === 'true') return;
    const granted = await this.notifications.initializeNotifications();
    await this.preferences.set({ key: 'first-launch-notifications-offered', value: 'true' });
    if (!granted) return;
    await this.notifications.checkPermissionAndSchedule(true);
    const guidance = await this.alerts.create({ header: 'Tetapkan Peringatan Solat',
      message: 'Peringatan semua waktu diaktifkan secara lalai. Pilih waktu, bunyi azan dan masa peringatan dalam tetapan berikut.', buttons: ['Buka Tetapan'], backdropDismiss: false });
    await guidance.present();
    await guidance.onDidDismiss();
    const settings = await this.modals.create({ component: NotificationSettingsComponent, cssClass: 'notification-settings-modal' });
    await settings.present();
    await settings.onDidDismiss();
  }
}
