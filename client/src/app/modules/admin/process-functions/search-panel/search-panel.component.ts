import { NgClass } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-search-panel',
    templateUrl: './search-panel.component.html',
    styleUrl: './search-panel.component.scss',
    imports: [NgClass, FormsModule, MatIconModule, MatButtonModule]
})
export class SearchPanelComponent implements OnInit {

    @Input() criteria = [];
    @Output() categoryChange = new EventEmitter<any[]>();
    @Output() keywordChange = new EventEmitter<string>();

    ngOnInit(): void { }

    onInputChange(event: Event) {
        const inputElement = event.target as HTMLInputElement;
        this.keywordChange.emit(inputElement.value);
    }

    onSelected(item) {
        item.selected = !item.selected;

        const selectedItems = this.criteria
            .flatMap(item => item.bim_categories) // 展開每個 criteria 中的 bim_categories 陣列
            .filter(bc => bc.selected)          // 篩選出 selected 屬性為 true 的元素
            .map(bc => bc.value);
        
        this.categoryChange.emit(selectedItems);
    }

    onCollapse(criterion) {
        criterion.collapse = !criterion.collapse;
    }
}

