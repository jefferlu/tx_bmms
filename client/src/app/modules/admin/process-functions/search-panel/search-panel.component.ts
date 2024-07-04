import { NgClass } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

@Component({
    selector: 'app-search-panel',
    templateUrl: './search-panel.component.html',
    styleUrl: './search-panel.component.scss',
    standalone: true,
    imports: [NgClass],
})
export class SearchPanelComponent implements OnInit {

    @Input() criteria = [];

    ngOnInit(): void { }

    onSelected(item) {
        item.selected = !item.selected;
    }
}

