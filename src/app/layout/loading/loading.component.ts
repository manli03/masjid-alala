import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output } from '@angular/core';
import { SplashService } from '../../core/startup/splash.service';

@Component({
  selector: 'app-loading',
  template: `
    <div *ngIf="!shouldHide" class="loading-container" role="status" aria-label="Memulakan aplikasi">
      <ng-container *ngIf="dynamicSplash; else defaultPicture">
        <img
          [src]="dynamicSplash"
          alt="Loading"
          class="loading-image"
          (error)="onImageError()"
        />
      </ng-container>

      <ng-template #defaultPicture>
        <picture *ngIf="!isLandscape">
          <!-- Portrait Mode -->
          <!-- Modern tall screens - check aspect ratio and density -->
          <source
            media="(min-aspect-ratio: 9/19) and (max-aspect-ratio: 9/21) and (min-resolution: 3dppx), (-webkit-min-device-pixel-ratio: 3)"
            srcset="assets/loading/xxxhdpi_tall_portrait.png"
          />
          <source
            media="(min-aspect-ratio: 9/19) and (max-aspect-ratio: 9/21) and (min-resolution: 2dppx), (-webkit-min-device-pixel-ratio: 2)"
            srcset="assets/loading/xxhdpi_tall_portrait.png"
          />
          <!-- Standard density-based images -->
          <source
            media="(min-resolution: 4dppx), (-webkit-min-device-pixel-ratio: 4)"
            srcset="assets/loading/xxxhdpi_portrait.png"
          />
          <source
            media="(min-resolution: 3dppx), (-webkit-min-device-pixel-ratio: 3)"
            srcset="assets/loading/xxhdpi_portrait.png"
          />
          <source
            media="(min-resolution: 2dppx), (-webkit-min-device-pixel-ratio: 2)"
            srcset="assets/loading/xhdpi_portrait.png"
          />
          <source
            media="(min-resolution: 1.5dppx), (-webkit-min-device-pixel-ratio: 1.5)"
            srcset="assets/loading/hdpi_portrait.png"
          />
          <source
            media="(min-resolution: 1dppx), (-webkit-min-device-pixel-ratio: 1)"
            srcset="assets/loading/mdpi_portrait.png"
          />
          <!-- Default fallback -->
          <img
            src="assets/loading/xxhdpi_portrait.png"
            alt="Loading"
            class="loading-image"
          />
        </picture>

        <picture *ngIf="isLandscape">
          <!-- Landscape Mode -->
          <!-- Taller landscape screens (modern ultra-wide devices) -->
          <source
            media="(min-aspect-ratio: 21/9) and (min-resolution: 3dppx), (-webkit-min-device-pixel-ratio: 3)"
            srcset="assets/loading/xxxhdpi_tall_landscape.png"
          />
          <source
            media="(min-aspect-ratio: 21/9) and (min-resolution: 2dppx), (-webkit-min-device-pixel-ratio: 2)"
            srcset="assets/loading/xxhdpi_tall_landscape.png"
          />
          <!-- Standard density-based landscape images -->
          <source
            media="(min-resolution: 4dppx), (-webkit-min-device-pixel-ratio: 4)"
            srcset="assets/loading/xxxhdpi_landscape.png"
          />
          <source
            media="(min-resolution: 3dppx), (-webkit-min-device-pixel-ratio: 3)"
            srcset="assets/loading/xxhdpi_landscape.png"
          />
          <source
            media="(min-resolution: 2dppx), (-webkit-min-device-pixel-ratio: 2)"
            srcset="assets/loading/xhdpi_landscape.png"
          />
          <source
            media="(min-resolution: 1.5dppx), (-webkit-min-device-pixel-ratio: 1.5)"
            srcset="assets/loading/hdpi_landscape.png"
          />
          <source
            media="(min-resolution: 1dppx), (-webkit-min-device-pixel-ratio: 1)"
            srcset="assets/loading/mdpi_landscape.png"
          />
          <!-- Default fallback -->
          <img
            src="assets/loading/xxhdpi_landscape.png"
            alt="Loading"
            class="loading-image"
          />
        </picture>
      </ng-template>
    </div>
  `,
  styles: [`
    .loading-container { position: fixed; inset: 0; z-index: 10001; background: #004d39; }
    picture { display: block; width: 100%; height: 100%; }
    .loading-image { width: 100%; height: 100%; object-fit: cover; }
  `],
})
export class LoadingComponent implements OnInit, OnChanges, OnDestroy {
  @Input() loaded = false;
  @Input() isHomePage = false;
  @Input() fastLaunch = false;
  @Output() dismissed = new EventEmitter<void>();
  static isLoaded = false;
  shouldHide = false;
  dynamicSplash: string | null = null;
  isLandscape = window.innerWidth > window.innerHeight;
  private startedAt?: number;
  private hideTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;
  private readonly onResize = () => { this.isLandscape = window.innerWidth > window.innerHeight; };

  constructor(private splashService: SplashService) {}

  ngOnInit(): void {
    this.startedAt = Date.now();
    LoadingComponent.isLoaded = false;
    window.addEventListener('resize', this.onResize);
    // Use the cached remote image immediately. Its refresh runs in the background.
    void this.splashService.init().then(image => {
      if (!this.destroyed && !this.shouldHide) this.dynamicSplash = image;
    }).catch(error => console.warn('Cached splash unavailable:', error));
    this.updateDismissal();
  }

  ngOnChanges(): void { this.updateDismissal(); }

  private updateDismissal(): void {
    if (this.startedAt === undefined || !this.loaded || this.shouldHide || this.destroyed) return;
    clearTimeout(this.hideTimer);
    // Retain the original dynamic splash display on a normal home launch.
    // App links and direct page launches do not wait for the display duration.
    const minimum = this.fastLaunch ? 0 : 3000;
    const remaining = Math.max(0, minimum - (Date.now() - this.startedAt));
    if (remaining) this.hideTimer = setTimeout(() => this.hide(), remaining);
    else this.hide();
  }

  private hide(): void {
    if (this.destroyed || this.shouldHide || !this.loaded) return;
    this.shouldHide = true;
    LoadingComponent.isLoaded = true;
    this.dismissed.emit();
  }

  onImageError(): void { this.dynamicSplash = null; }

  ngOnDestroy(): void {
    this.destroyed = true;
    clearTimeout(this.hideTimer);
    window.removeEventListener('resize', this.onResize);
  }
}
