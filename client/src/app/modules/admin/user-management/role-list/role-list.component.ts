import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { NgClass, NgFor, NgSwitch, NgSwitchCase } from '@angular/common';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Subject } from 'rxjs';
import { RoleProfileComponent } from './role-profile/role-profile.component';

@Component({
  selector: 'role-list',
  standalone: true,
  templateUrl: './role-list.component.html',
  styleUrl: './role-list.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatSidenavModule, MatButtonModule, MatIconModule, NgFor, NgClass, NgSwitch, NgSwitchCase, RoleProfileComponent]
  //imports: [MatSidenavModule, MatButtonModule, MatIconModule, NgFor, NgClass, NgSwitch, NgSwitchCase, RoleProfileComponent]
})
export class RoleListComponent implements OnInit, OnDestroy {

  @ViewChild('drawer') drawer: MatDrawer;
  drawerMode: 'over' | 'side' = 'side';
  drawerOpened: boolean = true;
  roles: any[] = [];
  selectedRole: string = 'sysadmin';
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  ngOnInit(): void {
      // Setup available roles
      this.roles = [
          {
              id: 'sysadmin',
              icon: 'heroicons_outline:user-circle',
              title: '系統管理員'
          },
          {
              id: 'security',
              icon: 'heroicons_outline:user-circle',
              title: '安控管理人員'
          },
          {
              id: 'manager',
              icon: 'heroicons_outline:user-circle',
              title: '圖模管理人員'
          },
          {
              id: 'operator',
              icon: 'heroicons_outline:user-circle',
              title: '圖資作業人員'
          },
          {
              id: 'inquirer',
              icon: 'heroicons_outline:user-circle',
              title: '一般查詢使用者'
          }  
      ];
  }

  goToRole(role: string): void {
      this.selectedRole = role;

      // Close the drawer on 'over' mode
      if (this.drawerMode === 'over') {
          this.drawer.close();
      }
  }

  getRoleInfo(id: string): any {
      console.log(id)
      return this.roles.find(role => role.id === id);
  }

  trackByFn(index: number, item: any): any {
      return item.id || index;
  }

  ngOnDestroy(): void {
      // Unsubscribe from all subscriptions
      this._unsubscribeAll.next(null);
      this._unsubscribeAll.complete();
  }
}

