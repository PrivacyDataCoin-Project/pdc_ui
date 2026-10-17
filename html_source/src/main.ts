import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';
import 'lodash';
import { setupFocusVisibleFallback } from '@parts/utils/focus-visible-fallback';

export const buildTime = '2026-10-17T21:10:03.884Z';

if (environment.production) {
    enableProdMode();
}

setupFocusVisibleFallback();

platformBrowserDynamic()
    .bootstrapModule(AppModule)
    .catch((err) => console.error(err));
