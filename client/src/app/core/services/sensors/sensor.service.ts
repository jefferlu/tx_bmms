import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
    Sensor,
    SensorData,
    SensorBimBinding,
    SensorDataLog,
    SensorQueryParams,
    BindingQueryParams,
    BatchCreateBindingsRequest,
    BatchCreateBindingsResponse,
    BatchDeleteBindingsRequest,
    BatchDeleteBindingsResponse,
    RealtimeDataResult
} from './sensor.types';

@Injectable({
    providedIn: 'root'
})
export class SensorService {
    private apiUrl = `${environment.apiUrl}/sensors`;

    // 快取感測器列表
    private _sensors$ = new BehaviorSubject<Sensor[]>([]);
    public sensors$ = this._sensors$.asObservable();

    // 快取即時數據
    private _realtimeData$ = new BehaviorSubject<RealtimeDataResult>({});
    public realtimeData$ = this._realtimeData$.asObservable();

    constructor(private http: HttpClient) {}

    // ========== Sensor CRUD ==========

    /**
     * 取得所有感測器
     */
    getSensors(params?: SensorQueryParams): Observable<Sensor[]> {
        let httpParams = new HttpParams();

        if (params) {
            Object.keys(params).forEach(key => {
                const value = params[key as keyof SensorQueryParams];
                if (value !== null && value !== undefined) {
                    httpParams = httpParams.set(key, value.toString());
                }
            });
        }

        return this.http.get<Sensor[]>(`${this.apiUrl}/sensors/`, { params: httpParams }).pipe(
            tap(sensors => this._sensors$.next(sensors))
        );
    }

    /**
     * 取得特定感測器
     */
    getSensor(id: number): Observable<Sensor> {
        return this.http.get<Sensor>(`${this.apiUrl}/sensors/${id}/`);
    }

    /**
     * 建立感測器
     */
    createSensor(sensor: Partial<Sensor>): Observable<Sensor> {
        return this.http.post<Sensor>(`${this.apiUrl}/sensors/`, sensor).pipe(
            tap(() => this.refreshSensors())
        );
    }

    /**
     * 更新感測器
     */
    updateSensor(id: number, sensor: Partial<Sensor>): Observable<Sensor> {
        return this.http.patch<Sensor>(`${this.apiUrl}/sensors/${id}/`, sensor).pipe(
            tap(() => this.refreshSensors())
        );
    }

    /**
     * 刪除感測器
     */
    deleteSensor(id: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/sensors/${id}/`).pipe(
            tap(() => this.refreshSensors())
        );
    }

    // ========== Sensor Data ==========

    /**
     * 取得感測器最新數據
     */
    getSensorLatestData(sensorId: number): Observable<SensorData> {
        return this.http.get<SensorData>(`${this.apiUrl}/sensors/${sensorId}/latest_data/`);
    }

    /**
     * 批次取得多個感測器的即時數據
     */
    getRealtimeData(sensorIds: string[]): Observable<RealtimeDataResult> {
        const params = new HttpParams().set('sensor_ids', sensorIds.join(','));

        return this.http.get<RealtimeDataResult>(
            `${this.apiUrl}/sensors/realtime/`,
            { params }
        ).pipe(
            tap(data => this._realtimeData$.next(data))
        );
    }

    /**
     * 取得感測器歷史數據
     */
    getSensorHistory(sensorId: number, hours: number = 24): Observable<SensorDataLog[]> {
        const params = new HttpParams().set('hours', hours.toString());

        return this.http.get<SensorDataLog[]>(
            `${this.apiUrl}/sensors/${sensorId}/history/`,
            { params }
        );
    }

    // ========== Bindings ==========

    /**
     * 取得特定感測器的所有綁定
     */
    getSensorBindings(sensorId: number): Observable<SensorBimBinding[]> {
        return this.http.get<SensorBimBinding[]>(`${this.apiUrl}/sensors/${sensorId}/bindings/`);
    }

    /**
     * 根據 model URN 取得所有綁定
     */
    getBindingsByModel(modelUrn: string): Observable<SensorBimBinding[]> {
        const params = new HttpParams().set('model_urn', modelUrn);

        return this.http.get<SensorBimBinding[]>(
            `${this.apiUrl}/bindings/by_model/`,
            { params }
        );
    }

    /**
     * 取得所有綁定
     */
    getBindings(params?: BindingQueryParams): Observable<SensorBimBinding[]> {
        let httpParams = new HttpParams();

        if (params) {
            Object.keys(params).forEach(key => {
                const value = params[key as keyof BindingQueryParams];
                if (value !== null && value !== undefined) {
                    httpParams = httpParams.set(key, value.toString());
                }
            });
        }

        return this.http.get<SensorBimBinding[]>(`${this.apiUrl}/bindings/`, { params: httpParams });
    }

    /**
     * 建立綁定
     */
    createBinding(binding: Partial<SensorBimBinding>): Observable<SensorBimBinding> {
        return this.http.post<SensorBimBinding>(`${this.apiUrl}/bindings/`, binding);
    }

    /**
     * 更新綁定
     */
    updateBinding(id: number, binding: Partial<SensorBimBinding>): Observable<SensorBimBinding> {
        return this.http.patch<SensorBimBinding>(`${this.apiUrl}/bindings/${id}/`, binding);
    }

    /**
     * 刪除綁定
     */
    deleteBinding(id: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/bindings/${id}/`);
    }

    /**
     * 批次建立綁定
     */
    batchCreateBindings(request: BatchCreateBindingsRequest): Observable<BatchCreateBindingsResponse> {
        return this.http.post<BatchCreateBindingsResponse>(
            `${this.apiUrl}/bindings/batch_create/`,
            request
        );
    }

    /**
     * 批次刪除綁定
     */
    batchDeleteBindings(request: BatchDeleteBindingsRequest): Observable<BatchDeleteBindingsResponse> {
        return this.http.post<BatchDeleteBindingsResponse>(
            `${this.apiUrl}/bindings/batch_delete/`,
            request
        );
    }

    // ========== Helper Methods ==========

    /**
     * 刷新感測器列表
     */
    private refreshSensors(): void {
        this.getSensors().subscribe();
    }

    /**
     * 取得特定類型的感測器
     */
    getSensorsByType(type: string): Observable<Sensor[]> {
        return this.getSensors({ sensor_type: type as any });
    }

    /**
     * 取得啟用的感測器
     */
    getActiveSensors(): Observable<Sensor[]> {
        return this.getSensors({ is_active: true });
    }

    /**
     * 清除快取
     */
    clearCache(): void {
        this._sensors$.next([]);
        this._realtimeData$.next({});
    }
}
