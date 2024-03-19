import {Component} from '@angular/core';
import {LineGraphComponent} from "./line-graph/line-graph.component";
import {TransactionsTableComponent} from "./transactions-table/transactions-table.component";
import {RouterOutlet} from "@angular/router";
import {NgIf} from "@angular/common";
import {MainComponentComponent} from "./main-component/main-component.component";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: true,
  imports: [
    LineGraphComponent,
    TransactionsTableComponent,
    RouterOutlet,
    NgIf,
    MainComponentComponent
  ],
  styleUrls: ['./app.component.css']
})
export class AppComponent {

}
