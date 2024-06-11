import {COMMA, ENTER} from '@angular/cdk/keycodes';
import {Component, ElementRef, ViewChild, inject} from '@angular/core';
import {FormControl, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatAutocompleteSelectedEvent, MatAutocompleteModule} from '@angular/material/autocomplete';
import {MatChipInputEvent, MatChipsModule} from '@angular/material/chips';
import {Observable} from 'rxjs';
import {map, startWith} from 'rxjs/operators';
import {MatIconModule} from '@angular/material/icon';
import {AsyncPipe} from '@angular/common';
import {MatFormFieldModule} from '@angular/material/form-field';
import {LiveAnnouncer} from '@angular/cdk/a11y';
import { MatButtonModule } from '@angular/material/button';


/**
 * @title Chips Autocomplete
 */
@Component({
  selector: 'ChipsearchComponent',
  templateUrl: './chipsearch.component.html',
  styleUrl: './chipsearch.component.scss',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatChipsModule,
    MatIconModule,
    MatAutocompleteModule,
    ReactiveFormsModule,
    AsyncPipe,
    MatButtonModule,
  ],
})
export class ChipsearchComponent {
  separatorKeysCodes: number[] = [ENTER, COMMA];
  // floor 
  floorCtrl = new FormControl('');
  filteredFloors: Observable<string[]>;
  floors: string[] = ['1F'];
  allFloors: string[] = ['B1', 'B2', '1F', '2F', '3F','4F','RF'];
  // space
  spaceCtrl = new FormControl('');
  filteredSpaces: Observable<string[]>;
  spaces: string[] = ['辦公室'];
  allSpaces: string[] = ['走廊', '電梯', '辦公室', '廁所', '大廳','手扶梯','停車場'];
  // category
  categoryCtrl = new FormControl('');
  filteredCategorys: Observable<string[]>;
  categorys: string[] = ['電氣及電力'];
  allCategorys: string[] = ['弱電及電信', '電氣及電力', '消防', '環控', '電機','排水','汙水'];
  //  equipment
  equipmentCtrl = new FormControl('');
  filteredEquipments: Observable<string[]>;
  equipments: string[] = ['電氣箱'];
  allEquipments: string[] = ['雙開防火門', '電氣箱', '設備箱', '消防設備', '弱電箱','大門','氣密窗'];


  @ViewChild('floorInput') floorInput: ElementRef<HTMLInputElement>;
  @ViewChild('spaceInput') spaceInput: ElementRef<HTMLInputElement>;
  @ViewChild('categoryInput') categoryInput: ElementRef<HTMLInputElement>;
  @ViewChild('equipmentInput') equipmentInput: ElementRef<HTMLInputElement>;

  announcer = inject(LiveAnnouncer);

  constructor() {
    this.filteredFloors = this.floorCtrl.valueChanges.pipe(
      startWith(null),
      map((floor: string | null) => (floor ? this._filterfloor(floor) : this.allFloors.slice())),
    )
    this.filteredSpaces = this.spaceCtrl.valueChanges.pipe(
      startWith(null),
      map((space: string | null) => (space ? this._filterspace(space) : this.allSpaces.slice())),
    )
    this.filteredCategorys = this.categoryCtrl.valueChanges.pipe(
      startWith(null),
      map((category: string | null) => (category ? this._filtercategory(category) : this.allCategorys.slice())),
    )
    this.filteredEquipments = this.equipmentCtrl.valueChanges.pipe(
      startWith(null),
      map((equipment: string | null) => (equipment ? this._filterequipment(equipment) : this.allEquipments.slice())),
    );
  }

  addfloor(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();

    // Add our floor
    if (value) {
      this.floors.push(value);
    }

    // Clear the input value
    event.chipInput!.clear();

    this.floorCtrl.setValue(null);
  }

  addspace(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();

    // Add our space
    if (value) {
      this.spaces.push(value);
    }

    // Clear the input value
    event.chipInput!.clear();

    this.spaceCtrl.setValue(null);
  }

  addcategory(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();

    // Add equipment
    if (value) {
      this.categorys.push(value);
    }

    // Clear the input value
    event.chipInput!.clear();

    this.categoryCtrl.setValue(null);
  }

  addequipment(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();

    // Add equipment
    if (value) {
      this.equipments.push(value);
    }

    // Clear the input value
    event.chipInput!.clear();

    this.equipmentCtrl.setValue(null);
  }


  removefloor(floor: string): void {
    const index = this.floors.indexOf(floor);

    if (index >= 0) {
      this.floors.splice(index, 1);

      this.announcer.announce(`Removed ${floor}`);
    }
  }

  removespace(space: string): void {
    const index = this.spaces.indexOf(space);

    if (index >= 0) {
      this.spaces.splice(index, 1);

      this.announcer.announce(`Removed ${space}`);
    }
  }

  removeequipment(equipment: string): void {
    const index = this.equipments.indexOf(equipment);

    if (index >= 0) {
      this.equipments.splice(index, 1);

      this.announcer.announce(`Removed ${equipment}`);
    }
  }

  removecategory(category: string): void {
    const index = this.categorys.indexOf(category);

    if (index >= 0) {
      this.categorys.splice(index, 1);

      this.announcer.announce(`Removed ${category}`);
    }
  }

  selectedfloor(event: MatAutocompleteSelectedEvent): void {
    this.floors.push(event.option.viewValue);
    this.floorInput.nativeElement.value = '';
    this.floorCtrl.setValue(null);
  }

  selectedspace(event: MatAutocompleteSelectedEvent): void {
    this.spaces.push(event.option.viewValue);
    this.spaceInput.nativeElement.value = '';
    this.spaceCtrl.setValue(null);
  }

  selectedcategory(event: MatAutocompleteSelectedEvent): void {
    this.categorys.push(event.option.viewValue);
    this.categoryInput.nativeElement.value = '';
    this.categoryCtrl.setValue(null);
  }

  selectedequipment(event: MatAutocompleteSelectedEvent): void {
    this.equipments.push(event.option.viewValue);
    this.equipmentInput.nativeElement.value = '';
    this.equipmentCtrl.setValue(null);
  }

  private _filterfloor(value: string): string[] {
    const filterValue = value.toLowerCase();

    return this.allFloors.filter(floor => floor.toLowerCase().includes(filterValue))
  }
  
  private _filterspace(value: string): string[] {
    const filterValue = value.toLowerCase();

    return this.allSpaces.filter(space => space.toLowerCase().includes(filterValue))
  }

  private _filtercategory(value: string): string[] {
    const filterValue = value.toLowerCase();

    return this.allCategorys.filter(category => category.toLowerCase().includes(filterValue))
  }

  private _filterequipment(value: string): string[] {
    const filterValue = value.toLowerCase();

    return this.allEquipments.filter(equipment => equipment.toLowerCase().includes(filterValue))
  }
}
