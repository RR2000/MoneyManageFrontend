import {TestBed} from '@angular/core/testing';
import {TransactionsTableComponent} from './transactions-table.component';

describe('TransactionsTableComponent', () => {
  it('lists the movements of all accounts, newest first, each under its account', () => {
    const fixture = TestBed.createComponent(TransactionsTableComponent);
    const table = fixture.componentInstance;
    table.accountsData = {
      Risparmi: [{account: 'Risparmi', datetime: '2026-01-28T12:00:00', description: 'Giroconto', amount: 300, fee: 0, cumulativeAmount: 300, currency: 'EUR'}],
      Conto_corrente: [{account: 'Conto_corrente', datetime: '2026-02-01T09:00:00', description: 'Affitto', amount: -720, fee: 0, cumulativeAmount: 1000, currency: 'EUR'}]
    };
    table.ngOnChanges();
    fixture.detectChanges();

    expect(table.columns).toEqual(['Conto_corrente', 'Risparmi']);
    expect(table.rows.map(r => r.description)).toEqual(['Affitto', 'Giroconto']);
    const cells = Array.from(fixture.nativeElement.querySelectorAll('tbody tr:first-child td') as NodeListOf<HTMLElement>)
      .map(td => td.textContent?.trim());
    expect(cells).toEqual(['2026-02-01', 'Affitto', '-720.00', '']);
  });
});
