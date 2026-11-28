import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { applyTheme, storedTheme } from './app/theme/theme.service';

// the saved theme before the first frame (the CSP allows no inline script in index.html)
applyTheme(storedTheme());

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
