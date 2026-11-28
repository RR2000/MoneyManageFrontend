import {Component, signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {AmountComponent} from './amount.component';
import {FigureComponent} from './figure.component';
import {LoadState, LoadStateComponent} from './load-state.component';
import {PageHeaderComponent} from './page-header.component';
import {ChartComponent, ChartSeries, sample} from './chart.component';
import {SourceTagComponent} from './source-tag.component';
import {I18nService} from '../i18n/i18n.service';

// made-up numbers only
@Component({
  imports: [AmountComponent, FigureComponent, LoadStateComponent, PageHeaderComponent, ChartComponent, SourceTagComponent],
  template: `
    <app-page-header title="Conto corrente" crumb="Conti" crumbLink="/accounts"><button>Azione</button></app-page-header>
    <app-amount class="a1" [value]="1234.5" [signed]="true"/>
    <app-amount class="a2" [value]="-56.7" [signed]="true"/>
    <app-amount class="a3" [value]="-56.7"/>
    <app-figure [value]="248300" [delta]="3420" [deltaShare]="0.014" period="30 giorni" label="Patrimonio netto"/>
    <app-load-state [state]="state()" emptyText="Nessun conto" (retry)="retries = retries + 1"><a href="/import">Importa</a></app-load-state>
    <app-chart [labels]="labels" [series]="series" ariaLabel="Saldo negli ultimi mesi"/>
    <app-source-tag source="BANK"/>`
})
class HostComponent {
  state = signal<LoadState>('loading');
  retries = 0;
  labels = ['2026-09', '2026-10', '2026-11'];
  series: ChartSeries[] = [{name: 'Saldo', values: [100, 150.5, null]}, {name: 'Altro', values: [1, 2, 3]}];
}

describe('UI components', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({providers: [provideRouter([])]});
  });

  function host() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('amounts say money in or out with the sign, not only with the colour', () => {
    const el: HTMLElement = host().nativeElement;
    expect(el.querySelector('.a1')?.textContent).toBe('+\u2060€1,234.50');
    expect(el.querySelector('.a1')?.classList).toContain('in');
    expect(el.querySelector('.a2')?.textContent).toBe('−\u2060€56.70');
    expect(el.querySelector('.a3')?.textContent).toBe('-\u2060€56.70');
  });

  it('the big number has its change with arrow, sign, period and share; in Italian too', () => {
    const fixture = host();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-figure .big')?.textContent).toBe('€248,300.00');
    expect(el.querySelector('app-figure .delta')?.textContent?.trim()).toBe('+\u2060€3,420 in 30 giorni (+1.4%)');
    expect(el.querySelector('app-figure .delta app-icon')).toBeTruthy();

    TestBed.inject(I18nService).setLang('it');
    fixture.detectChanges();
    expect(el.querySelector('app-figure .delta')?.textContent?.trim().replace(/\s/g, ' ')).toBe('+\u20603420 € in 30 giorni (+1,4%)');
  });

  it('waiting shows a skeleton at once, an error has Retry, empty has the action that fills it', () => {
    const fixture = host();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-load-state [role=status]')).toBeTruthy();

    fixture.componentInstance.state.set('error');
    fixture.detectChanges();
    (el.querySelector('app-load-state [role=alert] button') as HTMLButtonElement).click();
    expect(fixture.componentInstance.retries).toBe(1);

    fixture.componentInstance.state.set('empty');
    fixture.detectChanges();
    expect(el.querySelector('app-load-state')?.textContent).toContain('Nessun conto');
    expect(el.querySelector('app-load-state a')?.getAttribute('href')).toBe('/import');

    fixture.componentInstance.state.set('ready');
    fixture.detectChanges();
    expect(el.querySelector('app-load-state')?.textContent?.trim()).toBe('');
  });

  it('the page header has the way back and the actions', () => {
    const el: HTMLElement = host().nativeElement;
    expect(el.querySelector('app-page-header h1')?.textContent).toBe('Conto corrente');
    expect(el.querySelector('app-page-header .crumb a')?.getAttribute('href')).toBe('/accounts');
    expect(el.querySelector('app-page-header .actions button')).toBeTruthy();
  });

  it('the chart is an image with a description, and the same data as a table, newest first', () => {
    const el: HTMLElement = host().nativeElement;
    expect(el.querySelector('app-chart canvas')?.getAttribute('role')).toBe('img');
    expect(el.querySelector('app-chart canvas')?.getAttribute('aria-label')).toBe('Saldo negli ultimi mesi');
    const head = Array.from(el.querySelectorAll('app-chart thead th')).map(th => th.textContent);
    expect(head).toEqual(['Date', 'Saldo', 'Altro']);
    const rows = Array.from(el.querySelectorAll('app-chart tbody tr')).map(tr =>
      Array.from(tr.children).map(c => c.textContent));
    expect(rows).toEqual([
      ['November 2026', '–', '€3.00'],
      ['October 2026', '€150.50', '€2.00'],
      ['September 2026', '€100.00', '€1.00']
    ]);
    // the legend is not read twice: the table says it
    expect(el.querySelector('app-chart .legend')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('long series are sampled for the table, the last point always in', () => {
    expect(sample(3, 24)).toEqual([2, 1, 0]);
    const picks = sample(181, 24);
    expect(picks.length).toBe(24);
    expect(picks[0]).toBe(180);
    expect(picks.at(-1)).toBe(0);
  });

  it('the origin of a movement is an icon and a word', () => {
    const el: HTMLElement = host().nativeElement;
    expect(el.querySelector('app-source-tag')?.textContent).toContain('bank');
    expect(el.querySelector('app-source-tag app-icon')).toBeTruthy();
  });
});
