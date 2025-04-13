import React from 'react';
import { Schedule } from '@vizora/common';
import { Button } from '@/components/ui/button';
import { 
  EditIcon, 
  TrashIcon, 
  ArchiveIcon,
  CheckIcon,
  ClockIcon,
  CalendarIcon,
  RepeatIcon,
  AlertCircleIcon
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ScheduleDisplayProps {
  schedule: Schedule;
  isActive?: boolean;
  isNext?: boolean;
  showActions?: boolean;
  onEdit?: (schedule: Schedule) => void;
  onDelete?: (scheduleId: string) => void;
  onArchive?: (schedule: Schedule) => void;
  onRestore?: (schedule: Schedule) => void;
  className?: string;
}

export function ScheduleDisplay({
  schedule,
  isActive = false,
  isNext = false,
  showActions = true,
  onEdit,
  onDelete,
  onArchive,
  onRestore,
  className = ''
}: ScheduleDisplayProps) {
  const isArchived = schedule.archived;
  
  const getStatusBadge = () => {
    if (isArchived) {
      return (
        <Badge variant="outline" className="bg-gray-100 text-gray-600">
          <ArchiveIcon className="h-3 w-3 mr-1" />
          Archived
        </Badge>
      );
    }
    if (isActive) {
      return (
        <Badge variant="default" className="bg-green-500">
          <ClockIcon className="h-3 w-3 mr-1" />
          Active Now
        </Badge>
      );
    }
    if (isNext) {
      return (
        <Badge variant="default" className="bg-blue-500">
          <CalendarIcon className="h-3 w-3 mr-1" />
          Up Next
        </Badge>
      );
    }
    return null;
  };
  
  const getRepeatBadge = () => {
    if (schedule.repeat) {
      return (
        <Badge variant="outline" className="bg-gray-50">
          <RepeatIcon className="h-3 w-3 mr-1" />
          {schedule.repeat}
        </Badge>
      );
    }
    return null;
  };
  
  const getPriorityBadge = () => {
    if (schedule.priority) {
      let color = 'bg-gray-100 text-gray-600';
      if (schedule.priority >= 4) color = 'bg-red-100 text-red-600';
      else if (schedule.priority >= 3) color = 'bg-orange-100 text-orange-600';
      else if (schedule.priority >= 2) color = 'bg-yellow-100 text-yellow-600';
      
      return (
        <Badge variant="outline" className={color}>
          <AlertCircleIcon className="h-3 w-3 mr-1" />
          Priority {schedule.priority}
        </Badge>
      );
    }
    return null;
  };
  
  return (
    <div className={cn(
      "border rounded-lg p-4 transition-colors",
      isArchived ? "bg-gray-50 border-gray-200" : 
      isActive ? "bg-green-50 border-green-200" :
      isNext ? "bg-blue-50 border-blue-200" : "bg-white",
      className
    )}>
      <div className="flex flex-col space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className={cn(
              "font-medium",
              isArchived && "text-gray-500"
            )}>
              {schedule.name}
            </h3>
            <p className={cn(
              "text-sm text-gray-500",
              isArchived && "text-gray-400"
            )}>
              {schedule.description}
            </p>
          </div>
          <div className="flex space-x-2">
            {getStatusBadge()}
            {getRepeatBadge()}
            {getPriorityBadge()}
          </div>
        </div>
        
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <div className="flex items-center">
            <CalendarIcon className="h-4 w-4 mr-1" />
            <span>{new Date(schedule.startTime).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center">
            <ClockIcon className="h-4 w-4 mr-1" />
            <span>{new Date(schedule.startTime).toLocaleTimeString()}</span>
          </div>
        </div>
        
        {showActions && (
          <div className="flex justify-end space-x-2">
            {!isArchived && onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(schedule)}
              >
                <EditIcon className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
            {!isArchived && onArchive && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onArchive(schedule)}
              >
                <ArchiveIcon className="h-4 w-4 mr-1" />
                Archive
              </Button>
            )}
            {isArchived && onRestore && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRestore(schedule)}
              >
                <CheckIcon className="h-4 w-4 mr-1" />
                Restore
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(schedule.id)}
              >
                <TrashIcon className="h-4 w-4 mr-1" />
                Delete
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 