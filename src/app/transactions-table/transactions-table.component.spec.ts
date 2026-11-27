import {TestBed} from '@angular/core/testing';
import {TransactionsTableComponent} from './transactions-table.component';
import {I18nService} from '../i18n/i18n.service';

describe('TransactionsTableComponent', () => {
  beforeEach(() => localStorage.clear());

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
    expect(cells).toEqual(['01/02/2026', 'Affitto', '-720.00', '']);
  });

  it('writes amounts in the format of the language', () => {
    TestBed.inject(I18nService).setLang('it');
    const fixture = TestBed.createComponent(TransactionsTableComponent);
    const table = fixture.componentInstance;
    table.accountsData = {
      Conto: [{account: 'Conto', datetime: '2026-02-01T09:00:00', description: 'Stipendio', amount: 1500.5, fee: 0, cumulativeAmount: 1500.5, currency: 'EUR'}]
    };
    table.ngOnChanges();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('th')?.textContent).toBe('Data');
    expect(fixture.nativeElement.querySelector('td.num')?.textContent?.trim()).toBe('1500,50');
  });

  it('marks the movements sent by the bank with a label, not only a colour', () => {
    const fixture = TestBed.createComponent(TransactionsTableComponent);
    const table = fixture.componentInstance;
    table.accountsData = {
      Conto: [
        {account: 'Conto', datetime: '2026-02-02T09:00:00', description: 'Spesa', amount: -40, fee: 0, cumulativeAmount: 960, currency: 'EUR', source: 'BANK'},
        {account: 'Conto', datetime: '2026-02-01T09:00:00', description: 'Affitto', amount: -720, fee: 0, cumulativeAmount: 1000, currency: 'EUR', source: 'FILE'}
      ]
    };
    table.ngOnChanges();
    fixture.detectChanges();

    const marks = fixture.nativeElement.querySelectorAll('tbody .from-bank') as NodeListOf<HTMLElement>;
    expect(marks.length).toBe(1);
    expect(marks[0].closest('tr')?.textContent).toContain('Spesa');
    expect(marks[0].textContent).toContain('bank');
    expect(marks[0].getAttribute('title')).toBe('Imported from the bank');
  });
});
