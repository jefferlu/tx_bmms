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
                "id": "1001",
                "sysid": "bmms-nodejs-202408103100012432",
                "task": "API GET /bmms/list-bims",
                "status": "status:200",
                "time": "2024-09-11 09:15:23",
                "ip": "10.20.12.1"
              },
              {
                  "id": "1001",
                  "sysid": "bmms-nodejs-202408103100012431",
                  "task": "API GET /bmms/list-bims",
                  "status": "status:200",
                  "time": "2024-09-11 09:15:23",
                  "ip": "10.20.12.1"
              },
              {
                  "id": "1002",
                  "sysid": "bmms-nodejs-202408103100012432",
                  "task": "API PUT /bmms/user/2",
                  "status": "status:200",
                  "time": "2024-09-11 09:15:23",
                  "ip": "10.20.12.11"
              },
              {
                  "id": "1003",
                  "sysid": "bmms-nodejs-202408103100012433",
                  "task": "USER Login",
                  "status": "user:test@example.com sign-in completed",
                  "time": "2024-09-11 09:15:23",
                  "ip": "10.20.1.12"
              },
              {
                  "id": "1004",
                  "sysid": "bmms-nodejs-202408103100012434",
                  "task": "API POST /bmms/create-item",
                  "status": "status:201",
                  "time": "2024-09-12 10:00:00",
                  "ip": "10.20.12.12"
              },
              {
                  "id": "1005",
                  "sysid": "bmms-nodejs-202408103100012435",
                  "task": "API DELETE /bmms/item/3",
                  "status": "status:404",
                  "time": "2024-09-12 10:15:00",
                  "ip": "10.20.12.13"
              },
              {
                  "id": "1006",
                  "sysid": "bmms-nodejs-202408103100012436",
                  "task": "USER Logout",
                  "status": "user:test@example.com sign-out completed",
                  "time": "2024-09-12 10:30:00",
                  "ip": "10.20.1.15"
              },
              {
                  "id": "1007",
                  "sysid": "bmms-nodejs-202408103100012437",
                  "task": "API GET /bmms/item/1",
                  "status": "status:200",
                  "time": "2024-09-13 11:00:00",
                  "ip": "10.20.12.14"
              },
              {
                  "id": "1008",
                  "sysid": "bmms-nodejs-202408103100012438",
                  "task": "API PATCH /bmms/user/5",
                  "status": "status:200",
                  "time": "2024-09-13 11:15:00",
                  "ip": "10.20.12.15"
              },
              {
                  "id": "1009",
                  "sysid": "bmms-nodejs-202408103100012439",
                  "task": "USER Password Change",
                  "status": "status:200",
                  "time": "2024-09-13 11:30:00",
                  "ip": "10.20.1.20"
              },
              {
                  "id": "1010",
                  "sysid": "bmms-nodejs-202408103100012440",
                  "task": "API GET /bmms/list-users",
                  "status": "status:200",
                  "time": "2024-09-14 12:00:00",
                  "ip": "10.20.12.16"
              },
              {
                  "id": "1011",
                  "sysid": "bmms-nodejs-202408103100012441",
                  "task": "API POST /bmms/user",
                  "status": "status:201",
                  "time": "2024-09-14 12:15:00",
                  "ip": "10.20.12.17"
              },
              {
                  "id": "1012",
                  "sysid": "bmms-nodejs-202408103100012442",
                  "task": "API GET /bmms/item/2",
                  "status": "status:200",
                  "time": "2024-09-14 12:30:00",
                  "ip": "10.20.1.25"
              },
              {
                  "id": "1013",
                  "sysid": "bmms-nodejs-202408103100012443",
                  "task": "API PUT /bmms/item/4",
                  "status": "status:200",
                  "time": "2024-09-15 13:00:00",
                  "ip": "10.20.12.18"
              },
              {
                  "id": "1014",
                  "sysid": "bmms-nodejs-202408103100012444",
                  "task": "USER Profile Update",
                  "status": "user:test2@example.com profile updated",
                  "time": "2024-09-15 13:15:00",
                  "ip": "10.20.1.30"
              },
              {
                  "id": "1015",
                  "sysid": "bmms-nodejs-202408103100012445",
                  "task": "API GET /bmms/statistics",
                  "status": "status:200",
                  "time": "2024-09-15 13:30:00",
                  "ip": "10.20.12.19"
              },
              {
                  "id": "1016",
                  "sysid": "bmms-nodejs-202408103100012446",
                  "task": "DB Restore",
                  "status": "status:completed",
                  "time": "2024-09-16 14:00:00",
                  "ip": "10.20.12.20"
              },
              {
                  "id": "1017",
                  "sysid": "bmms-nodejs-202408103100012447",
                  "task": "API GET /bmms/user/1",
                  "status": "status:200",
                  "time": "2024-09-16 14:15:00",
                  "ip": "10.20.1.35"
              },
              {
                  "id": "1018",
                  "sysid": "bmms-nodejs-202408103100012448",
                  "task": "USER Login",
                  "status": "user:test2@example.com sign-in completed",
                  "time": "2024-09-16 14:30:00",
                  "ip": "10.20.12.21"
              },
              {
                  "id": "1019",
                  "sysid": "bmms-nodejs-202408103100012449",
                  "task": "API PATCH /bmms/item/5",
                  "status": "status:200",
                  "time": "2024-09-17 15:00:00",
                  "ip": "10.20.12.22"
              },
              {
                  "id": "1020",
                  "sysid": "bmms-nodejs-202408103100012450",
                  "task": "API GET /bmms/item/6",
                  "status": "status:200",
                  "time": "2024-09-17 15:15:00",
                  "ip": "10.20.1.40"
              },
              {
                  "id": "1021",
                  "sysid": "bmms-nodejs-202408103100012451",
                  "task": "USER Logout",
                  "status": "user:test2@example.com sign-out completed",
                  "time": "2024-09-17 15:30:00",
                  "ip": "10.20.12.23"
              },
              {
                  "id": "1022",
                  "sysid": "bmms-nodejs-202408103100012452",
                  "task": "API GET /bmms/list-bims",
                  "status": "status:200",
                  "time": "2024-09-18 16:00:00",
                  "ip": "10.20.1.45"
              },
              {
                  "id": "1023",
                  "sysid": "bmms-nodejs-202408103100012453",
                  "task": "API POST /bmms/create-user",
                  "status": "status:201",
                  "time": "2024-09-18 16:15:00",
                  "ip": "10.20.12.24"
              },
              {
                  "id": "1024",
                  "sysid": "bmms-nodejs-202408103100012454",
                  "task": "API PUT /bmms/user/4",
                  "status": "status:200",
                  "time": "2024-09-18 16:30:00",
                  "ip": "10.20.12.25"
              },           
        ];
    }2
    
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
