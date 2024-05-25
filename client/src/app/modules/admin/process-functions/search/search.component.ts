import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkListbox, CdkOption } from '@angular/cdk/listbox';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

@Component({
    selector: 'app-search',
    templateUrl: './search.component.html',
    styleUrl: './search.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatButtonModule, MatDialogModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule, NgIf, NgFor, CdkListbox, CdkOption, FormsModule, AsyncPipe],
})
export class SearchComponent {

    categories = [{ id: 1, name: '桃園機場第三航廈新建工程 T3' }]
    categories2 = [{ id: 1, name: 'T36B: 第六B標 主體航廈機電工程' }]
    categories3 = [{ id: 1, name: '大廳' },{ id: 1, name: '辦公區域' },{ id: 1, name: '男廁' },{ id: 1, name: '女廁' }]
    categories4 = [{ id: 1, name: '機坪' },{ id: 1, name: '滑行道' },{ id: 1, name: '機坪設施' }]
}

