import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BrokerWorthGraphComponent } from './broker-worth-graph.component';

describe('BrokerWorthGraphComponent', () => {
  let component: BrokerWorthGraphComponent;
  let fixture: ComponentFixture<BrokerWorthGraphComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrokerWorthGraphComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(BrokerWorthGraphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
