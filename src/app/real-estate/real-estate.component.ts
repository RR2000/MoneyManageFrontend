import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {MatTableModule} from '@angular/material/table';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatIconModule} from '@angular/material/icon';
import {RealEstateDto} from '../../models/real-estate.dto';

const API = 'http://localhost:8080/api/realestate';

@Component({
  selector: 'app-real-estate',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule
  ],
  templateUrl: './real-estate.component.html',
  styleUrl: './real-estate.component.css'
})
export class RealEstateComponent implements OnInit {
  properties: RealEstateDto[] = [];
  totalWorth: number = 0;
  displayedColumns = ['name', 'address', 'purchaseDate', 'purchasePrice', 'currentEstimatedValue', 'monthlyRent', 'monthlyExpenses', 'currency', 'actions'];

  showForm = false;
  editingId: number | null = null;
  form: RealEstateDto = this.emptyForm();

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.http.get<RealEstateDto[]>(API).subscribe(data => this.properties = data);
    this.http.get<number>(`${API}/worth`).subscribe(w => this.totalWorth = w);
  }

  openCreate() {
    this.editingId = null;
    this.form = this.emptyForm();
    this.showForm = true;
  }

  openEdit(p: RealEstateDto) {
    this.editingId = p.id ?? null;
    this.form = {...p};
    this.showForm = true;
  }

  save() {
    if (this.editingId != null) {
      this.http.put<RealEstateDto>(`${API}/${this.editingId}`, this.form).subscribe(() => {
        this.showForm = false;
        this.load();
      });
    } else {
      this.http.post<RealEstateDto>(API, this.form).subscribe(() => {
        this.showForm = false;
        this.load();
      });
    }
  }

  delete(id: number | undefined) {
    if (id == null) return;
    this.http.delete(`${API}/${id}`).subscribe(() => this.load());
  }

  cancel() {
    this.showForm = false;
  }

  private emptyForm(): RealEstateDto {
    return {name: '', address: '', purchaseDate: '', purchasePrice: 0, currentEstimatedValue: 0, monthlyRent: 0, monthlyExpenses: 0, currency: 'EUR'};
  }
}
