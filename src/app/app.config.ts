import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideSigehConfigurableGateways } from './core/config/gateway-selector.service';
import { authRefreshInterceptor } from './core/http/auth-refresh.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authRefreshInterceptor])),
    ...provideSigehConfigurableGateways(),
  ],
};
