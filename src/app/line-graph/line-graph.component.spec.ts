import {TestBed} from '@angular/core/testing';
import {LineGraphComponent} from './line-graph.component';

describe('LineGraphComponent', () => {
  function graph(inputs: Partial<LineGraphComponent>) {
    const fixture = TestBed.createComponent(LineGraphComponent);
    Object.assign(fixture.componentInstance, inputs);
    fixture.detectChanges();
    return fixture;
  }

  it('says it is loading, not that there is no data', () => {
    const el: HTMLElement = graph({loading: true, emptyText: 'Nessun investimento'}).nativeElement;
    expect(el.textContent).toContain('Loading...');
    expect(el.textContent).not.toContain('Nessun investimento');
  });

  it('shows a failed call with a button to try again', () => {
    const fixture = graph({error: 'Non sono riuscito a caricare i dati.', emptyText: 'Nessun investimento'});
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Non sono riuscito a caricare i dati.');
    expect(el.textContent).not.toContain('Nessun investimento');
    let retried = 0;
    fixture.componentInstance.retry.subscribe(() => retried++);
    (el.querySelector('[role=alert] button') as HTMLButtonElement).click();
    expect(retried).toBe(1);
  });

  it('says there is no data only once the answer came back empty', () => {
    const el: HTMLElement = graph({emptyText: 'Nessun investimento'}).nativeElement;
    expect(el.textContent).toContain('Nessun investimento');
  });
});
