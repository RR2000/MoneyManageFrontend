import {Component} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {Chart} from "chart.js";
import {LineGraphComponent} from "./line-graph/line-graph.component";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LineGraphComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'MoneyManageFrontend';

  // Function to draw the line graph
  drawLineGraph() {
    const ctx = document.getElementById('line-chart') as HTMLCanvasElement;
    if (ctx) {
      const lineChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
          datasets: [{
            label: 'My Dataset',
            data: [65, 59, 80, 81, 56, 55, 40],
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 1,
            fill: false
          }]
        },
        options: {
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    }
  }

  // Call the drawLineGraph function when the component initializes
  ngOnInit() {
    this.drawLineGraph();
  }
}
