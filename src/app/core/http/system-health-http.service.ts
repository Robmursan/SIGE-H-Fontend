import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ApiVersionResponseDto,
  HealthResponseDto,
  LivenessResponseDto,
} from '../contracts/openapi-dtos.contract';
import { OpenApiClientBaseService } from './openapi-client.base';

/**
 * Servicio HTTP tipado para las operaciones técnicas verificadas en
 * `contracts/sigeh-v1.json` (`x-sigeh-status: "local-tested"`):
 * - `GET /api/v1/health/live` (`getHealthLive`)
 * - `GET /api/v1/health/ready` (`getHealthReady`)
 * - `GET /api/v1/health` (`getHealth`)
 * - `GET /api/v1/meta/version` (`getApiContractVersion`)
 */
@Injectable({ providedIn: 'root' })
export class SystemHealthHttpService {
  private readonly openApiClient = inject(OpenApiClientBaseService);

  public getHealthLive(): Observable<LivenessResponseDto> {
    return this.openApiClient.getTyped<LivenessResponseDto>('/api/v1/health/live');
  }

  public getHealthReady(): Observable<HealthResponseDto> {
    return this.openApiClient.getTyped<HealthResponseDto>('/api/v1/health/ready');
  }

  public getHealth(): Observable<HealthResponseDto> {
    return this.openApiClient.getTyped<HealthResponseDto>('/api/v1/health');
  }

  public getApiContractVersion(): Observable<ApiVersionResponseDto> {
    return this.openApiClient.getTyped<ApiVersionResponseDto>('/api/v1/meta/version');
  }
}
