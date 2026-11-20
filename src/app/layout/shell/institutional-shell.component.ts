import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SIGEH_RUNTIME_CONFIG } from '../../core/config/environment.config';
import { GatewaySelectorService } from '../../core/config/gateway-selector.service';
import { AuthSessionService } from '../../core/security/auth-session.service';

export interface NavMenuItem {
  readonly id: string;
  readonly label: string;
  readonly subtitle: string;
  readonly route: string;
  readonly queryParams?: Readonly<Record<string, string>>;
  readonly badge?: string;
}

@Component({
  selector: 'app-institutional-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './institutional-shell.component.html',
  styleUrl: './institutional-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstitutionalShellComponent {
  protected readonly runtimeConfig = inject(SIGEH_RUNTIME_CONFIG);
  protected readonly authSession = inject(AuthSessionService);
  protected readonly gatewaySelector = inject(GatewaySelectorService);
  private readonly router = inject(Router);
  protected readonly mobileMenuOpen = signal(false);
  protected readonly sidebarCollapsed = signal(false);

  protected readonly isRealApiSessionActive = computed<boolean>(
    () =>
      this.authSession.isAuthenticated() ||
      this.gatewaySelector.effectiveGlobalMode() === 'OPENAPI_HTTP_READY',
  );

  protected readonly navItems: readonly NavMenuItem[] = [
    {
      id: 'nav-dashboard',
      label: 'Tablero Ejecutivo',
      subtitle: 'Resumen de Jefatura y Turno',
      route: '/dashboard',
    },
    {
      id: 'nav-organizacion',
      label: 'Organización Hospitalaria',
      subtitle: 'Hospitales, Divisiones y Servicios',
      route: '/organizacion',
      badge: 'F2',
    },
    {
      id: 'nav-personal',
      label: 'Gestión de Personal',
      subtitle: 'Padrón Nominal y Adscripción',
      route: '/personal',
      badge: 'F2',
    },
    {
      id: 'nav-programacion',
      label: 'Programación Laboral',
      subtitle: 'Calendario Semanal y Turnos',
      route: '/programacion',
      badge: 'F2',
    },
    {
      id: 'nav-pases-lista',
      label: 'Pases de Lista',
      subtitle: 'Asistencia Operativa (Lectura)',
      route: '/pases-lista',
      badge: 'F4-F',
    },
    {
      id: 'nav-iam-login',
      label: 'Sesión IAM V2',
      subtitle: 'Acceso y Contexto Autorizado',
      route: '/login',
      badge: 'F4-B',
    },
    {
      id: 'nav-forbidden',
      label: 'Control de Acceso (403)',
      subtitle: 'Simulación Restricción Rol',
      route: '/acceso-restringido',
    },
  ];

  public toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  public closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  public toggleSidebarCollapse(): void {
    this.sidebarCollapsed.update((collapsed) => !collapsed);
  }

  public logoutFromHeader(): void {
    this.authSession.logout().subscribe({
      next: () => {
        if (this.authSession.isIamEnabled()) {
          void this.router.navigate(['/login']);
        }
      },
    });
  }
}
