import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LineGraph3Component } from './net-worth-graph.component';

describe('NetWorthGraphComponent', () => {
  let component: LineGraph3Component;
  let fixture: ComponentFixture<LineGraph3Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LineGraph3Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LineGraph3Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
