import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterOutlet } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { TreeNode } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { TreeModule } from 'primeng/tree';
import { JsonPipe } from '@angular/common';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';

@Component({
    selector: 'log-query',
    templateUrl: './log-query.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        RouterOutlet, JsonPipe,
        MatButtonModule, MatIconModule,
        TreeModule, TableModule,
        TranslocoModule,
        MatMenuModule,
        MatDividerModule,
    ],

})
export class LogQueryComponent implements OnInit, OnDestroy {

    // viewer: any;
    // options: any;

    log: any[];

    criteria: any[];

    constructor() { }

    ngOnInit(): void {
        this.log = [
            {
                "id": "1004",
                "username": "王X明 user@example.com ",
                "function": "系統設定功能",
                "action": "新增權限群組: 自訂群組一",
                "time": "2024-09-11 09:15:23",
                "ip": "10.20.1.11"
              },
              {
                "id": "1005",
                "username": "陳X華 user@example.com",
                "function": "使用者管理功能",
                "action": "新增使用者: 新工程師",
                "time": "2024-09-11 10:32:41",
                "ip": "10.20.2.3"
              },
              {
                "id": "1006",
                "username": "林X婷 user@example.com",
                "function": "權限設定功能",
                "action": "授予權限: 查看3D模型",
                "time": "2024-09-11 11:48:59",
                "ip": "10.20.2.15"
              },
              {
                "id": "1007",
                "username": "郭X偉 user@example.com",
                "function": "版本控制功能",
                "action": "恢復舊版本: 模型版本1.0",
                "time": "2024-09-11 13:05:17",
                "ip": "10.20.1.13"
              },
              {
                "id": "1008",
                "username": "許X文 user@example.com",
                "function": "圖模匯入功能",
                "action": "檔名: T3-XXX-XXX",
                "time": "2024-09-11 14:22:35",
                "ip": "10.20.1.21"
              },
              {
                "id": "1009",
                "username": "黃X美 user@example.com",
                "function": "標註管理功能",
                "action": "編輯標註: 修改材料說明",
                "time": "2024-09-11 15:39:53",
                "ip": "10.20.1.105"
              },
              {
                "id": "1010",
                "username": "鄭X哲 user@example.com",
                "function": "模板管理功能",
                "action": "刪除模板: 建築模板A",
                "time": "2024-09-12 09:04:11",
                "ip": "10.20.1.20"
              },
              {
                "id": "1011",
                "username": "吳X婷 user@example.com",
                "function": "批次處理功能",
                "action": "批次匯出: DXF格式為2D圖",
                "time": "2024-09-12 10:21:29",
                "ip": "10.20.1.17"
              },
              {
                "id": "1012",
                "username": "劉X偉 user@example.com",
                "function": "插件管理功能",
                "action": "安裝插件: Dynamo for Revit",
                "time": "2024-09-12 11:38:47",
                "ip": "10.20.1.23"
              },
              {
                "id": "1013",
                "username": "蔡X文 user@example.com",
                "function": "協同編輯功能",
                "action": "邀請協作者: 設計部門主管",
                "time": "2024-09-12 12:56:05",
                "ip": "10.20.2.34"
              },
              {
                "id": "1014",
                "username": "林X美 user@example.com",
                "function": "報告生成功能",
                "action": "生成結構分析報告",
                "time": "2024-09-12 14:13:23",
                "ip": "10.20.3.6"
              },
              {
                "id": "1015",
                "username": "郭X哲 user@example.com",
                "function": "模型比較功能",
                "action": "比較兩個版本: V1.0 vs V2.0",
                "time": "2024-09-12 15:30:41",
                "ip": "10.20.2.15"
              },
              {
                "id": "1016",
                "username": "許X婷 user@example.com",
                "function": "雲端同步功能",
                "action": "同步本地模型至雲端",
                "time": "2024-09-13 09:48:59",
                "ip": "10.20.3.11"
              },
              {
                "id": "1017",
                "username": "黃X偉 user@example.com",
                "function": "模型轉換功能",
                "action": "轉換格式: SKP轉為FBX",
                "time": "2024-09-13 11:05:17",
                "ip": "10.20.21.12"
              },
              {
                "id": "1018",
                "username": "鄭X美 user@example.com",
                "function": "模型校正功能",
                "action": "校正模型: 與測量數據比對",
                "time": "2024-09-13 12:22:35",
                "ip": "10.20.1.41"
              },
              {
                "id": "1019",
                "username": "吳X哲 user@example.com",
                "function": "模型切割功能",
                "action": "切割模型: 分割建築物為樓層",
                "time": "2024-09-13 13:39:53",
                "ip": "10.20.1.13"
              },
              {
                "id": "1020",
                "username": "劉X婷 user@example.com",
                "function": "模型查詢功能",
                "action": "查詢元件: 門窗",
                "time": "2024-09-13 14:57:11",
                "ip": "10.20.1.14"
              }
        ];
    }
    
    /**
     * Track by function for ngFor loops
     *
     * @param index
     * @param item
     */
    trackByFn(index: number, item: any): any {
        return item.id || index;
    }

    ngAfterViewInit(): void {
       
    }

    ngOnDestroy(): void {
    }
}
