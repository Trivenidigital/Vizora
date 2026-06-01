'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api';
import { fetchAllPaginated } from '@/lib/api/pagination';
import { Display, PlaylistSummary } from '@/lib/types';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import TimePicker from '@/components/TimePicker';
import DaySelector from '@/components/DaySelector';
import dynamic from 'next/dynamic';
const ScheduleCalendar = dynamic(() => import('@/components/ScheduleCalendar'), { ssr: false });
import { useToast } from '@/lib/hooks/useToast';
import { useRealtimeEvents } from '@/lib/hooks';
import { Icon } from '@/theme/icons';
import { format } from 'date-fns';
import { isApiError } from '@/lib/error-handler';

interface Schedule {
 id: string;
 name: string;
 description?: string;
 startTime?: number | string; // Minutes from midnight (0-1439) or HH:MM string
 endTime?: number | string; // Minutes from midnight (0-1439) or HH:MM string
 daysOfWeek: number[]; // 0-6 (Sunday-Saturday)
 startDate?: string;
 endDate?: string;
 playlistId: string;
 displayId?: string;
 displayGroupId?: string;
 isActive: boolean;
 priority?: number;
 createdAt: Date | string;
 updatedAt: Date | string;
 // For backward compatibility with UI
 days?: string[];
 deviceIds?: string[];
 duration?: number;
 timezone?: string;
 active?: boolean;
}

// Helper functions to convert between day names and numbers
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const dayNamesToNumbers = (names: string[]): number[] => {
 return names.map(name => DAY_NAMES.indexOf(name)).filter(n => n !== -1);
};

const dayNumbersToNames = (numbers: number[]): string[] => {
 return numbers.map(n => DAY_NAMES[n]).filter(Boolean);
};

