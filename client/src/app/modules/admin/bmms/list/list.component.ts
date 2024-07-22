import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { AlertService } from 'app/layout/common/alert/alert.service';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { BmmsService } from '../bmms.service';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
    selector: 'bmms-list',
    templateUrl: './list.component.html',
    styleUrl: './list.component.scss',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, RouterLink,
        MatIconModule, MatButtonModule, MatInputModule,
        MatTableModule, MatSortModule, TranslocoModule
    ],
})
export class BmmsListComponent implements OnInit, OnDestroy {

    @ViewChild(MatSort) sort: MatSort;

    form: UntypedFormGroup;

    dataSource = null;
    displayedColumns: string[] = ['no', 'name',];

    constructor(
        private _activatedRoute: ActivatedRoute,
        private _changeDetectorRef: ChangeDetectorRef,
        private _formBuilder: UntypedFormBuilder,
        private _alert: AlertService,
        private _bs: BmmsService
    ) { }
    

    ngOnInit(): void {
        this.form = this._formBuilder.group({
            name: ['']
        });
    }

    onSearch(): void {
        if (this.form.invalid) return;
        this.search();
    }
    search(): void {
        let slug = {};
        if (this.form.get('name').value) slug['name'] = this.form.get('name').value;

        this._bs.getBmmsList(slug).subscribe({
            next: (res) => {
                if (res) {
                    console.log(res)

                    // mat-table
                    this.dataSource = new MatTableDataSource(res)
                    this.dataSource.sort = this.sort;

                    // this._nreService.query = {
                    //     customer: this.form.get('customer').value,
                    //     project: this.form.get('project').value
                    // }

                    // 清空project
                    // if (res.length > 0) this.form.get('project').setValue(null);

                    this._changeDetectorRef.markForCheck();
                }
            },
            error: e => {
                console.log(e)
                this._alert.open({ type: 'warn', message: JSON.stringify(e.message) });
            }
        });
    }


    ngOnDestroy(): void {
        console.log('destory')
    }
}
