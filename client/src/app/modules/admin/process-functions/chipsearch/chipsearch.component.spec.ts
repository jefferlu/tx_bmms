import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChipsearchComponent } from './chipsearch.component';

describe('ChipsearchComponent', () => {
  let component: ChipsearchComponent;
  let fixture: ComponentFixture<ChipsearchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChipsearchComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ChipsearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
