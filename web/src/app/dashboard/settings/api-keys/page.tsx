'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import type { ApiKey } from '@/lib/types';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/lib/hooks/useToast';
import { Icon } from '@/theme/icons';

// Available scopes for API keys
const AVAILABLE_SCOPES = [
  { value: 'read:content', label: 'Read Content', description: 'View content items' },
  { value: 'write:content', label: 'Write Content', description: 'Create, update, delete content' },
  { value: 'read:playlists', label: 'Read Playlists', description: 'View playlists' },
  { value: 'write:playlists', label: 'Write Playlists', description: 'Create, update, delete playlists' },
  { value: 'read:displays', label: 'Read Displays', description: 'View display devices' },
  { value: 'write:displays', label: 'Write Displays', description: 'Manage display devices' },
  { value: 'read:schedules', label: 'Read Schedules', description: 'View schedules' },
  { value: 'write:schedules', label: 'Write Schedules', description: 'Create, update, delete schedules' },
  { value: 'read:all', label: 'Read All', description: 'Read access to all resources' },
  { value: 'write:all', label: 'Write All', description: 'Full read/write access to all resources' },
];

export default function ApiKeysPage() {
  const toast = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Create modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    scopes: ['read:all'] as string[],
    expiresAt: '',
  });

  // Show key modal state
  const [newKeyInfo, setNewKeyInfo] = useState<{ key: string; name: string } | null>(null);

  // Revoke dialog state
  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null);

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      setLoading(true);
      const keys = await apiClient.getApiKeys();
      setApiKeys(keys);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.name) {
      toast.error('Please enter a name for the API key');
      return;
    }

    try {
      setActionLoading(true);
      const result = await apiClient.createApiKey({
        name: createForm.name,
        scopes: createForm.scopes,
        expiresAt: createForm.expiresAt || undefined,
      });
      toast.success('API key created successfully');
      setIsCreateModalOpen(false);
      setNewKeyInfo({ key: result.key, name: result.apiKey.name });
      setCreateForm({ name: '', scopes: ['read:all'], expiresAt: '' });
      loadApiKeys();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create API key');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeClick = (key: ApiKey) => {
    setKeyToRevoke(key);
    setIsRevokeDialogOpen(true);
  };

  const confirmRevoke = async () => {
    if (!keyToRevoke) return;

    try {
      setActionLoading(true);
      await apiClient.revokeApiKey(keyToRevoke.id);
      toast.success(`API key "${keyToRevoke.name}" has been revoked`);
      setIsRevokeDialogOpen(false);
      setKeyToRevoke(null);
      loadApiKeys();
    } catch (error: any) {
      toast.error(error.message || 'Failed to revoke API key');
    } finally {
      setActionLoading(false);
    }
  };

  const handleScopeToggle = (scope: string) => {
    setCreateForm((prev) => {
      const hasScope = prev.scopes.includes(scope);
      if (hasScope) {
        return { ...prev, scopes: prev.scopes.filter((s) => s !== scope) };
      } else {
        return { ...prev, scopes: [...prev.scopes, scope] };
      }
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="space-y-6">
      <toast.ToastContainer />

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">API Keys</h2>
          <p className="mt-2 text-gray-600">
            Manage API keys for programmatic access to your Vizora organization
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
        >
          <Icon name="add" size="lg" className="text-white" />
          <span>Create API Key</span>
        </button>
      </div>

      {/* New Key Alert */}
      {newKeyInfo && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Icon name="warning" size="lg" className="text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-yellow-800">
                New API Key Created: {newKeyInfo.name}
              </h4>
              <p className="text-sm text-yellow-700 mt-1">
                Copy this key now. You will not be able to see it again.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="bg-yellow-100 px-3 py-2 rounded text-sm font-mono text-yellow-900 break-all flex-1">
                  {newKeyInfo.key}
                </code>
                <button
                  onClick={() => copyToClipboard(newKeyInfo.key)}
                  className="flex-shrink-0 p-2 text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100 rounded transition"
                  title="Copy to clipboard"
                >
                  <Icon name="copy" size="md" />
                </button>
              </div>
              <button
                onClick={() => setNewKeyInfo(null)}
                className="mt-3 text-sm text-yellow-600 hover:text-yellow-800"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Keys Table */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : apiKeys.length === 0 ? (
        <EmptyState
          icon="key"
          title="No API keys"
          description="Create your first API key to enable programmatic access"
          action={{
            label: 'Create API Key',
            onClick: () => setIsCreateModalOpen(true),
          }}
        />
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Key Prefix
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scopes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Used
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {apiKeys.map((key) => (
                <tr
                  key={key.id}
                  className={`hover:bg-gray-50 transition ${isExpired(key.expiresAt) ? 'opacity-50' : ''}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Icon name="key" size="md" className="text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">{key.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <code className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      {key.prefix}...
                    </code>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {key.scopes.slice(0, 3).map((scope) => (
                        <span
                          key={scope}
                          className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded"
                        >
                          {scope}
                        </span>
                      ))}
                      {key.scopes.length > 3 && (
                        <span className="px-2 py-0.5 text-xs text-gray-500">
                          +{key.scopes.length - 3} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(key.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(key.lastUsedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {key.expiresAt ? (
                      <span
                        className={`text-sm ${isExpired(key.expiresAt) ? 'text-red-600' : 'text-gray-500'}`}
                      >
                        {isExpired(key.expiresAt) ? 'Expired' : formatDate(key.expiresAt)}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">Never</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleRevokeClick(key)}
                      className="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded transition"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Usage Instructions */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Icon name="info" size="md" className="text-blue-600" />
          How to use API Keys
        </h3>
        <div className="text-sm text-gray-600 space-y-2">
          <p>
            Include your API key in the <code className="bg-gray-200 px-1 rounded">X-API-Key</code>{' '}
            header with each request:
          </p>
          <pre className="bg-gray-800 text-gray-100 p-4 rounded-lg overflow-x-auto">
{`curl -X GET "https://api.vizora.io/content" \\
  -H "X-API-Key: vz_live_your_api_key_here"`}
          </pre>
        </div>
      </div>

      {/* Create API Key Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create API Key"
        size="lg"
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Key Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder="e.g., Production API Key"
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-gray-500">
              A descriptive name to help you identify this key
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Scopes</label>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-64 overflow-y-auto">
              {AVAILABLE_SCOPES.map((scope) => (
                <label
                  key={scope.value}
                  className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={createForm.scopes.includes(scope.value)}
                    onChange={() => handleScopeToggle(scope.value)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-medium text-gray-900">{scope.label}</span>
                    <p className="text-xs text-gray-500">{scope.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expiration Date (Optional)
            </label>
            <input
              type="datetime-local"
              value={createForm.expiresAt}
              onChange={(e) => setCreateForm({ ...createForm, expiresAt: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              min={new Date().toISOString().slice(0, 16)}
            />
            <p className="mt-1 text-xs text-gray-500">
              Leave empty for a key that never expires
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={actionLoading || !createForm.name || createForm.scopes.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              {actionLoading && <LoadingSpinner size="sm" />}
              Create Key
            </button>
          </div>
        </div>
      </Modal>

      {/* Revoke Confirmation */}
      <ConfirmDialog
        isOpen={isRevokeDialogOpen}
        onClose={() => {
          setIsRevokeDialogOpen(false);
          setKeyToRevoke(null);
        }}
        onConfirm={confirmRevoke}
        title="Revoke API Key"
        message={`Are you sure you want to revoke "${keyToRevoke?.name}"? Any applications using this key will immediately lose access. This action cannot be undone.`}
        confirmText="Revoke Key"
        type="danger"
      />
    </div>
  );
}
