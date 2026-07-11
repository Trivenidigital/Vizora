'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import type {
  AlertRule,
  AlertChannel,
  AlertScope,
  Display,
  DisplayGroup,
  User,
} from '@/lib/types';
import type { AlertRuleRecipientInput } from '@/lib/api/alert-rules';
import { useAuth } from '@/lib/hooks/useAuth';
import { useToast } from '@/lib/hooks/useToast';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import { Icon } from '@/theme/icons';

export const dynamic = 'force-dynamic';

// device.offline is the only trigger wired today (alert-rule.types.ts).
// Kept as a list so more triggers slot in without a UI rewrite.
const TRIGGER_OPTIONS: { value: string; label: string }[] = [
  { value: 'device.offline', label: 'Device goes offline' },
];

// tag scope is supported by the API but has no device-tag list endpoint on
// the web client yet, so it is intentionally omitted from the picker.
const SCOPE_OPTIONS: { value: AlertScope; label: string }[] = [
  { value: 'all', label: 'All devices' },
  { value: 'display', label: 'A specific device' },
  { value: 'group', label: 'A device group' },
];

const CHANNEL_OPTIONS: { value: AlertChannel; label: string }[] = [
  { value: 'in_app', label: 'In-app notification' },
  { value: 'email', label: 'Email' },
  { value: 'slack_webhook', label: 'Slack webhook' },
];

// Mirrors MIN_OFFLINE_SEC_FLOOR in alert-rule.types.ts (stale-heartbeat cron threshold).
const MIN_OFFLINE_SEC_FLOOR = 120;

const CHANNEL_LABEL: Record<AlertChannel, string> = {
  in_app: 'In-app',
  email: 'Email',
  slack_webhook: 'Slack',
};

interface RuleForm {
  name: string;
  triggerEvent: string;
  scope: AlertScope;
  scopeDisplayId: string;
  scopeGroupId: string;
  minOfflineSec: number;
  isActive: boolean;
}

const EMPTY_FORM: RuleForm = {
  name: '',
  triggerEvent: 'device.offline',
  scope: 'all',
  scopeDisplayId: '',
  scopeGroupId: '',
  minOfflineSec: MIN_OFFLINE_SEC_FLOOR,
  isActive: true,
};

