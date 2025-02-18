import { NgClass } from '@angular/common';
import { Component, Input, OnInit, Output } from '@angular/core';
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

    ngOnInit(): void { }

    onSelected(item) {
        console.log(item)
        item.selected = !item.selected;
    }

    onCollapse(criterion) {
        criterion.collapse = !criterion.collapse;
    }
}

