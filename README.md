# NAFDAC Dossier Screener - React Version

A React-based application for screening pharmaceutical dossiers against NAFDAC requirements. This is the migrated version from the original Angular implementation.

## Features

- **Dossier Upload**: Upload ZIP files containing pharmaceutical dossier documents
- **Document Tree View**: Navigate through dossier structure with collapsible tree interface
- **Automated Screening**: Run compliance checks against NAFDAC requirements checklist
- **Document Review**: View PDF documents and other files directly in the browser
- **Report Generation**: Generate PDF screening and compliance reports
- **Data Persistence**: Automatically saves uploaded dossiers to localStorage

## Migration Status

✅ **Completed Features:**
- File upload and ZIP parsing
- Document tree navigation
- Screening checklist functionality
- PDF document viewer
- Report generation (PDF)
- Responsive design
- Data persistence
- Error handling

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Navigate to the React project directory:
   ```bash
   cd nafdac-dossier-screener-react
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the development server:
   ```bash
   npm start
   ```

5. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### Building for Production

```bash
npm run build
```

This builds the app for production to the `build` folder.

### Serving Production Build

```bash
npm run serve
```

## Usage

1. **Upload Dossier**: Navigate to the upload page and select a ZIP file containing your dossier
2. **Run Screening**: Go to the screening page and click "Run Checklist" to check compliance
3. **Generate Reports**: After screening, generate PDF reports for documentation
4. **Review Documents**: Use the review page to browse and view individual documents

## Technology Stack

- **React 18** - UI framework
- **React Router** - Navigation
- **JSZip** - ZIP file processing
- **jsPDF** - PDF generation
- **React-PDF** - PDF viewing
- **File-saver** - File download functionality

## Project Structure

```
src/
├── components/          # React components
│   ├── Upload.js       # File upload interface
│   ├── Screening.js    # Compliance checking
│   ├── Review.js       # Document viewer
│   └── DossierTree.js  # Tree navigation
├── hooks/              # Custom React hooks
│   └── useDossier.js   # Dossier state management
├── services/           # Business logic
│   ├── dossierService.js  # File processing
│   └── reportService.js   # PDF generation
├── utils/              # Utilities
│   └── checklist.js    # NAFDAC requirements
└── App.js              # Main application
```

## Migration Notes

This React version maintains full feature parity with the original Angular implementation while providing:
- Improved performance with React's virtual DOM
- Simplified state management with hooks
- Better developer experience
- Modern JavaScript features
- Enhanced error handling

## Contributing

When making changes:
1. Follow React best practices
2. Maintain TypeScript-like prop validation where possible
3. Keep components focused and reusable
4. Update this README if adding new features

## License

This project is proprietary software for NAFDAC dossier screening purposes.