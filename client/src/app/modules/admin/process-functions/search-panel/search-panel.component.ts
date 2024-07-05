import { NgClass } from '@angular/common';
import { Component, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-search-panel',
    templateUrl: './search-panel.component.html',
    styleUrl: './search-panel.component.scss',
    standalone: true,
    imports: [NgClass, FormsModule, MatIconModule],
})
export class SearchPanelComponent implements OnInit {

    @Input() criteria = [];

    ngOnInit(): void { }

    onSelected(item) {
        item.selected = !item.selected;
    }
}

