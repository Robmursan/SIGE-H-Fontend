import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { GatewaySelectorService } from '../../core/config/gateway-selector.service';
import { AuthSessionService } from '../../core/security/auth-session.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-auth-login',
  imports: [FormsModule, RouterLink, StatusBadgeComponent],
  templateUrl: './auth-login.component.html',
  styleUrl: './auth-login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLoginComponent {
  protected readonly authSession = inject(AuthSessionService);
  protected readonly gatewaySelector = inject(GatewaySelectorService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly identificador = signal<string>('');
  protected readonly password = signal<string>('');
  protected readonly localValidationMessage = signal<string | null>(null);
  protected readonly statusFeedback = signal<string | null>(null);

  protected readonly isQaIntegrationModeActive = computed<boolean>(
    () =>
      this.authSession.isIamEnabled() &&
      this.gatewaySelector.effectiveGlobalMode() === 'OPENAPI_HTTP_READY',
  );

  protected readonly canSubmit = computed<boolean>(
    () =>
      !this.authSession.isBusy() &&
      this.identificador().trim().length > 0 &&
      this.password().length > 0,
  );

  /**
   * Activación explícita y volátil (solo en memoria RAM) del modo integración QA:
   * habilita protección IAM (`iamEnabled = true`) y conmuta los módulos a
   * `OPENAPI_HTTP_READY`. Recargar el navegador regresa automáticamente a
   * `SYNTHETIC_DEMO` con `iamEnabled = false`.
   */
  public activateQaIntegrationSession(): void {
    this.authSession.setIamEnabledOverride(true);
    this.gatewaySelector.setGlobalMode('OPENAPI_HTTP_READY');
    this.localValidationMessage.set(null);
    this.statusFeedback.set(
      'Modo Integración QA activado solo en memoria RAM (IAM Guard + OpenAPI v1). Inicie sesión para consultar endpoints reales.',
    );
  }

  /**
   * Restaura inmediatamente el modo seguro predeterminado (`SYNTHETIC_DEMO`,
   * `iamEnabled = false`) y limpia cualquier sesión/token en memoria RAM.
   */
  public restoreSafeSyntheticDemoMode(): void {
    this.password.set('');
    this.authSession.clearAllLocalSessionState('anonymous');
    this.authSession.setIamEnabledOverride(false);
    this.gatewaySelector.resetToDefaultSafeDemoMode();
    this.localValidationMessage.set(null);
    this.statusFeedback.set(
      'Modo seguro SYNTHETIC_DEMO restaurado (iamEnabled = false, memoria RAM purgada).',
    );
  }

  public onIdentificadorChange(value: string): void {
    this.identificador.set(value);
    this.localValidationMessage.set(null);
  }

  public onPasswordChange(value: string): void {
    this.password.set(value);
    this.localValidationMessage.set(null);
  }

  public submitLogin(): void {
    const id = this.identificador().trim();
    const pwd = this.password();

    if (!id || !pwd) {
      this.localValidationMessage.set(
        'Ingrese identificador y contraseña para iniciar sesión IAM V2.',
      );
      return;
    }

    if (id.length > 100 || pwd.length > 1024) {
      this.localValidationMessage.set(
        'Los campos exceden la longitud permitida por el contrato OpenAPI (identificador <= 100, password <= 1024).',
      );
      return;
    }

    // Limpiar la contraseña en memoria de formulario inmediatamente al despachar.
    this.password.set('');
    this.localValidationMessage.set(null);
    this.statusFeedback.set(null);

    this.authSession.login({ identificador: id, password: pwd }).subscribe({
      next: () => {
        this.statusFeedback.set(
          'Sesión IAM V2 iniciada en memoria RAM y perfil cargado desde /api/v1/auth/me.',
        );
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        if (returnUrl && returnUrl.startsWith('/') && returnUrl !== '/login') {
          void this.router.navigateByUrl(returnUrl);
        }
      },
      error: () => {
        // El error normalizado (400/401/429/503) se expone en authSession.lastError().
      },
    });
  }

  public onHospitalSelectionChange(hospitalId: string): void {
    const ok = this.authSession.selectHospital(hospitalId);
    if (!ok) {
      this.localValidationMessage.set(
        'Hospital no autorizado en las asignaciones de /api/v1/auth/me.',
      );
    } else {
      this.localValidationMessage.set(null);
    }
  }

  public onServiceSelectionChange(servicioId: string): void {
    const ok = this.authSession.selectService(servicioId);
    if (!ok) {
      this.localValidationMessage.set(
        'Servicio no autorizado en las asignaciones de /api/v1/auth/me para el hospital activo.',
      );
    } else {
      this.localValidationMessage.set(null);
    }
  }

  public loadActiveSessions(): void {
    this.statusFeedback.set(null);
    this.authSession.loadSessions().subscribe({
      next: (list) => {
        this.statusFeedback.set(`Se consultaron ${list.length} sesiones desde /api/v1/auth/sessions.`);
      },
      error: () => {
        // Error expuesto en authSession.lastError().
      },
    });
  }

  public revokeSession(sessionId: string): void {
    this.statusFeedback.set(null);
    this.authSession.revokeSession(sessionId).subscribe({
      next: () => {
        this.statusFeedback.set(`Sesión ${sessionId} revocada correctamente.`);
      },
      error: () => {
        // Error expuesto en authSession.lastError().
      },
    });
  }

  public logoutSession(): void {
    this.password.set('');
    this.localValidationMessage.set(null);
    this.authSession.logout().subscribe({
      next: () => {
        this.statusFeedback.set(
          'Sesión cerrada y memoria RAM purgada (tokens, perfil, contextos y solicitudes pendientes).',
        );
      },
    });
  }
}
