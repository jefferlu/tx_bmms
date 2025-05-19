import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AppService } from 'app/app.service';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class BimModelViewerService {

    constructor(
        private http: HttpClient,
        private _appService: AppService) { }

    getData(slug?: any): Observable<any> {
        return this._appService.get('forge/bim-model', slug);
    }

    downloadCsv(fileName: string) {
        if (!fileName) {
            alert('請輸入 file_name');
            return;
        }

        const url = `/api/bim-cobie-objects/?file_name=${encodeURIComponent(fileName)}`;
        this.http.get(url, { responseType: 'blob' }).subscribe({
            next: (blob: Blob) => {
                // 創建 Blob 並生成臨時 URL
                const downloadUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = 'bim_objects.csv'; // 檔案名稱，與 API 的 filename 一致
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(downloadUrl); // 清理臨時 URL
            },
            error: (error) => {
                // 處理錯誤（例如 HTTP 400, 404, 500）
                error.error.text().then((errorMessage: string) => {
                    const errorJson = JSON.parse(errorMessage);
                    alert(errorJson.error || errorJson.message || '下載失敗，請稍後再試');
                }).catch(() => {
                    alert('下載失敗，請聯繫管理員');
                });
            }
        });
    }
}
