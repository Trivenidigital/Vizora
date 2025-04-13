import { Schedule } from '../types/schedule';
import { validateSchedule } from './scheduleUtils';

/**
 * Validates an array of schedules against each other for conflicts
 * @param schedules Array of schedules to validate
 * @returns Object containing validation results for each schedule
 */
export function validateSchedules(
  schedules: Schedule[]
): { 
  valid: boolean; 
  validSchedules: Schedule[]; 
  invalidSchedules: Schedule[];
  validationResults: Record<string, { valid: boolean; errors: string[] }>;
} {
  const result = {
    valid: true,
    validSchedules: [] as Schedule[],
    invalidSchedules: [] as Schedule[],
    validationResults: {} as Record<string, { valid: boolean; errors: string[] }>
  };

  // Validate each schedule against all others
  schedules.forEach((schedule, index) => {
    // Skip validating against itself
    const otherSchedules = schedules.filter((_, i) => i !== index);
    
    // Validate the schedule
    const validation = validateSchedule(schedule, otherSchedules);
    const id = (schedule as any).id || `schedule-${index}`;
    
    result.validationResults[id] = {
      valid: validation.valid,
      errors: validation.errors || []
    };
    
    if (validation.valid) {
      result.validSchedules.push(schedule);
    } else {
      result.invalidSchedules.push(schedule);
      result.valid = false;
    }
  });

  return result;
}

/**
 * Filters schedules by their archive status
 * @param schedules Array of schedules to filter
 * @param includedStatuses Array of statuses to include in the result
 * @returns Filtered array of schedules
 */
export function filterSchedulesByArchiveStatus(
  schedules: Schedule[],
  includedStatuses: ('active' | 'archived' | 'expired' | 'all')[] = ['active']
): Schedule[] {
  // If 'all' is included, return all schedules
  if (includedStatuses.includes('all')) {
    return schedules;
  }
  
  const now = new Date();
  
  return schedules.filter(schedule => {
    // Check for archived status
    const isArchived = (schedule as any).archived === true;
    
    // Check for expired status
    const isExpired = schedule.endTime ? new Date(schedule.endTime) < now : false;
    
    // Determine schedule status
    const status = isArchived 
      ? 'archived' 
      : isExpired 
        ? 'expired' 
        : 'active';
    
    return includedStatuses.includes(status);
  });
}

/**
 * Exports schedules to a JSON file that can be downloaded
 * @param schedules Array of schedules to export
 * @param filename Optional filename for the export (defaults to 'schedules.json')
 * @returns Promise that resolves when the export is complete
 */
export function exportSchedules(
  schedules: Schedule[],
  filename: string = 'schedules.json'
): Promise<void> {
  return new Promise((resolve) => {
    // Prepare data for export
    const exportData = {
      schedules,
      exportDate: new Date().toISOString(),
      metadata: {
        count: schedules.length,
        version: '1.0'
      }
    };
    
    // Convert to JSON string
    const jsonString = JSON.stringify(exportData, null, 2);
    
    // Create blob for download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create download link and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve();
    }, 100);
  });
} 