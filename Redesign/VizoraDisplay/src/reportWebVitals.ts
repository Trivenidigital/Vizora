// import { ReportHandler } from 'web-vitals'; // Old import
import { onCLS, onFID, onFCP, onLCP, onTTFB, Metric } from 'web-vitals'; // Import individual metrics

type ReportHandler = (metric: Metric) => void; // Define type if needed elsewhere

const reportWebVitals = (onPerfEntry?: ReportHandler) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    // Use individual functions
    onCLS(onPerfEntry);
    onFID(onPerfEntry);
    onFCP(onPerfEntry);
    onLCP(onPerfEntry);
    onTTFB(onPerfEntry);
    // Remove the dynamic import as it's no longer needed
    // import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
    //   getCLS(onPerfEntry);
    //   getFID(onPerfEntry);
    //   getFCP(onPerfEntry);
    //   getLCP(onPerfEntry);
    //   getTTFB(onPerfEntry);
    // });
  }
};

export default reportWebVitals; 