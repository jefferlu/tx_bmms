import { NgFor, NgIf, TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatSidenavModule } from '@angular/material/sidenav';
import { UserDialogComponent } from './user-dialog/user-dialog.component';
import { UserAccountService } from './user-account.service';
import { Subject, takeUntil } from 'rxjs';
import { GtsConfirmationService } from '@gts/services/confirmation';
import { ToastService } from 'app/layout/common/toast/toast.service';

@Component({
    selector: 'user-account',
    templateUrl: './user-account.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatSidenavModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatButtonModule,
        MatSelectModule,
        MatOptionModule,
        TitleCasePipe],
})
export class UserAccountComponent implements OnInit, OnDestroy {

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    users: any[];
    roles: any[];

    /**
     * Constructor
     */
    constructor(
        private _matDialog: MatDialog,
        private _changeDetectorRef: ChangeDetectorRef,
        private _gtsConfirmationService: GtsConfirmationService,
        private _toastService: ToastService,
        private _userAccountService: UserAccountService,        
    ) { }

    ngOnInit(): void {

        this._userAccountService.users$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((res: any) => {
                this.users = res.map((r: any) => ({
                    ...r,
                    role: '系統管理員',
                }));

                // Mark for check
                this._changeDetectorRef.markForCheck();
            });


        // Setup the team members
        // this.users = [
        //     {
        //         avatar: 'assets/images/avatars/avatar.png',
        //         username: 'Dejesus Michael',
        //         email: 'dejesusmichael@mail.org',
        //         role: '系統管理員',
        //     },
        //     {
        //         avatar: 'assets/images/avatars/avatar.png',
        //         username: 'Mclaughlin Steele',
        //         email: 'mclaughlinsteele@mail.me',
        //         role: '安控管理人員',
        //     },
        //     {
        //         avatar: 'assets/images/avatars/avatar.png',
        //         username: 'Laverne Dodson',
        //         email: 'lavernedodson@mail.ca',
        //         role: '圖資管理人員',
        //     },
        //     {
        //         avatar: 'assets/images/avatars/avatar.png',
        //         username: 'Trudy Berg',
        //         email: 'trudyberg@mail.us',
        //         role: '圖資管理人員',
        //     },
        //     {
        //         avatar: 'assets/images/avatars/avatar.png',
        //         username: 'Lamb Underwood',
        //         email: 'lambunderwood@mail.me',
        //         role: '圖資作業人員',
        //     },
        //     {
        //         avatar: 'assets/images/avatars/avatar.png',
        //         username: 'Mcleod Wagner',
        //         email: 'mcleodwagner@mail.biz',
        //         role: '一般查詢使用者',
        //     },
        //     {
        //         avatar: 'assets/images/avatars/avatar.png',
        //         username: 'Shannon Kennedy',
        //         email: 'shannonkennedy@mail.ca',
        //         role: '一般查詢使用者',
        //     },
        // ];

        // Setup the roles
        this.roles = [
            {
                label: '系統管理員',
                value: '系統管理員',
                // description: 'Can read and clone this repository. Can also open and comment on issues and pull requests.',
            },
            {
                label: '安控管理人員',
                value: '安控管理人員',
                // description: 'Can read, clone, and push to this repository. Can also manage issues and pull requests.',
            },
            {
                label: '圖資管理人員',
                value: '圖資管理人員',
                // description: 'Can read, clone, and push to this repository. Can also manage issues, pull requests, and repository settings, including adding collaborators.',
            },
            {
                label: '圖資作業人員',
                value: '圖資作業人員',
                // description: 'Can read, clone, and push to this repository. Can also manage issues, pull requests, and repository settings, including adding collaborators.',
            },
            {
                label: '一般查詢使用者',
                value: '一般查詢使用者',
                // description: 'Can read, clone, and push to this repository. Can also manage issues, pull requests, and repository settings, including adding collaborators.',
            },
            {
                label: '自訂權限1',
                value: '自訂權限1',
                // description: 'Can read, clone, and push to this repository. Can also manage issues, pull requests, and repository settings, including adding collaborators.',
            },
            {
                label: '自訂權限2',
                value: '自訂權限2',
                // description: 'Can read, clone, and push to this repository. Can also manage issues, pull requests, and repository settings, including adding collaborators.',
            },
        ];
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    openDialog(user: any = {}): void {
        this._matDialog.open(UserDialogComponent, {
            data: {
                user: user
            }
        });
    }

    onDelete(user: any = {}): void {
        let dialogRef = this._gtsConfirmationService.open({
            message: `Are you sure to delete?`,
            icon: { color: 'warn' },
            actions: { confirm: { label: 'Delete', color: 'warn' } }

        });

        dialogRef.afterClosed().subscribe(result => {
            if (result === 'confirmed') {
                this.delete(user);
                this._changeDetectorRef.markForCheck();
            }
        });
    }

    delete(user: any = {}): void {
        this._userAccountService.delete(user.id).subscribe({
            next: (res) => {
                this._toastService.open({ message: 'The user has been deleted.' });                
            }
        });
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

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}
