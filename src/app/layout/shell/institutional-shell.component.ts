import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SIGEH_RUNTIME_CONFIG } from '../../core/config/environment.config';

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
  protected readonly mobileMenuOpen = signal(false);
  protected readonly sidebarCollapsed = signal(false);

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
}
