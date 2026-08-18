# Global Time & Meeting Scheduler

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![PWA](https://img.shields.io/badge/PWA-Enabled-green)](https://web.dev/progressive-web-apps/)

A powerful, privacy-first **Progressive Web App (PWA)** for coordinating meetings across time zones. Features real-time world clocks, intelligent business hour overlap detection, calendar integration, and collaborative notes—all running locally in your browser.

<img width="1681" height="1949" alt="gtms" src="https://github.com/user-attachments/assets/5f578c11-6bc5-45a1-b8b5-fc75be9e24e6" />

## Features

### Real-Time World Clocks
- **300+ cities** across all continents
- Live updates with second-by-second precision
- 12-hour / 24-hour format toggle
- Automatic Daylight Saving Time (DST) adjustments
- Customizable city selection with search & filter

### Smart Meeting Scheduler
- **Overlap Calculator**: Find the best meeting times for 9 AM - 5 PM business hours
- **Partial Overlap Detection**: Shows closest available window when full 9-5 overlap isn't possible (7 AM - 7 PM extended range)
- Visual timeline with color-coded overlap indicators (green = full, amber = partial)
- One-click calendar integration:
  - Google Calendar
  - Microsoft Outlook
  - Apple iCal (.ics download)
  - Email invite generator
- Recurring meeting support (Daily, Weekly, Bi-weekly, Monthly)
- QR code sharing with client-side generation (no external service dependency)

### Collaborative Notes
- Multi-tab note-taking system
- Rich text formatting (bold, italic, lists)
- Auto-save to browser localStorage
- Export notes as .txt files
- **XSS protection**: All note content is sanitized before rendering

### User Experience
- **Dark & Light themes** with smooth transitions
- **Progressive Web App (PWA)** - install on desktop & mobile
- **Offline support** - works without internet after first load
- **Responsive design** - works on all screen sizes
- **Privacy-first** - no analytics, no tracking, no servers
- **SEO optimized** - meta descriptions, Open Graph, and Twitter Card tags

### Accessibility
- ARIA labels on all interactive elements
- Keyboard navigation for city selector, tabs, and modals
- Proper `<label>` associations for form controls
- `aria-live` regions for dynamic content updates
- Escape key closes modals and city selector

## Live Demo
[Click here to try it live](https://vojislav77.github.io/global-time-meeting-scheduler/)

## Project Structure

```
global-time-meeting-scheduler/
  index.html        # Main HTML structure
  styles.css        # All CSS styles
  app.js            # Application logic
  cities.js         # City/timezone data (200+ cities)
  service-worker.js # PWA offline caching
  manifest.json     # PWA manifest
  logo.png          # App logo
  icons/            # PWA icons (192x192, 512x512)
  terms.html        # Terms of service
  privacy.html      # Privacy policy
```

## Installation

### Option 1: Run Locally
1. **Clone the repository**
   ```bash
   git clone https://github.com/vojislav77/global-time-meeting-scheduler.git
   cd global-time-meeting-scheduler
   ```
2. **Open in browser**
   - Simply open `index.html` in any modern browser
   - No build step or server required

### Option 2: Deploy to GitHub Pages
1. Push to your GitHub repository
2. Go to **Settings > Pages**
3. Set source to **Deploy from branch** > `main`
4. Your app will be live at `https://yourusername.github.io/global-time-meeting-scheduler/`

## How It Works

1. **World Clocks**: Select cities from the hub list. Clocks update every second with automatic DST handling.
2. **Meeting Scheduler**: Pick two cities, set duration and recurrence, then hit Calculate. The tool finds overlapping business hours and generates calendar invites.
3. **Notes**: Use the tabbed notepad to jot down meeting details. Everything auto-saves to your browser's localStorage.

## Browser Support

Works on all modern browsers:
- Chrome / Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome for Android)

## Privacy

- **Zero data collection** - no analytics, no tracking, no cookies
- **100% client-side** - all processing happens in your browser
- **No server** - nothing is ever sent anywhere
- **Offline capable** - works without internet after first load

## License

[MIT License](LICENSE) - free to use, modify, and distribute.

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## Support

If this tool saves you time, consider supporting the project:
- [Ko-fi](https://ko-fi.com/yourusername)
- [Buy Me a Coffee](https://www.buymeacoffee.com/yourusername)
- [GitHub Sponsors](https://github.com/sponsors/yourusername)

---

Built with care for remote teams, digital nomads, and anyone working across time zones.
