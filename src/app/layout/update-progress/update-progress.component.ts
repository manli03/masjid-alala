import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { IonicModule } from '@ionic/angular';
import { CheckUpdateService } from '../../core/startup/check-update.service';
import { UpdateDownload } from '../../core/startup/app-updater.plugin';

@Component({
  selector: 'app-update-progress',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './update-progress.component.html',
  styleUrls: ['./update-progress.component.scss'],
})
export class UpdateProgressComponent implements OnDestroy {
  collapsed = false;
  dismissedFailure = '';
  private subscription: Subscription;
  constructor(public updater: CheckUpdateService) {
    this.subscription = updater.download$.subscribe(download => {
      if (download.state !== 'failed') this.dismissedFailure = '';
    });
  }

  failureKey(download: UpdateDownload): string {
    return JSON.stringify([download.versionCode, download.message]);
  }

  dismissFailure(download: UpdateDownload): void {
    this.dismissedFailure = this.failureKey(download);
  }

  ngOnDestroy(): void { this.subscription.unsubscribe(); }

  progress(download: UpdateDownload): number {
    return download.total ? Math.max(0, Math.min(1, (download.bytes || 0) / download.total)) : 0;
  }

  title(state: UpdateDownload['state']): string {
    switch (state) {
      case 'downloading': return 'Memuat turun kemas kini';
      case 'paused': return 'Muat turun dijeda';
      case 'verifying': return 'Mengesahkan kemas kini';
      case 'installing': return 'Membuka pemasang Android';
      case 'ready': return 'Kemas kini sedia dipasang';
      case 'failed': return 'Kemas kini gagal';
      default: return 'Kemas kini aplikasi';
    }
  }
}
