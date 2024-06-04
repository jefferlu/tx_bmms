import { NgFor, NgIf, TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

@Component({
    selector: 'profile',
    templateUrl: './profile.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatFormFieldModule, MatIconModule, MatInputModule, MatButtonModule, NgFor, NgIf, MatSelectModule, MatOptionModule, TitleCasePipe],
})
export class ProfileComponent implements OnInit {
    members: any[];
    roles: any[];

    /**
     * Constructor
     */
    constructor() {
    }

    ngOnInit(): void {
        // Setup the team members
        this.members = [
            {
                avatar: 'assets/images/avatars/avatar.png',
                name: 'Dejesus Michael',
                email: 'dejesusmichael@mail.org',
                role: '系統管理員',
            },
            {
                avatar: 'assets/images/avatars/avatar.png',
                name: 'Mclaughlin Steele',
                email: 'mclaughlinsteele@mail.me',
                role: '安控管理人員',
            },
            {
                avatar: 'assets/images/avatars/avatar.png',
                name: 'Laverne Dodson',
                email: 'lavernedodson@mail.ca',
                role: '圖資管理人員',
            },
            {
                avatar: 'assets/images/avatars/avatar.png',
                name: 'Trudy Berg',
                email: 'trudyberg@mail.us',
                role: '圖資管理人員',
            },
            {
                avatar: 'assets/images/avatars/avatar.png',
                name: 'Lamb Underwood',
                email: 'lambunderwood@mail.me',
                role: '圖資作業人員',
            },
            {
                avatar: 'assets/images/avatars/avatar.png',
                name: 'Mcleod Wagner',
                email: 'mcleodwagner@mail.biz',
                role: '一般查詢使用者',
            },
            {
                avatar: 'assets/images/avatars/avatar.png',
                name: 'Shannon Kennedy',
                email: 'shannonkennedy@mail.ca',
                role: '一般查詢使用者',
            },
        ];

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

    /**
     * Track by function for ngFor loops
     *
     * @param index
     * @param item
     */
    trackByFn(index: number, item: any): any {
        return item.id || index;
    }

}