export default function AlertsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === 'admin';

  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Scope + recipient pickers
  const [displays, setDisplays] = useState<Display[]>([]);
  const [groups, setGroups] = useState<DisplayGroup[]>([]);
  const [members, setMembers] = useState<User[]>([]);

  // Modal state — editingRule=null means "create"
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM);

  // Recipients drafted while creating a new rule (edit mode manages them live)
  const [draftRecipients, setDraftRecipients] = useState<AlertRuleRecipientInput[]>([
    { channel: 'in_app', target: '' },
  ]);

  // Delete confirmation
  const [ruleToDelete, setRuleToDelete] = useState<AlertRule | null>(null);

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getAlertRules();
      setRules(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load alert rules');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPickerData = useCallback(async () => {
    try {
      const [displayRes, groupRes, memberRes] = await Promise.all([
        apiClient.getDisplays({ limit: 200 }),
        apiClient.getDisplayGroups({ limit: 200 }),
        apiClient.getUsers({ limit: 200 }),
      ]);
      setDisplays(displayRes.data);
      setGroups(groupRes.data);
      setMembers(memberRes.data);
    } catch {
      // Pickers are best-effort — a rule can still target "all devices" and
      // email/slack recipients without these lists.
    }
  }, []);

  useEffect(() => {
    loadRules();
    loadPickerData();
  }, [loadRules, loadPickerData]);

  const displayName = (id: string | null) =>
    displays.find((d) => d.id === id)?.nickname || id || '—';
  const groupName = (id: string | null) =>
    groups.find((g) => g.id === id)?.name || id || '—';
  const memberName = (id: string) => {
    const m = members.find((u) => u.id === id);
    return m ? `${m.firstName} ${m.lastName}`.trim() || m.email : id;
  };

  const scopeSummary = (rule: AlertRule): string => {
    switch (rule.scope) {
      case 'all':
        return 'All devices';
      case 'display':
        return `Device: ${displayName(rule.scopeDisplayId)}`;
      case 'group':
        return `Group: ${groupName(rule.scopeGroupId)}`;
      case 'tag':
        return `Tag: ${rule.scopeTagId ?? '—'}`;
      default:
        return rule.scope;
    }
  };

  const recipientSummary = (rule: AlertRule): string => {
    if (rule.recipients.length === 0) return 'No recipients';
    const counts = rule.recipients.reduce<Record<string, number>>((acc, r) => {
      acc[r.channel] = (acc[r.channel] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .map(([channel, n]) => `${n} ${CHANNEL_LABEL[channel as AlertChannel] ?? channel}`)
      .join(', ');
  };

  const openCreate = () => {
    setEditingRule(null);
    setForm(EMPTY_FORM);
    setDraftRecipients([{ channel: 'in_app', target: '' }]);
    setIsModalOpen(true);
  };

  const openEdit = (rule: AlertRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      triggerEvent: rule.triggerEvent,
      scope: rule.scope,
      scopeDisplayId: rule.scopeDisplayId ?? '',
      scopeGroupId: rule.scopeGroupId ?? '',
      minOfflineSec: rule.minOfflineSec,
      isActive: rule.isActive,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRule(null);
  };

  const validateForm = (): string | null => {
    if (!form.name.trim()) return 'Please enter a rule name';
    if (form.scope === 'display' && !form.scopeDisplayId) return 'Please choose a device';
    if (form.scope === 'group' && !form.scopeGroupId) return 'Please choose a device group';
    if (form.minOfflineSec < MIN_OFFLINE_SEC_FLOOR) {
      return `Alert delay must be at least ${MIN_OFFLINE_SEC_FLOOR} seconds`;
    }
    return null;
  };

  const buildScopePayload = () => ({
    scope: form.scope,
    ...(form.scope === 'display' ? { scopeDisplayId: form.scopeDisplayId } : {}),
    ...(form.scope === 'group' ? { scopeGroupId: form.scopeGroupId } : {}),
  });

  const handleSave = async () => {
    const err = validateForm();
    if (err) {
      toast.error(err);
      return;
    }

    setActionLoading(true);
    try {
      if (editingRule) {
        await apiClient.updateAlertRule(editingRule.id, {
          name: form.name.trim(),
          triggerEvent: form.triggerEvent,
          minOfflineSec: form.minOfflineSec,
          isActive: form.isActive,
          ...buildScopePayload(),
        });
        toast.success('Alert rule updated');
      } else {
        const cleaned = draftRecipients
          .map((r) => ({ channel: r.channel, target: r.target.trim() }))
          .filter((r) => r.target.length > 0);
        if (cleaned.length === 0) {
          toast.error('Add at least one recipient');
          setActionLoading(false);
          return;
        }
        await apiClient.createAlertRule({
          name: form.name.trim(),
          triggerEvent: form.triggerEvent,
          minOfflineSec: form.minOfflineSec,
          isActive: form.isActive,
          recipients: cleaned,
          ...buildScopePayload(),
        });
        toast.success('Alert rule created');
      }
      closeModal();
      loadRules();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save alert rule');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (rule: AlertRule) => {
    setActionLoading(true);
    try {
      await apiClient.updateAlertRule(rule.id, { isActive: !rule.isActive });
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, isActive: !r.isActive } : r)),
      );
    } catch (error: any) {
      toast.error(error.message || 'Failed to update rule');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!ruleToDelete) return;
    setActionLoading(true);
    try {
      await apiClient.deleteAlertRule(ruleToDelete.id);
      toast.success(`Deleted "${ruleToDelete.name}"`);
      setRuleToDelete(null);
      loadRules();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete rule');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Recipient editing (edit mode calls the API directly) ──
  const handleAddRecipient = async (channel: AlertChannel, target: string) => {
    if (!editingRule) return;
    const trimmed = target.trim();
    if (!trimmed) {
      toast.error('Enter a recipient value');
      return;
    }
    setActionLoading(true);
    try {
      const created = await apiClient.addAlertRuleRecipient(editingRule.id, {
        channel,
        target: trimmed,
      });
      const updated: AlertRule = {
        ...editingRule,
        recipients: [...editingRule.recipients, created],
      };
      setEditingRule(updated);
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast.success('Recipient added');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add recipient');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveRecipient = async (recipientId: string) => {
    if (!editingRule) return;
    setActionLoading(true);
    try {
      await apiClient.removeAlertRuleRecipient(editingRule.id, recipientId);
      const updated: AlertRule = {
        ...editingRule,
        recipients: editingRule.recipients.filter((r) => r.id !== recipientId),
      };
      setEditingRule(updated);
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast.success('Recipient removed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove recipient');
    } finally {
      setActionLoading(false);
    }
  };

  // Renders the value input for a recipient given its channel.
  const renderTargetInput = (
    channel: AlertChannel,
    value: string,
    onChange: (v: string) => void,
  ) => {
    if (channel === 'in_app') {
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
        >
          <option value="">Select a team member…</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {`${m.firstName} ${m.lastName}`.trim() || m.email} ({m.email})
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        type={channel === 'email' ? 'email' : 'url'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          channel === 'email'
            ? 'alerts@example.com'
            : 'https://hooks.slack.com/services/…'
        }
        className="flex-1 px-3 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
      />
    );
  };

  return (
    <div className="space-y-6">
      <toast.ToastContainer />

      <div className="flex justify-between items-center">
        <div>
          <h2 className="eh-heading font-[var(--font-sora)] text-2xl text-[var(--foreground)]">Alerts</h2>
          <p className="mt-2 text-[var(--foreground-secondary)]">
            Configure who gets notified when a display goes offline.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="bg-[#00E5A0] text-[#061A21] px-6 py-3 rounded-lg hover:bg-[#00CC8E] transition font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
          >
            <Icon name="add" size="lg" />
            <span>New Alert Rule</span>
          </button>
        )}
      </div>

      {!isAdmin && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Only administrators can create or modify alert rules. Contact your admin to change these settings.
          </p>
        </div>
      )}

      {loading ? (
        <div className="bg-[var(--surface)] rounded-lg shadow p-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : rules.length === 0 ? (
        <EmptyState
          icon="bell"
          title="No alert rules"
          description="Create a rule to get notified when your displays go offline."
          action={isAdmin ? { label: 'New Alert Rule', onClick: openCreate } : undefined}
        />
      ) : (
        <div className="bg-[var(--surface)] rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-[var(--border)]">
            <thead className="bg-[var(--background)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground-tertiary)] uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground-tertiary)] uppercase tracking-wider">Trigger</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground-tertiary)] uppercase tracking-wider">Scope</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground-tertiary)] uppercase tracking-wider">Recipients</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground-tertiary)] uppercase tracking-wider">Status</th>
                {isAdmin && (
                  <th className="px-4 py-3 text-right text-xs font-medium text-[var(--foreground-tertiary)] uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-[var(--surface)] divide-y divide-[var(--border)]">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-[var(--surface-hover)] transition">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm font-medium text-[var(--foreground)]">{rule.name}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--foreground-secondary)]">
                    Offline &gt; {rule.minOfflineSec}s
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--foreground-secondary)]">
                    {scopeSummary(rule)}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--foreground-secondary)]">
                    {recipientSummary(rule)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {isAdmin ? (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={rule.isActive}
                        aria-label={`Toggle ${rule.name}`}
                        disabled={actionLoading}
                        onClick={() => handleToggleActive(rule)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#00E5A0] focus:ring-offset-2 disabled:opacity-50 ${
                          rule.isActive ? 'bg-[#00E5A0]' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            rule.isActive ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    ) : (
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${
                          rule.isActive
                            ? 'bg-[#00E5A0]/10 text-[#00E5A0]'
                            : 'bg-gray-200 dark:bg-gray-700 text-[var(--foreground-tertiary)]'
                        }`}
                      >
                        {rule.isActive ? 'Active' : 'Paused'}
                      </span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openEdit(rule)}
                        className="text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] px-3 py-1 rounded transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setRuleToDelete(rule)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-500/10 px-3 py-1 rounded transition"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingRule ? 'Edit Alert Rule' : 'New Alert Rule'}
        size="lg"
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">
              Rule Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={120}
              placeholder="e.g. Lobby screens offline"
              className="w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">Trigger</label>
              <select
                value={form.triggerEvent}
                onChange={(e) => setForm({ ...form, triggerEvent: e.target.value })}
                className="w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
              >
                {TRIGGER_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">
                Alert after (seconds offline)
              </label>
              <input
                type="number"
                min={MIN_OFFLINE_SEC_FLOOR}
                value={form.minOfflineSec}
                onChange={(e) =>
                  setForm({ ...form, minOfflineSec: parseInt(e.target.value, 10) || MIN_OFFLINE_SEC_FLOOR })
                }
                className="w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">Applies to</label>
              <select
                value={form.scope}
                onChange={(e) =>
                  setForm({ ...form, scope: e.target.value as AlertScope, scopeDisplayId: '', scopeGroupId: '' })
                }
                className="w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
              >
                {SCOPE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            {form.scope === 'display' && (
              <div>
                <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">
                  Device <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.scopeDisplayId}
                  onChange={(e) => setForm({ ...form, scopeDisplayId: e.target.value })}
                  className="w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
                >
                  <option value="">Select a device…</option>
                  {displays.map((d) => (
                    <option key={d.id} value={d.id}>{d.nickname}</option>
                  ))}
                </select>
              </div>
            )}
            {form.scope === 'group' && (
              <div>
                <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">
                  Device Group <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.scopeGroupId}
                  onChange={(e) => setForm({ ...form, scopeGroupId: e.target.value })}
                  className="w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
                >
                  <option value="">Select a group…</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="h-4 w-4 text-[#00E5A0] border-[var(--border)] rounded focus:ring-[#00E5A0]"
            />
            <span className="text-sm font-medium text-[var(--foreground)]">Rule is active</span>
          </label>

          {/* Recipients */}
          <div className="border-t border-[var(--border)] pt-4">
            <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-3">
              Recipients {!editingRule && <span className="text-red-500">*</span>}
            </label>

            {editingRule ? (
              <RecipientsEditor
                recipients={editingRule.recipients.map((r) => ({
                  id: r.id,
                  channel: r.channel,
                  target: r.target,
                }))}
                labelForTarget={(channel, target) =>
                  channel === 'in_app' ? memberName(target) : target
                }
                actionLoading={actionLoading}
                onAdd={handleAddRecipient}
                onRemove={handleRemoveRecipient}
                renderTargetInput={renderTargetInput}
              />
            ) : (
              <DraftRecipientsEditor
                recipients={draftRecipients}
                setRecipients={setDraftRecipients}
                renderTargetInput={renderTargetInput}
              />
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
            <button
              onClick={closeModal}
              className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition"
            >
              {editingRule ? 'Done' : 'Cancel'}
            </button>
            <button
              onClick={handleSave}
              disabled={actionLoading || !form.name.trim()}
              className="px-4 py-2 text-sm font-medium bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition disabled:opacity-50 flex items-center gap-2"
            >
              {actionLoading && <LoadingSpinner size="sm" />}
              {editingRule ? 'Save Changes' : 'Create Rule'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={ruleToDelete !== null}
        onClose={() => setRuleToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Alert Rule"
        message={`Are you sure you want to delete "${ruleToDelete?.name}"? Recipients on this rule will stop receiving these alerts. This cannot be undone.`}
        confirmText="Delete Rule"
        type="danger"
      />
    </div>
  );
}

// ── Draft recipient editor (create flow — held in local state) ──
function DraftRecipientsEditor({
  recipients,
  setRecipients,
  renderTargetInput,
}: {
  recipients: AlertRuleRecipientInput[];
  setRecipients: (r: AlertRuleRecipientInput[]) => void;
  renderTargetInput: (
    channel: AlertChannel,
    value: string,
    onChange: (v: string) => void,
  ) => React.ReactNode;
}) {
  const update = (index: number, patch: Partial<AlertRuleRecipientInput>) => {
    setRecipients(recipients.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };
  const removeRow = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };
  return (
    <div className="space-y-3">
      {recipients.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={r.channel}
            onChange={(e) => update(i, { channel: e.target.value as AlertChannel, target: '' })}
            className="w-40 px-3 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
          >
            {CHANNEL_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          {renderTargetInput(r.channel, r.target, (v) => update(i, { target: v }))}
          <button
            type="button"
            onClick={() => removeRow(i)}
            disabled={recipients.length === 1}
            aria-label="Remove recipient"
            className="p-2 text-red-500 hover:bg-red-500/10 rounded transition disabled:opacity-30"
          >
            <Icon name="delete" size="md" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRecipients([...recipients, { channel: 'in_app', target: '' }])}
        className="text-sm font-medium text-[#00E5A0] hover:text-[#00CC8E] flex items-center gap-1"
      >
        <Icon name="add" size="sm" /> Add recipient
      </button>
    </div>
  );
}

// ── Live recipient editor (edit flow — mutates via API) ──
function RecipientsEditor({
  recipients,
  labelForTarget,
  actionLoading,
  onAdd,
  onRemove,
  renderTargetInput,
}: {
  recipients: { id: string; channel: AlertChannel; target: string }[];
  labelForTarget: (channel: AlertChannel, target: string) => string;
  actionLoading: boolean;
  onAdd: (channel: AlertChannel, target: string) => void;
  onRemove: (recipientId: string) => void;
  renderTargetInput: (
    channel: AlertChannel,
    value: string,
    onChange: (v: string) => void,
  ) => React.ReactNode;
}) {
  const [newChannel, setNewChannel] = useState<AlertChannel>('in_app');
  const [newTarget, setNewTarget] = useState('');

  return (
    <div className="space-y-3">
      {recipients.length === 0 && (
        <p className="text-sm text-[var(--foreground-tertiary)]">
          This rule has no recipients — it won&apos;t notify anyone until you add one.
        </p>
      )}
      {recipients.map((r) => (
        <div
          key={r.id}
          className="flex items-center justify-between gap-2 px-3 py-2 bg-[var(--background)] rounded-lg"
        >
          <div className="flex items-center gap-2 text-sm">
            <span className="px-2 py-0.5 text-xs font-medium bg-[#00E5A0]/10 text-[#00E5A0] rounded">
              {CHANNEL_OPTIONS.find((c) => c.value === r.channel)?.label ?? r.channel}
            </span>
            <span className="text-[var(--foreground)] break-all">{labelForTarget(r.channel, r.target)}</span>
          </div>
          <button
            type="button"
            onClick={() => onRemove(r.id)}
            disabled={actionLoading}
            aria-label="Remove recipient"
            className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition disabled:opacity-40"
          >
            <Icon name="delete" size="sm" />
          </button>
        </div>
      ))}

      <div className="flex items-center gap-2 pt-1">
        <select
          value={newChannel}
          onChange={(e) => {
            setNewChannel(e.target.value as AlertChannel);
            setNewTarget('');
          }}
          className="w-40 px-3 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
        >
          {CHANNEL_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        {renderTargetInput(newChannel, newTarget, setNewTarget)}
        <button
          type="button"
          onClick={() => {
            onAdd(newChannel, newTarget);
            setNewTarget('');
          }}
          disabled={actionLoading || !newTarget.trim()}
          className="px-3 py-2 text-sm font-medium bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition disabled:opacity-50 whitespace-nowrap"
        >
          Add
        </button>
      </div>
    </div>
  );
}
