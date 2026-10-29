import { NgZone } from '@angular/core';
import { fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { NavigationEnd } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Subject } from 'rxjs';
import { AppComponent } from './app.component';

describe('App startup', () => {
  let app: AppComponent;
  let events: Subject<NavigationEnd>;
  let router: any;
  let updater: any;
  let firstLaunch: any;
  beforeEach(() => {
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
    spyOn(window, 'requestAnimationFrame').and.callFake(callback => { callback(0); return 1; });
    events = new Subject();
    router = { events, navigated: false, navigateByUrl: jasmine.createSpy().and.resolveTo(true) };
    updater = { initialize: jasmine.createSpy().and.resolveTo() };
    firstLaunch = { run: jasmine.createSpy().and.resolveTo() };
    app = new AppComponent(router, { ready: async () => undefined } as any,
      updater, {} as any, { loadDarkModePreference: async () => undefined, destroy: () => undefined } as any,
      new NgZone({}), firstLaunch);
  });
  afterEach(() => app.ngOnDestroy());

  it('keeps routed content blocked until onboarding finishes on web too', async () => {
    let complete!: () => void;
    firstLaunch.run.and.returnValue(new Promise<void>(resolve => { complete = resolve; }));
    const dismissed = app.onSplashDismissed();
    expect(firstLaunch.run).toHaveBeenCalledTimes(1);
    expect(app.onboardingComplete).toBeFalse();
    complete();
    await dismissed;
    expect(app.onboardingComplete).toBeTrue();
  });

  it('retries onboarding after reopening the app', async () => {
    await app.onSplashDismissed();
    firstLaunch.run.calls.reset();
    await app['onAppStateChange'](false);
    await app['onAppStateChange'](true);
    expect(firstLaunch.run).toHaveBeenCalledTimes(1);
  });

  it('does not retry because a permission dialog paused the current onboarding', async () => {
    await app.onSplashDismissed();
    firstLaunch.run.calls.reset();
    firstLaunch.isRunning = true;
    await app['onAppStateChange'](false);
    firstLaunch.isRunning = false;
    await app['onAppStateChange'](true);
    expect(firstLaunch.run).not.toHaveBeenCalled();
  });

  it('checks updates only after the dynamic splash dismisses and native hiding finishes', fakeAsync(() => {
    let finishHiding!: () => void;
    const hidden = new Promise<void>(resolve => { finishHiding = resolve; });
    (Capacitor.isNativePlatform as jasmine.Spy).and.returnValue(true);
    spyOn<any>(app, 'hideNativeSplash').and.returnValue(hidden);
    void app.onSplashDismissed();
    expect(updater.initialize).not.toHaveBeenCalled();
    finishHiding();
    flushMicrotasks();
    expect(updater.initialize).toHaveBeenCalledTimes(1);
    void app.onSplashDismissed();
    flushMicrotasks();
    expect(updater.initialize).toHaveBeenCalledTimes(1);
  }));

  it('reveals the first rendered route without waiting for remote data or a minimum duration', fakeAsync(() => {
    app.ngOnInit();
    flushMicrotasks();
    expect(app.isAppLoaded).toBeFalse();
    events.next(new NavigationEnd(1, '/tabs/prayer', '/tabs/prayer'));
    expect(app.isAppLoaded).toBeTrue();
    events.next(new NavigationEnd(2, '/tabs/home', '/tabs/home'));
    expect(app.isAppLoaded).toBeTrue();
    expect(app.isHomePage).toBeTrue();
  }));

  it('releases the splash when startup dependencies stall', fakeAsync(() => {
    app.ngOnInit();
    tick(4000);
    expect(app.isAppLoaded).toBeTrue();
    flushMicrotasks();
  }));

  it('routes prayer app links directly and preserves tab query parameters', async () => {
    await app['navigateToDeepLink']('https://masjidala.web.app/prayertimes/');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/tabs/prayer');
    await app['navigateToDeepLink']('/tabs/hadithSupplication?detail=true');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/tabs/hadithSupplication?detail=true');
    await app['navigateToDeepLink']('https://masjidala.web.app/announcement/42');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/tabs/home');
  });
});