// Convert minutes from midnight to HH:MM string for display
function minutesToHHMM(minutes: number | string): string {
  if (typeof minutes === 'string') return minutes; // already HH:MM
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// Convert HH:MM string to minutes from midnight for form submission
function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Convert startTime + duration to endTime (returns minutes from midnight)
const calculateEndTimeMinutes = (startTime: string, duration: number): number => {
 const startMinutes = hhmmToMinutes(startTime);
 return (startMinutes + duration) % 1440;
};

// Calculate duration from startTime and endTime (both in minutes from midnight)
const calculateDuration = (startTime?: number | string, endTime?: number | string): number => {
 if (startTime == null || endTime == null) return 60; // default 1 hour
 const start = typeof startTime === 'string' ? hhmmToMinutes(startTime) : startTime;
 const end = typeof endTime === 'string' ? hhmmToMinutes(endTime) : endTime;
 let duration = end - start;
 if (duration <= 0) duration += 24 * 60; // handle overnight
 return duration;
};

const getLoadFailureMessage = (reason: unknown): string => {
 if (isApiError(reason)) {
 return reason.userMessage;
 }
 if (reason instanceof Error) {
 return reason.message;
 }
 return 'Request failed';
};

const getScheduleActiveState = (schedule: Schedule): boolean => {
 return schedule.isActive ?? schedule.active ?? false;
};

const dateToIso = (date?: Date | string | null): string | undefined => {
 if (!date) return undefined;
 return typeof date === 'string' ? new Date(date).toISOString() : date.toISOString();
};

const formatConflictTimeRange = (conflict: { startTime?: number | string | null; endTime?: number | string | null }) => {
 if (conflict.startTime == null || conflict.endTime == null) {
 return 'all day';
 }
 return `${minutesToHHMM(conflict.startTime)} - ${minutesToHHMM(conflict.endTime)}`;
};

export default function SchedulesClient() {
 const toast = useToast();
 const [schedules, setSchedules] = useState<Schedule[]>([]);
 const [devices, setDevices] = useState<Display[]>([]);
 const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
 const [loading, setLoading] = useState(true);
 const [actionLoading, setActionLoading] = useState(false);
 const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'offline'>('offline');
 const [executionHistory, setExecutionHistory] = useState<Record<string, any>>({});
 const [targetType, setTargetType] = useState<'device' | 'group'>('device');
 const [displayGroups, setDisplayGroups] = useState<any[]>([]);
 const [conflictWarnings, setConflictWarnings] = useState<any[]>([]);
 const conflictWarningsRef = useRef<any[]>([]);
 const [conflictCheckFailed, setConflictCheckFailed] = useState(false);
 const conflictCheckFailedRef = useRef(false);
 const conflictResultCacheRef = useRef<Map<string, any[]>>(new Map());
 const conflictRequestCacheRef = useRef<Map<string, Promise<any[]>>>(new Map());
 const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
 const [loadError, setLoadError] = useState<string | null>(null);

 // Modal states
 const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
 const [isEditModalOpen, setIsEditModalOpen] = useState(false);
 const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
 const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);

 // Form state
 const [formData, setFormData] = useState({
 name: '',
 startTime: '09:00',
 duration: 60,
 days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
 timezone: 'America/New_York',
 playlistId: '',
 deviceIds: [] as string[],
 });

 const [formErrors, setFormErrors] = useState<Record<string, string>>({});
 const selectedTargetKey = formData.deviceIds.join('|');
 const selectedDaysKey = formData.days.join('|');

 const updateConflictWarnings = useCallback((nextWarnings: any[]) => {
 const currentWarnings = conflictWarningsRef.current;
 if (currentWarnings.length === nextWarnings.length && currentWarnings.every((warning, index) => warning === nextWarnings[index])) {
 return;
 }
 conflictWarningsRef.current = nextWarnings;
 setConflictWarnings(nextWarnings);
 }, []);

 const updateConflictCheckFailed = useCallback((failed: boolean) => {
 if (conflictCheckFailedRef.current === failed) {
 return;
 }
 conflictCheckFailedRef.current = failed;
 setConflictCheckFailed(failed);
 }, []);

 const clearConflictCheckCache = useCallback(() => {
 conflictResultCacheRef.current.clear();
 conflictRequestCacheRef.current.clear();
 }, []);

 // Real-time event handling for schedule status
 const { isConnected } = useRealtimeEvents({
 enabled: true,
 onConnectionChange: (connected) => {
 setRealtimeStatus(connected ? 'connected' : 'offline');
 },
 });

 useEffect(() => {
 loadData();
 }, []);

 useEffect(() => {
 const modalOpen = isCreateModalOpen || isEditModalOpen;
 const daysOfWeek = dayNamesToNumbers(formData.days);
 const targetIds = targetType === 'device' ? formData.deviceIds : formData.deviceIds.slice(0, 1);

 if (!modalOpen || daysOfWeek.length === 0 || targetIds.length === 0) {
 updateConflictWarnings([]);
 updateConflictCheckFailed(false);
 return;
 }

 const candidateStartDate = selectedSchedule?.startDate ? dateToIso(selectedSchedule.startDate) : new Date().toISOString().slice(0, 10);
 const candidateEndDate = dateToIso(selectedSchedule?.endDate);

 const requests = targetIds
 .filter(Boolean)
 .map((targetId) => ({
 ...(targetType === 'device' ? { displayId: targetId } : { displayGroupId: targetId }),
 daysOfWeek,
 startTime: hhmmToMinutes(formData.startTime),
 endTime: calculateEndTimeMinutes(formData.startTime, formData.duration),
 startDate: candidateStartDate,
 ...(candidateEndDate ? { endDate: candidateEndDate } : {}),
 ...(selectedSchedule?.id ? { excludeScheduleId: selectedSchedule.id } : {}),
 }));

 if (requests.length === 0) {
 updateConflictWarnings([]);
 updateConflictCheckFailed(false);
 return;
 }

 let cancelled = false;

 const checkConflicts = async () => {
 try {
 const getConflictsForRequest = (request: typeof requests[number]) => {
 const requestKey = JSON.stringify(request);
 const cachedResult = conflictResultCacheRef.current.get(requestKey);
 if (cachedResult) {
 return Promise.resolve(cachedResult);
 }

 const cachedRequest = conflictRequestCacheRef.current.get(requestKey);
 if (cachedRequest) {
 return cachedRequest;
 }

 const requestPromise = apiClient.checkScheduleConflicts(request)
 .then((result) => {
 const conflicts = result.conflicts || [];
 conflictResultCacheRef.current.set(requestKey, conflicts);
 conflictRequestCacheRef.current.delete(requestKey);
 return conflicts;
 })
 .catch((error) => {
 conflictRequestCacheRef.current.delete(requestKey);
 throw error;
 });

 conflictRequestCacheRef.current.set(requestKey, requestPromise);
 return requestPromise;
 };

 const results = await Promise.all(
 requests.map((request) => getConflictsForRequest(request)),
 );
 if (cancelled) return;

 const conflictsById = new Map<string, any>();
 results.flat().forEach((conflict: any, index) => {
 const key = conflict.id || `${conflict.name || 'conflict'}-${conflict.startTime}-${conflict.endTime}-${index}`;
 conflictsById.set(key, conflict);
 });
 updateConflictCheckFailed(false);
 updateConflictWarnings(Array.from(conflictsById.values()));
 } catch {
 if (!cancelled) {
 updateConflictWarnings([]);
 updateConflictCheckFailed(true);
 }
 }
 };

 void checkConflicts();

 return () => {
 cancelled = true;
 };
 }, [
 isCreateModalOpen,
 isEditModalOpen,
 targetType,
 selectedTargetKey,
 selectedDaysKey,
 formData.startTime,
 formData.duration,
 selectedSchedule?.id,
 selectedSchedule?.startDate,
 selectedSchedule?.endDate,
 updateConflictWarnings,
 updateConflictCheckFailed,
 ]);

 const loadData = async () => {
 try {
 setLoading(true);
 setLoadError(null);
 const [schedulesRes, devicesRes, playlistsRes, groupsRes] = await Promise.allSettled([
 fetchAllPaginated((params) => apiClient.getSchedules(params)),
 fetchAllPaginated((params) => apiClient.getDisplays(params)),
 fetchAllPaginated((params) => apiClient.getPlaylists(params)),
 apiClient.getDisplayGroups
 ? fetchAllPaginated((params) => apiClient.getDisplayGroups(params))
 : Promise.resolve([]),
 ]);

 if (schedulesRes.status === 'fulfilled') {
 const scheduleData = schedulesRes.value || [];
 // Transform backend data to UI format
 const transformedSchedules = (scheduleData as any[]).map((s: any) => ({
 ...s,
 // Convert daysOfWeek numbers to day names for UI
 days: s.daysOfWeek ? dayNumbersToNames(s.daysOfWeek) : [],
 // Convert display/group target to a single UI selection array
 deviceIds: s.displayId ? [s.displayId] : s.displayGroupId ? [s.displayGroupId] : [],
 // Calculate duration from integer startTime and endTime
 duration: calculateDuration(s.startTime as number | undefined, s.endTime as number | undefined),
 // Default timezone
 timezone: 'America/New_York',
 // Map isActive to active for UI compatibility
 active: s.isActive,
 }));
 setSchedules(transformedSchedules as Schedule[]);
 }
 if (devicesRes.status === 'fulfilled') {
 const deviceData = devicesRes.value || [];
 setDevices(deviceData as unknown as Display[]);
 }
 if (playlistsRes.status === 'fulfilled') {
 const playlistData = playlistsRes.value || [];
 setPlaylists(playlistData as unknown as PlaylistSummary[]);
 }
 if (groupsRes?.status === 'fulfilled') {
 setDisplayGroups(groupsRes.value || []);
 }
 const failedResults = [
 schedulesRes.status === 'rejected' ? { source: 'schedules', reason: schedulesRes.reason } : null,
 devicesRes.status === 'rejected' ? { source: 'devices', reason: devicesRes.reason } : null,
 playlistsRes.status === 'rejected' ? { source: 'playlists', reason: playlistsRes.reason } : null,
 groupsRes.status === 'rejected' ? { source: 'device groups', reason: groupsRes.reason } : null,
 ].filter(Boolean) as Array<{ source: string; reason: unknown }>;
 const failedSources = failedResults.map((failure) => failure.source);
 if (failedSources.length > 0) {
 const messages = Array.from(
 new Set(failedResults.map((failure) => getLoadFailureMessage(failure.reason))),
 );
 setLoadError(
 `Some schedule data could not load (${failedSources.join(', ')}): ${messages.join('; ')}`,
 );
 }
 } catch (error: any) {
 setLoadError(error.message || 'Failed to load schedule data');
 toast.error(error.message || 'Failed to load data');
 } finally {
 setLoading(false);
 }
 };

 const validateForm = (): boolean => {
 const errors: Record<string, string> = {};

 if (!formData.name.trim()) {
 errors.name = 'Schedule name is required';
 }
 if (formData.days.length === 0) {
 errors.days = 'Select at least one day';
 }
 if (!formData.playlistId) {
 errors.playlistId = 'Select a playlist';
 }
 if (formData.deviceIds.length === 0) {
 errors.deviceIds = 'Select at least one device';
 }
 if (formData.duration < 1 || formData.duration > 1440) {
 errors.duration = 'Duration must be between 1 and 1440 minutes';
 }

 setFormErrors(errors);
 return Object.keys(errors).length === 0;
 };

 const handleTargetTypeChange = (nextTargetType: 'device' | 'group') => {
 setTargetType(nextTargetType);
 setFormData((prev) => ({ ...prev, deviceIds: [] }));
 setFormErrors((prev) => {
 const { deviceIds, ...rest } = prev;
 return rest;
 });
 };

 const handleCreate = async () => {
 if (!validateForm()) return;

 try {
 setActionLoading(true);

 const buildScheduleData = (targetId: string) => ({
 name: formData.name,
 playlistId: formData.playlistId,
 ...(targetType === 'device'
 ? { displayId: targetId }
 : { displayGroupId: targetId }),
 // Convert day names to numbers (0-6)
 daysOfWeek: dayNamesToNumbers(formData.days),
 // Start date is required - use today
 startDate: new Date().toISOString(),
 // Start time as minutes from midnight
 startTime: hhmmToMinutes(formData.startTime),
 // Calculate end time from start time + duration (minutes from midnight)
 endTime: calculateEndTimeMinutes(formData.startTime, formData.duration),
 isActive: true,
 priority: 1,
 });

 const targets = targetType === 'device' ? formData.deviceIds : [formData.deviceIds[0]];
 const createdSchedules: any[] = [];
 try {
 for (const targetId of targets) {
 createdSchedules.push(await apiClient.createSchedule(buildScheduleData(targetId)));
 }
 } catch (error) {
 if (createdSchedules.length > 0) {
 await Promise.allSettled(
 createdSchedules
 .filter((schedule) => schedule?.id)
 .map((schedule) => apiClient.deleteSchedule(schedule.id)),
 );
 await loadData();
 }
 throw error;
 }

 // Transform response back to UI format and add to state
 const uiSchedules: Schedule[] = createdSchedules.map((createdSchedule: any) => ({
 ...createdSchedule,
 days: dayNumbersToNames(createdSchedule.daysOfWeek || []),
 deviceIds: createdSchedule.displayId ? [createdSchedule.displayId] : createdSchedule.displayGroupId ? [createdSchedule.displayGroupId] : [],
 duration: calculateDuration(createdSchedule.startTime, createdSchedule.endTime),
 timezone: formData.timezone,
 active: createdSchedule.isActive,
 }));

 setSchedules([...schedules, ...uiSchedules]);
 resetForm();
 setIsCreateModalOpen(false);
 toast.success(createdSchedules.length > 1 ? `${createdSchedules.length} schedules created successfully` : 'Schedule created successfully');
 } catch (error: any) {
 toast.error(error.message || 'Failed to create schedule');
 } finally {
 setActionLoading(false);
 }
 };

 const handleUpdate = async () => {
 if (!validateForm() || !selectedSchedule) return;

 try {
 setActionLoading(true);

 // Transform UI data to backend format
 const scheduleData = {
 name: formData.name,
 playlistId: formData.playlistId,
 ...(targetType === 'device'
 ? { displayId: formData.deviceIds[0], displayGroupId: null }
 : { displayId: null, displayGroupId: formData.deviceIds[0] }),
 daysOfWeek: dayNamesToNumbers(formData.days),
 startTime: hhmmToMinutes(formData.startTime),
 endTime: calculateEndTimeMinutes(formData.startTime, formData.duration),
 };

 const updatedSchedule = await apiClient.updateSchedule(selectedSchedule.id, scheduleData);

 // Transform response back to UI format and update state
 const uiSchedule: Schedule = {
 ...updatedSchedule,
 days: dayNumbersToNames(updatedSchedule.daysOfWeek || []),
 deviceIds: updatedSchedule.displayId ? [updatedSchedule.displayId] : updatedSchedule.displayGroupId ? [updatedSchedule.displayGroupId] : [],
 duration: calculateDuration(updatedSchedule.startTime, updatedSchedule.endTime),
 timezone: formData.timezone,
 active: updatedSchedule.isActive,
 };

 setSchedules(schedules.map(s => s.id === selectedSchedule.id ? uiSchedule : s));
 resetForm();
 setIsEditModalOpen(false);
 toast.success('Schedule updated successfully');
 } catch (error: any) {
 toast.error(error.message || 'Failed to update schedule');
 } finally {
 setActionLoading(false);
 }
 };

 const handleDelete = async () => {
 if (!selectedSchedule) return;

 try {
 setActionLoading(true);

 await apiClient.deleteSchedule(selectedSchedule.id);

 setSchedules(schedules.filter(s => s.id !== selectedSchedule.id));
 setIsDeleteModalOpen(false);
 setSelectedSchedule(null);
 toast.success('Schedule deleted successfully');
 } catch (error: any) {
 toast.error(error.message || 'Failed to delete schedule');
 } finally {
 setActionLoading(false);
 }
 };

 const openEditModal = (schedule: Schedule) => {
 clearConflictCheckCache();
 setSelectedSchedule(schedule);
 setFormData({
 name: schedule.name,
 startTime: schedule.startTime != null ? minutesToHHMM(schedule.startTime) : '09:00',
 duration: schedule.duration || 60,
 days: schedule.days || [],
 timezone: schedule.timezone || 'UTC',
 playlistId: schedule.playlistId,
 deviceIds: schedule.deviceIds || [],
 });
 setTargetType((schedule as any).displayGroupId ? 'group' : 'device');
 setFormErrors({});
 setIsEditModalOpen(true);
 };

 const openDeleteModal = (schedule: Schedule) => {
 setSelectedSchedule(schedule);
 setIsDeleteModalOpen(true);
 };

 const resetForm = () => {
 clearConflictCheckCache();
 setFormData({
 name: '',
 startTime: '09:00',
 duration: 60,
 days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
 timezone: 'America/New_York',
 playlistId: '',
 deviceIds: [],
 });
 setFormErrors({});
 setSelectedSchedule(null);
 setTargetType('device');
 updateConflictWarnings([]);
 updateConflictCheckFailed(false);
 };

 const getPlaylistName = (playlistId: string) => {
 return playlists.find(p => p.id === playlistId)?.name || 'Unknown Playlist';
 };

 const getScheduleTargetDescription = (schedule: Schedule) => {
 if (schedule.displayGroupId) {
 const group = displayGroups.find((g: any) => g.id === schedule.displayGroupId);
 const displayCount = group?._count?.displays ?? group?.displays?.length;
 return `${group?.name || schedule.displayGroupId}${typeof displayCount === 'number' ? ` (${displayCount} devices)` : ''}`;
 }

 const count = schedule.deviceIds?.length || 0;
 return `${count} device${count !== 1 ? 's' : ''}`;
 };

 const formatScheduleTime = (startTime?: number | string, duration?: number) => {
 const start = typeof startTime === 'string' ? hhmmToMinutes(startTime) : (startTime ?? 540); // default 09:00
 const dur = duration || 60;
 const end = (start + dur) % 1440;

 return `${minutesToHHMM(start)} - ${minutesToHHMM(end)}`;
 };

 // Calculate next 10 occurrences for preview
 const getNextOccurrences = () => {
 const occurrences: string[] = [];
 const dayMap: Record<string, number> = {
 Monday: 1,
 Tuesday: 2,
 Wednesday: 3,
 Thursday: 4,
 Friday: 5,
 Saturday: 6,
 Sunday: 0,
 };

 const today = new Date();
 let current = new Date(today);

 while (occurrences.length < 10) {
 const dayName = current.toLocaleDateString('en-US', { weekday: 'long' });
 if (formData.days.includes(dayName)) {
 occurrences.push(current.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }));
 }
 current.setDate(current.getDate() + 1);
 }

 return occurrences;
 };

 if (loading) {
 return (
 <div className="bg-[var(--surface)] rounded-lg shadow p-12">
 <LoadingSpinner size="lg" />
 </div>
 );
 }

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex justify-between items-center">
 <div>
 <h2 className="eh-dash-title font-[var(--font-sora)] text-2xl text-[var(--foreground)]">Schedules</h2>
 <p className="mt-2 text-[var(--foreground-secondary)]">
 Automate content playback with schedules ({schedules.length} total)
 </p>
 </div>
 <div className="flex items-center gap-3">
 {/* View Toggle */}
 <div className="flex bg-[var(--background-secondary)] rounded-lg p-1">
 <button
 onClick={() => setViewMode('list')}
 className={`px-3 py-1.5 text-sm rounded-md transition font-medium ${
 viewMode === 'list'
 ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-sm'
 : 'text-[var(--foreground-secondary)] hover:text-[var(--foreground)]'
 }`}
 >
 List
 </button>
 <button
 onClick={() => setViewMode('calendar')}
 className={`px-3 py-1.5 text-sm rounded-md transition font-medium ${
 viewMode === 'calendar'
 ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-sm'
 : 'text-[var(--foreground-secondary)] hover:text-[var(--foreground)]'
 }`}
 >
 Calendar
 </button>
 </div>
 {/* Create button */}
 <button
 onClick={() => {
 resetForm();
 setIsCreateModalOpen(true);
 }}
 className="eh-btn-neon rounded-xl px-6 py-3 transition font-semibold shadow-md hover:shadow-lg flex items-center gap-2 active:scale-95"
 >
 <Icon name="add" size="lg" className="text-white" />
 <span>Create Schedule</span>
 </button>
 </div>
 </div>

 {loadError && (
 <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
 <Icon name="error" size="lg" className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
 <div>
 <h3 className="text-sm font-semibold text-red-900 dark:text-red-100">
 Some schedule data could not load
 </h3>
 <p className="text-sm text-red-700 dark:text-red-300 mt-1">{loadError}</p>
 </div>
 </div>
 )}

 {/* Content Area */}
 {viewMode === 'calendar' ? (
 <ScheduleCalendar
 schedules={schedules}
 onSelectEvent={(schedule) => openEditModal(schedule)}
 onSelectSlot={(slotInfo) => {
 resetForm();
 const startTime = format(slotInfo.start, 'HH:mm');
 const endTime = format(slotInfo.end, 'HH:mm');
 setFormData(prev => ({
 ...prev,
 startTime: startTime !== '00:00' ? startTime : '09:00',
 duration: startTime !== '00:00' ? calculateDuration(startTime, endTime) : 60,
 days: slotInfo.daysOfWeek.map(d => DAY_NAMES[d]),
 }));
 setIsCreateModalOpen(true);
 }}
 />
 ) : schedules.length === 0 && !loadError ? (
 <EmptyState
 icon="schedules"
 title="No schedules yet"
 description="Create your first schedule to automate content playback on your devices"
 action={{
 label: 'Create Schedule',
 onClick: () => {
 resetForm();
 setIsCreateModalOpen(true);
 },
 }}
 />
 ) : (
 /* Schedules List */
 <div className="space-y-4">
 {schedules.map(schedule => {
 const scheduleActive = getScheduleActiveState(schedule);
 return (
 <div
 key={schedule.id}
 className={`eh-dash-card border-l-4 p-6 ${scheduleActive ? 'border-l-[#00E5A0]' : 'border-l-[var(--border)]'}`}
 >
 <div className="flex items-start justify-between">
 <div className="flex items-start gap-4 flex-1">
 <Icon
 name="schedules"
 size="2xl"
 className={scheduleActive ? 'text-[#00E5A0] dark:text-[#00E5A0]' : 'text-[var(--foreground-tertiary)]'}
 />
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-3 mb-3">
 <h3 className="text-xl font-semibold text-[var(--foreground)] truncate">
 {schedule.name}
 </h3>
 <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
 scheduleActive
 ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
 : 'bg-[var(--background-secondary)] text-[var(--foreground-secondary)]'
 }`}>
 {scheduleActive ? 'Active' : 'Inactive'}
 </span>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
 <div>
 <span className="font-medium text-[var(--foreground-secondary)]">Time:</span>
 <p className="text-[var(--foreground-secondary)]">{formatScheduleTime(schedule.startTime, schedule.duration)}</p>
 </div>
 <div>
 <span className="font-medium text-[var(--foreground-secondary)]">Days:</span>
 <p className="text-[var(--foreground-secondary)]">{schedule.days?.join(', ') || 'Not set'}</p>
 </div>
 <div>
 <span className="font-medium text-[var(--foreground-secondary)]">Playlist:</span>
 <p className="text-[var(--foreground-secondary)] truncate">{getPlaylistName(schedule.playlistId)}</p>
 </div>
 <div>
 <span className="font-medium text-[var(--foreground-secondary)]">Target:</span>
 <p className="text-[var(--foreground-secondary)] truncate">{getScheduleTargetDescription(schedule)}</p>
 </div>
 </div>
 </div>
 </div>
 </div>

 {/* Action Buttons */}
 <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--border)]">
 <button
 onClick={() => openEditModal(schedule)}
 className="px-4 py-2 text-sm bg-[#00E5A0]/5 dark:bg-[#00E5A0]/10 text-[#00E5A0] dark:text-[#00E5A0] rounded-lg hover:bg-[#00E5A0]/10 dark:hover:bg-[#00E5A0]/10 transition font-medium active:scale-95"
 >
 Edit
 </button>
 <button
 onClick={() => {
 // Don't set selectedSchedule so it's treated as a new schedule
 setSelectedSchedule(null);
 setTargetType((schedule as any).displayGroupId ? 'group' : 'device');
 setFormData({
 name: `${schedule.name} (Copy)`,
 startTime: schedule.startTime != null ? minutesToHHMM(schedule.startTime) : '09:00',
 duration: schedule.duration || 60,
 days: schedule.days || [],
 timezone: schedule.timezone || 'UTC',
 playlistId: schedule.playlistId,
 deviceIds: schedule.deviceIds || [],
 });
 setIsCreateModalOpen(true);
 }}
 className="px-4 py-2 text-sm bg-[var(--background)] text-[var(--foreground-secondary)] rounded-lg hover:bg-[var(--surface-hover)] transition font-medium active:scale-95"
 >
 Duplicate
 </button>
 <button
 onClick={() => openDeleteModal(schedule)}
 className="px-4 py-2 text-sm bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-200 rounded-lg hover:bg-red-100 dark:hover:bg-red-800 transition font-medium active:scale-95"
 >
 Delete
 </button>
 </div>
 </div>
 );
 })}
 </div>
 )}

 {/* Tips Section */}
 {schedules.length > 0 && (
 <div className="bg-[#00E5A0]/5 dark:bg-[#00E5A0]/10 border border-[#00E5A0]/30 dark:border-[#00E5A0] rounded-lg p-6">
 <h4 className="eh-dash-subtitle text-[#00E5A0] dark:text-[#00E5A0] mb-3 flex items-center gap-2">
 <Icon name="info" size="md" className="text-[#00E5A0] dark:text-[#00E5A0]" />
 Tips for Using Schedules
 </h4>
 <ul className="text-sm text-[#00E5A0] dark:text-[#00E5A0] space-y-2">
 <li>• Schedules automatically control which playlist plays at specific times</li>
 <li>• You can overlap schedules - the most recently created one takes precedence</li>
 <li>• Devices will sync schedule changes automatically</li>
 <li>• If a device is offline, it will apply the schedule when it comes back online</li>
 </ul>
 </div>
 )}

 {/* Create/Edit Schedule Modal */}
 {(isCreateModalOpen || isEditModalOpen) && (
 <Modal
 isOpen={isCreateModalOpen || isEditModalOpen}
 onClose={() => {
 if (isCreateModalOpen) setIsCreateModalOpen(false);
 if (isEditModalOpen) setIsEditModalOpen(false);
 resetForm();
 }}
 title={selectedSchedule ? 'Edit Schedule' : 'Create Schedule'}
 size="lg"
 >
 <div className="space-y-6 max-h-[75vh] overflow-y-auto">
 {/* Name */}
 <div>
 <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
 Schedule Name <span className="text-red-500">*</span>
 </label>
 <input
 type="text"
 value={formData.name}
 onChange={e => {
 setFormData({ ...formData, name: e.target.value });
 if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
 }}
 placeholder="e.g., Morning Content, Holiday Special"
 className={`eh-input w-full px-4 py-2 border rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] transition ${
 formErrors.name ? 'border-red-500' : 'border-[var(--border)]'
 }`}
 />
 {formErrors.name && <p className="text-red-600 dark:text-red-400 text-sm mt-1">{formErrors.name}</p>}
 </div>

 {/* Time & Duration */}
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
 Start Time <span className="text-red-500">*</span>
 </label>
 <TimePicker
 value={formData.startTime}
 onChange={time => setFormData({ ...formData, startTime: time })}
 interval={15}
 showFormat="24h"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
 Duration (minutes) <span className="text-red-500">*</span>
 </label>
 <input
 type="number"
 value={formData.duration}
 onChange={e => {
 setFormData({ ...formData, duration: Math.max(1, parseInt(e.target.value) || 0) });
 if (formErrors.duration) setFormErrors({ ...formErrors, duration: '' });
 }}
 min="1"
 max="1440"
 className={`eh-input w-full px-4 py-2 border rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] transition ${
 formErrors.duration ? 'border-red-500' : 'border-[var(--border)]'
 }`}
 />
 {formErrors.duration && <p className="text-red-600 dark:text-red-400 text-sm mt-1">{formErrors.duration}</p>}
 </div>
 </div>

 {/* Timezone */}
 <div>
 <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
 Timezone
 </label>
 <div className="rounded-lg border border-[var(--border)] bg-[var(--background-secondary)] px-4 py-3">
 <p className="text-sm font-medium text-[var(--foreground)]">Target display timezone</p>
 <p className="mt-1 text-xs text-[var(--foreground-secondary)]">
 Each target display applies its own configured timezone at playback time.
 </p>
 </div>
 </div>

 {/* Days */}
 <div>
 <label className="block text-sm font-medium text-[var(--foreground)] mb-3">
 Schedule Days <span className="text-red-500">*</span>
 </label>
 <DaySelector
 selected={formData.days}
 onChange={days => {
 setFormData({ ...formData, days });
 if (formErrors.days) setFormErrors({ ...formErrors, days: '' });
 }}
 />
 {formErrors.days && <p className="text-red-600 dark:text-red-400 text-sm mt-2">{formErrors.days}</p>}
 </div>

 {/* Next Occurrences Preview */}
 {formData.days.length > 0 && (
 <div className="bg-purple-50 dark:bg-purple-900 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
 <p className="text-sm font-medium text-purple-900 dark:text-purple-200 mb-2">Next 10 Occurrences:</p>
 <div className="text-xs text-purple-800 dark:text-purple-300">
 {getNextOccurrences().join(' • ')}
 </div>
 </div>
 )}

 {/* Playlist Selection */}
 <div>
 <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
 Playlist <span className="text-red-500">*</span>
 </label>
 <select
 value={formData.playlistId}
 onChange={e => {
 setFormData({ ...formData, playlistId: e.target.value });
 if (formErrors.playlistId) setFormErrors({ ...formErrors, playlistId: '' });
 }}
 className={`eh-select w-full px-4 py-2 border rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] transition ${
 formErrors.playlistId ? 'border-red-500' : 'border-[var(--border)]'
 }`}
 >
 <option value="">Select a playlist...</option>
 {playlists.map(p => (
 <option key={p.id} value={p.id}>
 {p.name}
 </option>
 ))}
 </select>
 {formErrors.playlistId && <p className="text-red-600 dark:text-red-400 text-sm mt-1">{formErrors.playlistId}</p>}
 </div>

 {/* Target Type Toggle */}
 <div>
 <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
 Target Type
 </label>
 <div className="flex gap-2">
 <button
 type="button"
 onClick={() => handleTargetTypeChange('device')}
 className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
 targetType === 'device'
 ? 'bg-[#00E5A0] text-[#061A21]'
 : 'bg-[var(--background-secondary)] text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)]'
 }`}
 >
 Individual Device
 </button>
 <button
 type="button"
 onClick={() => handleTargetTypeChange('group')}
 className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
 targetType === 'group'
 ? 'bg-[#00E5A0] text-[#061A21]'
 : 'bg-[var(--background-secondary)] text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)]'
 }`}
 >
 Device Group
 </button>
 </div>
 </div>

 {/* Device/Group Selection */}
 {targetType === 'group' ? (
 <div>
 <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
 Device Group <span className="text-red-500">*</span>
 </label>
 <select
 value={formData.deviceIds[0] || ''}
 onChange={e => {
 setFormData({ ...formData, deviceIds: e.target.value ? [e.target.value] : [] });
 if (formErrors.deviceIds) setFormErrors({ ...formErrors, deviceIds: '' });
 }}
 className="eh-select w-full px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] transition"
 >
 <option value="">Select a group...</option>
 {displayGroups.map((g: any) => (
 <option key={g.id} value={g.id}>
 {g.name} ({g._count?.displays || 0} devices)
 </option>
 ))}
 </select>
 {formErrors.deviceIds && <p className="text-red-600 dark:text-red-400 text-sm mt-1">{formErrors.deviceIds}</p>}
 </div>
 ) : (
 <div>
 <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
 Devices <span className="text-red-500">*</span>
 </label>
 <div className="space-y-2 max-h-48 overflow-y-auto border border-[var(--border)] rounded-lg p-3 bg-[var(--surface)]">
 {devices.length === 0 ? (
 <p className="text-sm text-[var(--foreground-tertiary)]">No devices available</p>
 ) : (
 devices.map(device => (
 <label key={device.id} className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={formData.deviceIds.includes(device.id)}
 onChange={e => {
 const newDeviceIds = e.target.checked
 ? [...formData.deviceIds, device.id]
 : formData.deviceIds.filter(id => id !== device.id);
 setFormData({ ...formData, deviceIds: newDeviceIds });
 if (formErrors.deviceIds) setFormErrors({ ...formErrors, deviceIds: '' });
 }}
 className="rounded border-[var(--border)] text-[#00E5A0] focus:ring-[#00E5A0]"
 />
 <span className="text-sm text-[var(--foreground-secondary)]">{device.nickname}</span>
 </label>
 ))
 )}
 </div>
 {formErrors.deviceIds && <p className="text-red-600 dark:text-red-400 text-sm mt-1">{formErrors.deviceIds}</p>}
 {formData.deviceIds.length > 0 && (
 <p className="text-sm text-[var(--foreground-secondary)] mt-2">
 {formData.deviceIds.length} device{formData.deviceIds.length !== 1 ? 's' : ''} selected
 </p>
 )}
 </div>
 )}

 {/* Conflict Warnings */}
 {conflictCheckFailed && (
 <div role="alert" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
 <p className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1 flex items-center gap-2">
 <Icon name="error" size="sm" className="text-red-600 dark:text-red-400" />
 Unable to verify schedule conflicts
 </p>
 <p className="text-xs text-red-700 dark:text-red-300">
 Check the schedule after saving or retry when the network is available.
 </p>
 </div>
 )}
 {conflictWarnings.length > 0 && (
 <div role="status" aria-live="polite" className="bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg p-3">
 <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1 flex items-center gap-2">
 <span className="text-amber-500">&#9888;</span> Schedule Conflicts Detected
 </p>
 {conflictWarnings.map((c: any, i: number) => (
 <p key={i} className="text-xs text-amber-700 dark:text-amber-300">
 Overlaps with &quot;{c.name}&quot; ({formatConflictTimeRange(c)})
 </p>
 ))}
 </div>
 )}
 </div>
 {/* Action Buttons */}
 <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)]">
 <button
 type="button"
 onClick={() => {
 if (isCreateModalOpen) setIsCreateModalOpen(false);
 if (isEditModalOpen) setIsEditModalOpen(false);
 resetForm();
 }}
 className="px-4 py-2 text-[var(--foreground-secondary)] bg-[var(--background-secondary)] hover:bg-[var(--surface-hover)] rounded-lg transition"
 >
 Cancel
 </button>
 <button
 type="button"
 onClick={selectedSchedule ? handleUpdate : handleCreate}
 disabled={actionLoading}
 className="eh-btn-neon rounded-xl px-4 py-2 disabled:opacity-60 transition flex items-center gap-2"
 >
 {actionLoading && (
 <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
 </svg>
 )}
 {selectedSchedule ? 'Update' : 'Create'}
 </button>
 </div>
 </Modal>
 )}

 {/* Delete Confirmation */}
 {isDeleteModalOpen && selectedSchedule && (
 <ConfirmDialog
 isOpen={isDeleteModalOpen}
 onClose={() => {
 setIsDeleteModalOpen(false);
 setSelectedSchedule(null);
 }}
 title="Delete Schedule"
 message={`Are you sure you want to delete "${selectedSchedule.name}"? This action cannot be undone.`}
 onConfirm={handleDelete}
 type="danger"
 />
 )}
 </div>
 );
}
