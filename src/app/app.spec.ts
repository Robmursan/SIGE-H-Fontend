import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { SyntheticExecutiveDashboardAdapter } from './core/adapters/synthetic-executive-dashboard.adapter';
import { EXECUTIVE_DASHBOARD_GATEWAY } from './core/ports/executive-dashboard.gateway';

describe('App (SIGE-H F1 Root)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        {
          provide: EXECUTIVE_DASHBOARD_GATEWAY,
          useExisting: SyntheticExecutiveDashboardAdapter,
        },
      ],
    }).compileComponents();
  });

  it('should create the root application component', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
