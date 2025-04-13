import React, { useState, useEffect } from 'react';
import { 
  Schedule, 
  RepeatMode, 
  DaysOfWeek,
  MonthlyRepeatOptions,
  ScheduleValidationResult
} from '@vizora/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon, AlertTriangle } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { format } from 'date-fns';

interface ScheduleEditorProps {
  schedule?: Schedule;
  existingSchedules?: Schedule[];
  onSave: (schedule: Schedule) => void;
  onCancel?: () => void;
  onValidationError?: (result: ScheduleValidationResult) => void;
}

export function ScheduleEditor({
  schedule,
  existingSchedules = [],
  onSave,
  onCancel,
  onValidationError
}: ScheduleEditorProps) {
  const { toast } = useToast();
  const isNewSchedule = !schedule?.id;
  
  // Default values for a new schedule
  const defaultSchedule: Schedule = {
    id: schedule?.id || `schedule-${Date.now()}`,
    name: schedule?.name || '',
    startTime: schedule?.startTime || new Date().toISOString(),
    endTime: schedule?.endTime || new Date(Date.now() + 3600000).toISOString(), // 1 hour later
    repeat: schedule?.repeat || 'none',
    priority: schedule?.priority || 1,
    active: schedule?.active !== undefined ? schedule.active : true,
    metadata: schedule?.metadata || {}
  };
  
  const [formValues, setFormValues] = useState<Schedule>(defaultSchedule);
  const [startDate, setStartDate] = useState<Date>(new Date(defaultSchedule.startTime));
  const [endDate, setEndDate] = useState<Date>(
    defaultSchedule.endTime ? new Date(defaultSchedule.endTime) : new Date(Date.now() + 3600000)
  );
  const [startTime, setStartTime] = useState<string>(
    format(new Date(defaultSchedule.startTime), 'HH:mm')
  );
  const [endTime, setEndTime] = useState<string>(
    format(defaultSchedule.endTime ? new Date(defaultSchedule.endTime) : new Date(Date.now() + 3600000), 'HH:mm')
  );
  const [repeatType, setRepeatType] = useState<RepeatMode>(defaultSchedule.repeat || 'none');
  const [selectedDays, setSelectedDays] = useState<DaysOfWeek[]>(
    (defaultSchedule.metadata?.weeklyDays as DaysOfWeek[]) || []
  );
  const [monthlyOption, setMonthlyOption] = useState<MonthlyRepeatOptions>(
    (defaultSchedule.metadata?.monthlyOption as MonthlyRepeatOptions) || 'dayOfMonth'
  );
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [overlappingSchedules, setOverlappingSchedules] = useState<Schedule[]>([]);
  
  // Update dates when time fields change
  useEffect(() => {
    const newStartDate = new Date(startDate);
    const [hours, minutes] = startTime.split(':').map(n => parseInt(n, 10));
    newStartDate.setHours(hours, minutes, 0, 0);
    
    const newEndDate = new Date(endDate);
    const [endHours, endMinutes] = endTime.split(':').map(n => parseInt(n, 10));
    newEndDate.setHours(endHours, endMinutes, 0, 0);
    
    setFormValues(prev => ({
      ...prev,
      startTime: newStartDate.toISOString(),
      endTime: newEndDate.toISOString()
    }));
  }, [startDate, endDate, startTime, endTime]);
  
  // Update form values when repeat type changes
  useEffect(() => {
    setFormValues(prev => ({
      ...prev,
      repeat: repeatType,
      metadata: {
        ...prev.metadata,
        weeklyDays: repeatType === 'weekly' ? selectedDays : undefined,
        monthlyOption: repeatType === 'monthly' ? monthlyOption : undefined
      }
    }));
  }, [repeatType, selectedDays, monthlyOption]);
  
  // Validate the schedule
  const validateSchedule = (): ScheduleValidationResult => {
    const result: ScheduleValidationResult = {
      valid: true,
      errors: [],
      overlaps: []
    };
    
    // Check for name
    if (!formValues.name.trim()) {
      result.valid = false;
      result.errors?.push('Schedule name is required');
    }
    
    // Check for valid dates
    const start = new Date(formValues.startTime);
    const end = new Date(formValues.endTime);
    
    if (isNaN(start.getTime())) {
      result.valid = false;
      result.errors?.push('Start time is invalid');
    }
    
    if (isNaN(end.getTime())) {
      result.valid = false;
      result.errors?.push('End time is invalid');
    }
    
    if (start >= end) {
      result.valid = false;
      result.errors?.push('End time must be after start time');
    }
    
    // Check for weekly selection
    if (repeatType === 'weekly' && (!selectedDays || selectedDays.length === 0)) {
      result.valid = false;
      result.errors?.push('Please select at least one day of the week');
    }
    
    // Check for overlapping schedules
    const overlappingSchedules = existingSchedules.filter(existing => {
      if (existing.id === formValues.id) return false;
      if (!existing.active) return false;
      
      const existingStart = new Date(existing.startTime);
      const existingEnd = existing.endTime ? new Date(existing.endTime) : null;
      
      // Check for overlap based on repeat type
      if (repeatType === 'none' && existing.repeat === 'none') {
        return (start < existingEnd && end > existingStart);
      }
      
      // Handle other repeat type combinations
      // This is a simplified check - you might want to implement more sophisticated overlap detection
      return (start < existingEnd && end > existingStart);
    });
    
    if (overlappingSchedules.length > 0) {
      result.overlaps = overlappingSchedules;
      result.valid = false;
      result.errors?.push('This schedule conflicts with existing schedules');
    }
    
    return result;
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationResult = validateSchedule();
    
    if (!validationResult.valid) {
      setValidationErrors(validationResult.errors || []);
      setOverlappingSchedules(validationResult.overlaps || []);
      
      if (onValidationError) {
        onValidationError(validationResult);
      }
      
      // Show toast for errors
      if (validationResult.errors && validationResult.errors.length > 0) {
        toast({
          title: 'Validation Error',
          description: validationResult.errors[0],
          variant: 'destructive'
        });
      } else if (validationResult.overlaps && validationResult.overlaps.length > 0) {
        toast({
          title: 'Schedule Conflict',
          description: `This schedule conflicts with ${validationResult.overlaps.length} existing schedule(s)`,
          variant: 'destructive'
        });
      }
      
      return;
    }
    
    // Clear any previous errors
    setValidationErrors([]);
    setOverlappingSchedules([]);
    
    // Call the onSave callback
    onSave(formValues);
  };
  
  // Day of week options
  const daysOfWeek: { value: DaysOfWeek; label: string }[] = [
    { value: 'sunday', label: 'Sunday' },
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' }
  ];
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">
          {isNewSchedule ? 'Create Schedule' : 'Edit Schedule'}
        </h2>
      </div>

      {validationErrors.length > 0 && (
        <div className="bg-destructive/20 text-destructive p-3 rounded-md">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            <span>Please fix the following errors:</span>
          </div>
          <ul className="list-disc list-inside mt-2 text-sm">
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {overlappingSchedules.length > 0 && (
        <div className="bg-amber-100 text-amber-800 p-3 rounded-md">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            <span>Schedule Conflicts Detected:</span>
          </div>
          <div className="mt-2 space-y-2">
            {overlappingSchedules.map((schedule) => (
              <div key={schedule.id} className="text-sm">
                <div className="font-medium">{schedule.name}</div>
                <div className="text-amber-700">
                  {format(new Date(schedule.startTime), 'MMM d, yyyy h:mm a')} - 
                  {format(new Date(schedule.endTime), 'MMM d, yyyy h:mm a')}
                </div>
                {schedule.priority && (
                  <div className="text-amber-700">
                    Priority: {schedule.priority}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 text-sm">
            <p>You can still save this schedule, but it may not display as expected due to these conflicts.</p>
            <p>Consider adjusting the time or priority to resolve the conflicts.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name">Schedule Name</Label>
            <Input
              id="name"
              placeholder="Enter schedule name"
              value={formValues.name}
              onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
              required
            />
          </div>

          {/* Date Range Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Start Date/Time */}
            <div className="space-y-2">
              <Label>Start Date</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(startDate, 'PPP')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => date && setStartDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="w-24">
                  <div className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2">
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-transparent focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* End Date/Time */}
            <div className="space-y-2">
              <Label>End Date</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(endDate, 'PPP')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => date && setEndDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="w-24">
                  <div className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2">
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full bg-transparent focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recurrence Options */}
          <div className="space-y-3">
            <Label>Repeat</Label>
            <RadioGroup
              value={repeatType}
              onValueChange={(value) => setRepeatType(value as RepeatMode)}
              className="flex flex-col space-y-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="none" id="r-none" />
                <Label htmlFor="r-none">Don't repeat</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="daily" id="r-daily" />
                <Label htmlFor="r-daily">Daily</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="weekly" id="r-weekly" />
                <Label htmlFor="r-weekly">Weekly</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="monthly" id="r-monthly" />
                <Label htmlFor="r-monthly">Monthly</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Weekly Options */}
          {repeatType === 'weekly' && (
            <div className="ml-6 space-y-3 border-l-2 border-muted pl-4 pt-2">
              <Label>Repeat on</Label>
              <div className="flex flex-wrap gap-2">
                {daysOfWeek.map((day) => (
                  <div key={day.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`day-${day.value}`}
                      checked={selectedDays.includes(day.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedDays([...selectedDays, day.value]);
                        } else {
                          setSelectedDays(selectedDays.filter((d) => d !== day.value));
                        }
                      }}
                    />
                    <Label htmlFor={`day-${day.value}`}>{day.label}</Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly Options */}
          {repeatType === 'monthly' && (
            <div className="ml-6 space-y-3 border-l-2 border-muted pl-4 pt-2">
              <Label>Monthly repeat options</Label>
              <RadioGroup
                value={monthlyOption}
                onValueChange={(value) => setMonthlyOption(value as MonthlyRepeatOptions)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="dayOfMonth" id="monthly-day" />
                  <Label htmlFor="monthly-day">Same day each month</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="dayOfWeek" id="monthly-week" />
                  <Label htmlFor="monthly-week">Same week day each month</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Priority Field */}
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={formValues.priority?.toString() || "1"}
              onValueChange={(value) => 
                setFormValues({ ...formValues, priority: parseInt(value, 10) })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Low (1)</SelectItem>
                <SelectItem value="2">Medium (2)</SelectItem>
                <SelectItem value="3">High (3)</SelectItem>
                <SelectItem value="4">Critical (4)</SelectItem>
                <SelectItem value="5">Urgent (5)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Higher priority schedules take precedence when multiple schedules are active
            </p>
          </div>

          {/* Active Switch */}
          <div className="flex items-center space-x-2">
            <Switch
              id="active"
              checked={formValues.active}
              onCheckedChange={(checked) => 
                setFormValues({ ...formValues, active: checked })
              }
            />
            <Label htmlFor="active">Schedule is active</Label>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end space-x-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit">
            {isNewSchedule ? 'Create Schedule' : 'Update Schedule'}
          </Button>
        </div>
      </form>
    </div>
  );
} 