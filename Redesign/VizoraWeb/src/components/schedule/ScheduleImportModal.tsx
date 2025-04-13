import React, { useState, useCallback } from 'react';
import { Schedule, validateSchedules } from '@vizora/common';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/useToast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { AlertCircleIcon, CheckCircleIcon, XCircleIcon, InfoIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ScheduleImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (schedules: Schedule[]) => void;
  existingSchedules: Schedule[];
  displayId: string;
}

interface ImportResult {
  schedule: Schedule;
  status: 'success' | 'duplicate' | 'error';
  message?: string;
}

export function ScheduleImportModal({
  open,
  onOpenChange,
  onImport,
  existingSchedules,
  displayId
}: ScheduleImportModalProps) {
  const { toast } = useToast();
  const [previewData, setPreviewData] = useState<{
    count: number;
    valid: number;
    invalid: number;
    preview: Schedule[];
    duplicates: string[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'results'>('preview');

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.schedules || !Array.isArray(data.schedules)) {
        throw new Error('Invalid schedule file format');
      }

      // Validate schedules
      const validSchedules = validateSchedules(data.schedules);
      
      // Check for duplicates
      const existingNames = new Set(existingSchedules.map(s => s.name.toLowerCase()));
      const duplicates = validSchedules
        .filter(s => existingNames.has(s.name.toLowerCase()))
        .map(s => s.name);

      setPreviewData({
        count: data.schedules.length,
        valid: validSchedules.length,
        invalid: data.schedules.length - validSchedules.length,
        preview: validSchedules.slice(0, 5),
        duplicates
      });
      setImportResults(null);
      setActiveTab('preview');
    } catch (error) {
      console.error('Error parsing schedule file:', error);
      toast({
        title: 'Invalid File',
        description: 'The selected file is not a valid schedule export file.',
        variant: 'destructive'
      });
      setPreviewData(null);
      setImportResults(null);
    } finally {
      setIsLoading(false);
    }
  }, [existingSchedules, toast]);

  const handleImport = useCallback(async () => {
    if (!previewData) return;
    
    try {
      setIsLoading(true);
      const results: ImportResult[] = [];
      
      // Filter out duplicates
      const existingNames = new Set(existingSchedules.map(s => s.name.toLowerCase()));
      const schedulesToImport = previewData.preview.filter(
        s => !existingNames.has(s.name.toLowerCase())
      );

      // Import each schedule
      for (const schedule of schedulesToImport) {
        try {
          const response = await fetch(`/api/displays/${displayId}/schedule`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(schedule),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          results.push({
            schedule,
            status: 'success',
            message: 'Successfully imported'
          });
        } catch (error) {
          results.push({
            schedule,
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Add duplicate results
      previewData.duplicates.forEach(name => {
        const schedule = previewData.preview.find(s => s.name === name);
        if (schedule) {
          results.push({
            schedule,
            status: 'duplicate',
            message: 'Skipped - duplicate name'
          });
        }
      });

      setImportResults(results);
      setActiveTab('results');

      // Show summary toast
      const successCount = results.filter(r => r.status === 'success').length;
      const errorCount = results.filter(r => r.status === 'error').length;
      const duplicateCount = results.filter(r => r.status === 'duplicate').length;

      toast({
        title: 'Import Complete',
        description: `${successCount} imported, ${duplicateCount} skipped, ${errorCount} failed`,
        action: (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab('results')}
          >
            View Details
          </Button>
        ),
      });

      // Refresh schedules if any were successfully imported
      if (successCount > 0) {
        onImport(results
          .filter(r => r.status === 'success')
          .map(r => r.schedule)
        );
      }
    } catch (error) {
      console.error('Error during import:', error);
      toast({
        title: 'Import Failed',
        description: 'An error occurred during the import process',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [previewData, existingSchedules, displayId, toast, onImport]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Schedules</DialogTitle>
          <DialogDescription>
            Select a schedule export file to preview and import schedules.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'preview' | 'results')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="results" disabled={!importResults}>Results</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="space-y-4">
            <div className="flex items-center justify-center w-full">
              <label
                htmlFor="schedule-file"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg
                    className="w-8 h-8 mb-4 text-gray-500"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 20 16"
                  >
                    <path
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                    />
                  </svg>
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">.vizora-schedule.json files only</p>
                </div>
                <input
                  id="schedule-file"
                  type="file"
                  className="hidden"
                  accept=".vizora-schedule.json"
                  onChange={handleFileChange}
                />
              </label>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
              </div>
            )}

            {previewData && (
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    <CheckCircleIcon className="h-3 w-3 mr-1" />
                    {previewData.valid} Valid
                  </Badge>
                  {previewData.invalid > 0 && (
                    <Badge variant="outline" className="bg-red-50 text-red-700">
                      <XCircleIcon className="h-3 w-3 mr-1" />
                      {previewData.invalid} Invalid
                    </Badge>
                  )}
                  {previewData.duplicates.length > 0 && (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                      <AlertCircleIcon className="h-3 w-3 mr-1" />
                      {previewData.duplicates.length} Duplicates
                    </Badge>
                  )}
                </div>

                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.preview.map((schedule) => {
                        const isDuplicate = previewData.duplicates.includes(schedule.name);
                        return (
                          <TableRow key={schedule.id}>
                            <TableCell className="font-medium">{schedule.name}</TableCell>
                            <TableCell>
                              {format(new Date(schedule.startTime), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {schedule.repeat === 'none' ? 'One-time' : schedule.repeat}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={
                                schedule.priority >= 4 ? 'bg-red-50 text-red-700' :
                                schedule.priority >= 3 ? 'bg-orange-50 text-orange-700' :
                                schedule.priority >= 2 ? 'bg-yellow-50 text-yellow-700' :
                                'bg-gray-50 text-gray-700'
                              }>
                                {schedule.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {isDuplicate ? (
                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                                  Duplicate
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-green-50 text-green-700">
                                  Ready to Import
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {previewData.count > 5 && (
                  <p className="text-sm text-gray-500 text-center">
                    Showing first 5 of {previewData.count} schedules
                  </p>
                )}

                {previewData.duplicates.length > 0 && (
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <p className="text-sm text-yellow-700">
                      {previewData.duplicates.length} schedule(s) with duplicate names will be skipped.
                      Please rename them before importing.
                    </p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            {importResults && (
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importResults.map((result, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{result.schedule.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            result.status === 'success' ? 'bg-green-50 text-green-700' :
                            result.status === 'duplicate' ? 'bg-yellow-50 text-yellow-700' :
                            'bg-red-50 text-red-700'
                          }>
                            {result.status === 'success' ? (
                              <CheckCircleIcon className="h-3 w-3 mr-1" />
                            ) : result.status === 'duplicate' ? (
                              <AlertCircleIcon className="h-3 w-3 mr-1" />
                            ) : (
                              <XCircleIcon className="h-3 w-3 mr-1" />
                            )}
                            {result.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            {result.message}
                            {result.status === 'error' && (
                              <InfoIcon className="h-4 w-4 ml-2 text-red-500" />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!previewData || previewData.valid === 0 || isLoading}
          >
            {isLoading ? 'Importing...' : `Import ${previewData?.valid || 0} Schedule(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 