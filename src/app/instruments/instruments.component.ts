import {Component, EventEmitter, OnInit, Output, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {DecimalPipe} from '@angular/common';

/** One investment: where its prices come from (GET /api/instruments). */
export interface Instrument {
  isin: string;
  name: string;
  symbol: string | null;
  manual: boolean;
  /** alphavantage, yahoo, csv or nessuna */
  source: string;
  quoteCurrency: string | null;
  investmentCurrency: string;
  currencyWarning: boolean;
  lastPrice: number | null;
  lastDate: string | null;
  prices: number;
}

export interface InstrumentsAnswer {
  instruments: Instrument[];
  alphaVantage: boolean;
  alphaVantageLeftToday: number;
}

export interface SymbolPreview {
  symbol: string;
  name: string;
  currency: string | null;
  currencyWarning: boolean;
  lastPrice: number;
  lastDate: string;
  weeks: number;
}

const SOURCES: { [key: string]: string } = {
  alphavantage: 'Alpha Vantage', yahoo: 'Yahoo', csv: 'file CSV', nessuna: 'nessun prezzo'
};

/**
 * The investments page: for every ISIN its prices' source, symbol and currency (flagged when it is not the one of the
 * investments: never converted), with the symbol to correct by hand after a preview, and a CSV of prices to import.
 */
@Component({
  selector: 'app-instruments',
  imports: [FormsModule, DecimalPipe],
  templateUrl: './instruments.component.html',
  styleUrl: './instruments.component.css'
})
export class InstrumentsComponent implements OnInit {
  /** the prices changed: the graph should be read again */
  @Output() changed = new EventEmitter<void>();

  answer = signal<InstrumentsAnswer | null>(null);
  loading = signal(true);
  error = signal('');
  /** ISIN being edited, with its symbol and preview */
  editing = signal('');
  symbol = '';
  preview = signal<SymbolPreview | null>(null);
  busy = signal(false);
  /** outcome of the last action, shown under its ISIN */
  message = signal<{ isin: string, text: string, error: boolean } | null>(null);

  constructor(private http: HttpClient) {
  }

  ngOnInit(): void {
    this.load();
  }

  source(i: Instrument): string {
    return SOURCES[i.source] ?? i.source;
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.http.get<InstrumentsAnswer>('/api/instruments').subscribe({
      next: a => {
        this.answer.set(a);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Non sono riuscito a caricare gli investimenti.');
      }
    });
  }

  edit(i: Instrument): void {
    this.editing.set(i.isin);
    this.symbol = i.symbol ?? '';
    this.preview.set(null);
    this.message.set(null);
  }

  cancel(): void {
    this.editing.set('');
    this.preview.set(null);
  }

  showPreview(isin: string): void {
    this.busy.set(true);
    this.preview.set(null);
    this.message.set(null);
    this.http.get<SymbolPreview>('/api/instruments/preview', {params: {symbol: this.symbol.trim()}}).subscribe({
      next: p => {
        this.busy.set(false);
        this.preview.set(p);
      },
      error: (err: HttpErrorResponse) => this.failed(isin, err)
    });
  }

  /** Empty symbol: back to the automatic one. */
  save(isin: string): void {
    this.busy.set(true);
    this.http.put<Instrument>(`/api/instruments/${encodeURIComponent(isin)}/symbol`, {symbol: this.symbol.trim()}).subscribe({
      next: updated => {
        this.busy.set(false);
        this.replace(updated);
        this.cancel();
        this.message.set({
          isin, error: false,
          text: updated.symbol ? `Simbolo ${updated.symbol} salvato.` : 'Si torna al simbolo trovato in automatico.'
        });
        this.changed.emit();
      },
      error: (err: HttpErrorResponse) => this.failed(isin, err)
    });
  }

  importCsv(isin: string, input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.busy.set(true);
    this.message.set(null);
    file.text().then(text => {
      this.http.post<{ imported: number }>(`/api/instruments/${encodeURIComponent(isin)}/prices`, text,
        {headers: {'Content-Type': 'text/csv'}}).subscribe({
        next: r => {
          this.busy.set(false);
          input.value = '';
          this.message.set({isin, text: `${r.imported} prezzi importati.`, error: false});
          this.load();
          this.changed.emit();
        },
        error: (err: HttpErrorResponse) => {
          input.value = '';
          this.failed(isin, err);
        }
      });
    });
  }

  private replace(updated: Instrument): void {
    const a = this.answer();
    if (a) {
      this.answer.set({...a, instruments: a.instruments.map(i => i.isin === updated.isin ? updated : i)});
    }
  }

  private failed(isin: string, err: HttpErrorResponse): void {
    this.busy.set(false);
    const text = err.status === 0 ? 'Server non raggiungibile, riprova.'
      : (err.error?.message as string | undefined) ?? 'Richiesta non riuscita, riprova.';
    this.message.set({isin, text, error: true});
  }
}
