import React, { useState, useEffect, useCallback } from 'react';
import { Schedule, getActiveSchedules, getNextSchedule, filterSchedulesByArchiveStatus, exportSchedules } from '@vizora/common';
import { ScheduleDisplay } from './ScheduleDisplay';
import { Button } from '@/components/ui/Button';
import { 
  PlusIcon, 
  ArchiveIcon, 
  TrashIcon, 
  ArrowUpIcon,
  ArrowDownIcon,
  FilterIcon,
  CheckIcon,
  XIcon,
  DownloadIcon,
  UploadIcon
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScheduleImportModal } from './ScheduleImportModal';

interface ScheduleListProps {
  schedules: Schedule[];
  currentTime?: Date;
  onAddNew?: () => void;
  onEdit?: (schedule: Schedule) => void;
  onDelete?: (scheduleId: string) => void;
  onArchive?: (schedule: Schedule) => void;
  onRestore?: (schedule: Schedule) => void;
  onBulkArchive?: (scheduleIds: string[]) => void;
  onBulkDelete?: (scheduleIds: string[]) => void;
  onBulkPriorityChange?: (scheduleIds: string[], priority: number) => void;
  showAddButton?: boolean;
  className?: string;
  emptyMessage?: string;
  displayId: string;
}

export function ScheduleList({
  schedules,
  currentTime = new Date(),
  onAddNew,
  onEdit,
  onDelete,
  onArchive,
  onRestore,
  onBulkArchive,
  onBulkDelete,
  onBulkPriorityChange,
  showAddButton = true,
  className = '',
  emptyMessage = 'No schedules found',
  displayId
}: ScheduleListProps) {
  const { toast } = useToast();
  const [selectedSchedules, setSelectedSchedules] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPriorityConfirm, setShowPriorityConfirm] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Load saved state from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('scheduleViewMode');
    if (savedViewMode) {
      setViewMode(savedViewMode as 'active' | 'archived');
    }
  }, []);
  
  // Save state to localStorage
  useEffect(() => {
    localStorage.setItem('scheduleViewMode', viewMode);
  }, [viewMode]);
  
  // Filter schedules based on view mode
  const filteredSchedules = filterSchedulesByArchiveStatus(
    schedules,
    viewMode === 'archived'
  );
  
  // Get active and next schedules
  const activeSchedules = getActiveSchedules(filteredSchedules, currentTime);
  const nextSchedule = getNextSchedule(filteredSchedules, currentTime);
  
  // Handle schedule selection
  const handleScheduleSelect = (scheduleId: string) => {
    setSelectedSchedules(prev => 
      prev.includes(scheduleId)
        ? prev.filter(id => id !== scheduleId)
        : [...prev, scheduleId]
    );
  };
  
  // Handle select all in a group
  const handleSelectAll = (groupSchedules: Schedule[]) => {
    const groupIds = groupSchedules.map(s => s.id);
    const allSelected = groupIds.every(id => selectedSchedules.includes(id));
    
    if (allSelected) {
      setSelectedSchedules(prev => prev.filter(id => !groupIds.includes(id)));
    } else {
      setSelectedSchedules(prev => [...new Set([...prev, ...groupIds])]);
    }
  };
  
  // Handle bulk archive
  const handleBulkArchive = () => {
    if (selectedSchedules.length === 0) {
      toast({
        title: 'No schedules selected',
        description: 'Please select at least one schedule to archive',
        variant: 'destructive'
      });
      return;
    }
    setShowArchiveConfirm(true);
  };
  
  const confirmBulkArchive = () => {
    onBulkArchive?.(selectedSchedules);
    setSelectedSchedules([]);
    setShowArchiveConfirm(false);
    toast({
      title: 'Schedules Archived',
      description: `${selectedSchedules.length} schedule(s) have been archived`,
    });
  };
  
  // Handle bulk delete
  const handleBulkDelete = () => {
    if (selectedSchedules.length === 0) {
      toast({
        title: 'No schedules selected',
        description: 'Please select at least one schedule to delete',
        variant: 'destructive'
      });
      return;
    }
    setShowDeleteConfirm(true);
  };
  
  const confirmBulkDelete = () => {
    onBulkDelete?.(selectedSchedules);
    setSelectedSchedules([]);
    setShowDeleteConfirm(false);
    toast({
      title: 'Schedules Deleted',
      description: `${selectedSchedules.length} schedule(s) have been deleted`,
    });
  };
  
  // Handle bulk priority change
  const handleBulkPriorityChange = (priority: string) => {
    if (selectedSchedules.length === 0) {
      toast({
        title: 'No schedules selected',
        description: 'Please select at least one schedule to change priority',
        variant: 'destructive'
      });
      return;
    }
    setSelectedPriority(priority);
    setShowPriorityConfirm(true);
  };
  
  const confirmBulkPriorityChange = () => {
    onBulkPriorityChange?.(selectedSchedules, parseInt(selectedPriority, 10));
    setSelectedSchedules([]);
    setShowPriorityConfirm(false);
    toast({
      title: 'Priority Updated',
      description: `Priority updated for ${selectedSchedules.length} schedule(s)`,
    });
  };
  
  // Group schedules by status
  const sortedSchedules = React.useMemo(() => {
    // Get IDs for active and next schedules
    const activeIds = activeSchedules.map(s => s.id);
    const nextId = nextSchedule?.id;
    
    // Create groups
    const active: Schedule[] = [];
    const upcoming: Schedule[] = [];
    const past: Schedule[] = [];
    const inactive: Schedule[] = [];
    
    // Sort schedules
    filteredSchedules.forEach(schedule => {
      // Skip if already in active group
      if (activeIds.includes(schedule.id)) {
        active.push(schedule);
        return;
      }
      
      // Skip if already in next group (handle separately)
      if (nextId && schedule.id === nextId) {
        return;
      }
      
      if (!schedule.active) {
        inactive.push(schedule);
        return;
      }
      
      const startDate = new Date(schedule.startTime);
      const endDate = schedule.endTime ? new Date(schedule.endTime) : null;
      
      if (startDate > currentTime) {
        upcoming.push(schedule);
      } else if (endDate && endDate < currentTime) {
        past.push(schedule);
      } else {
        // This shouldn't happen if getActiveSchedules works correctly
        // but keeping as a safety measure
        upcoming.push(schedule);
      }
    });
    
    // Sort active by priority descending
    active.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    // Sort upcoming by start time
    upcoming.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    
    // Sort past by end time descending
    past.sort((a, b) => {
      const aEndTime = a.endTime ? new Date(a.endTime).getTime() : 0;
      const bEndTime = b.endTime ? new Date(b.endTime).getTime() : 0;
      return bEndTime - aEndTime;
    });
    
    // Sort inactive alphabetically
    inactive.sort((a, b) => a.name.localeCompare(b.name));
    
    return { active, next: nextSchedule, upcoming, past, inactive };
  }, [filteredSchedules, activeSchedules, nextSchedule, currentTime]);
  
  // Handle export
  const handleExport = (type: 'selected' | 'all') => {
    try {
      const schedulesToExport = type === 'selected' 
        ? schedules.filter(s => selectedSchedules.includes(s.id))
        : filteredSchedules;

      if (schedulesToExport.length === 0) {
        toast({
          title: 'No schedules to export',
          description: type === 'selected' 
            ? 'Please select at least one schedule to export'
            : 'There are no schedules in the current view',
          variant: 'destructive'
        });
        return;
      }

      const filename = `schedules-${type}-${new Date().toISOString().split('T')[0]}.vizora.json`;
      exportSchedules(schedulesToExport, filename);

      toast({
        title: 'Export Successful',
        description: `Exported ${schedulesToExport.length} schedule(s)`,
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: 'Export Failed',
        description: 'An error occurred while exporting schedules',
        variant: 'destructive'
      });
    }
  };
  
  const handleImport = useCallback((importedSchedules: Schedule[]) => {
    // Add "Imported" tag to description
    const taggedSchedules = importedSchedules.map(schedule => ({
      ...schedule,
      description: schedule.description 
        ? `${schedule.description}\n\nImported on ${new Date().toLocaleDateString()}`
        : `Imported on ${new Date().toLocaleDateString()}`
    }));

    // TODO: Implement actual import logic
    console.log('Importing schedules:', taggedSchedules);
    
    toast({
      title: 'Import Successful',
      description: `Successfully imported ${taggedSchedules.length} schedule(s)`,
    });
  }, [toast]);
  
  return (
    <div className={`space-y-6 ${className}`}>
      {/* View Mode Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'active' | 'archived')}>
        <TabsList>
          <TabsTrigger value="active">Active Schedules</TabsTrigger>
          <TabsTrigger value="archived">Archived Schedules</TabsTrigger>
        </TabsList>
      </Tabs>
      
      {/* Bulk Actions Bar */}
      {selectedSchedules.length > 0 && (
        <div className="bg-white p-4 rounded-lg border flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {selectedSchedules.length} selected
            </span>
            {viewMode === 'active' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkArchive}
                disabled={!onBulkArchive}
              >
                <ArchiveIcon className="h-4 w-4 mr-2" />
                Archive Selected
              </Button>
            )}
            {viewMode === 'archived' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkRestore}
                disabled={!onBulkRestore}
              >
                <CheckIcon className="h-4 w-4 mr-2" />
                Restore Selected
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkDelete}
              disabled={!onBulkDelete}
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>
            {viewMode === 'active' && (
              <Select
                onValueChange={handleBulkPriorityChange}
                disabled={!onBulkPriorityChange}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Set Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Low (1)</SelectItem>
                  <SelectItem value="2">Medium (2)</SelectItem>
                  <SelectItem value="3">High (3)</SelectItem>
                  <SelectItem value="4">Critical (4)</SelectItem>
                  <SelectItem value="5">Urgent (5)</SelectItem>
                </SelectContent>
              </Select>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleExport('selected')}>
                  Export Selected ({selectedSchedules.length})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('all')}>
                  Export All in View ({filteredSchedules.length})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedSchedules([])}
          >
            Clear Selection
          </Button>
        </div>
      )}
      
      {/* Add Button and Export/Import */}
      <div className="flex justify-between items-center">
        {viewMode === 'active' && showAddButton && onAddNew && (
          <Button onClick={onAddNew} size="sm">
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Schedule
          </Button>
        )}
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImportModal(true)}
          >
            <UploadIcon className="h-4 w-4 mr-2" />
            Import
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <DownloadIcon className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('all')}>
                Export All in View ({filteredSchedules.length})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Schedule Groups */}
      {Object.entries(sortedSchedules).map(([group, groupSchedules]) => (
        groupSchedules.length > 0 && (
          <div key={group} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm uppercase text-muted-foreground">
                {group === 'active' ? 'Active Now' :
                 group === 'next' ? 'Up Next' :
                 group === 'upcoming' ? 'Upcoming' :
                 group === 'past' ? 'Past' :
                 group === 'inactive' ? 'Inactive' : group}
              </h3>
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={groupSchedules.every(s => selectedSchedules.includes(s.id))}
                  onCheckedChange={() => handleSelectAll(groupSchedules)}
                  className="h-4 w-4"
                />
                <span className="text-xs text-muted-foreground">Select All</span>
              </div>
            </div>
            <div className="space-y-3">
              {groupSchedules.map(schedule => (
                <div key={schedule.id} className="flex items-start space-x-4">
                  <Checkbox
                    checked={selectedSchedules.includes(schedule.id)}
                    onCheckedChange={() => handleScheduleSelect(schedule.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <ScheduleDisplay
                      schedule={schedule}
                      isActive={group === 'active'}
                      isNext={group === 'next'}
                      showActions={true}
                      onEdit={viewMode === 'active' ? onEdit : undefined}
                      onDelete={onDelete}
                      onArchive={viewMode === 'active' ? onArchive : undefined}
                      onRestore={viewMode === 'archived' ? onRestore : undefined}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ))}
      
      {/* Empty State */}
      {filteredSchedules.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>{emptyMessage}</p>
          {viewMode === 'active' && showAddButton && onAddNew && (
            <Button onClick={onAddNew} variant="outline" className="mt-4">
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Your First Schedule
            </Button>
          )}
        </div>
      )}
      
      {/* Confirmation Modals */}
      <Dialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Schedules</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive {selectedSchedules.length} schedule(s)? 
              Archived schedules can be restored later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowArchiveConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={confirmBulkArchive}>
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Schedules</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete {selectedSchedules.length} schedule(s)? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmBulkDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showPriorityConfirm} onOpenChange={setShowPriorityConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Priority</DialogTitle>
            <DialogDescription>
              Are you sure you want to change the priority of {selectedSchedules.length} schedule(s) to {selectedPriority}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPriorityConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={confirmBulkPriorityChange}>
              Update Priority
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <ScheduleImportModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onImport={handleImport}
        existingSchedules={schedules}
        displayId={displayId}
      />
    </div>
  );
} 