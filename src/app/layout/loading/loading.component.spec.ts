import { fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { LoadingComponent } from './loading.component';

describe('Dynamic launch splash', () => {
  let component: LoadingComponent;
  beforeEach(() => {
    component = new LoadingComponent({ init: async () => 'data:image/png;base64,cached' } as any);
  });
  afterEach(() => component.ngOnDestroy());

  it('shows the cached dynamic image and dismisses a normal launch after its original display duration', fakeAsync(() => {
    const dismissed = spyOn(component.dismissed, 'emit');
    component.ngOnInit();
    flushMicrotasks();
    expect(component.dynamicSplash).toBe('data:image/png;base64,cached');
    component.loaded = true;
    component.ngOnChanges();
    tick(2999);
    expect(dismissed).not.toHaveBeenCalled();
    tick(1);
    expect(component.shouldHide).toBeTrue();
    expect(dismissed).toHaveBeenCalledTimes(1);
    component.ngOnChanges();
    expect(dismissed).toHaveBeenCalledTimes(1);
  }));

  it('dismisses immediately for a ready app-link destination', fakeAsync(() => {
    component.fastLaunch = true;
    component.loaded = true;
    const dismissed = spyOn(component.dismissed, 'emit');
    component.ngOnInit();
    expect(dismissed).toHaveBeenCalledTimes(1);
    expect(component.shouldHide).toBeTrue();
    flushMicrotasks();
  }));

  it('falls back to bundled images when a cached dynamic image cannot load', fakeAsync(() => {
    component.ngOnInit();
    flushMicrotasks();
    component.onImageError();
    expect(component.dynamicSplash).toBeNull();
    expect(component.shouldHide).toBeFalse();
  }));
});
