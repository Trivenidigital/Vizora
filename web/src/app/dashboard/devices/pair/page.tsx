'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useToast } from '@/lib/hooks/useToast';
import { QRCodeSVG } from 'qrcode.react';
import { Icon } from '@/theme/icons';

export default function PairDevicePage() {
 const router = useRouter();
 const searchParams = useSearchParams();
 const toast = useToast();
 const [form, setForm] = useState({
 pairingCode: '',
 deviceName: '',
 location: '',
 });
 const [loading, setLoading] = useState(false);

 // Auto-fill code from QR scan
 useEffect(() => {
 const code = searchParams?.get('code');
 if (code && code.length === 6) {
 setForm(prev => ({ ...prev, pairingCode: code.toUpperCase() }));
 toast.success('Code autofilled from QR scan!');
 }
 }, [searchParams]);

 const handlePairing = async () => {
 if (!form.pairingCode.trim() || form.pairingCode.length !== 6) {
 toast.error('Please enter a valid 6-character pairing code');
 return;
 }

 if (!form.deviceName.trim()) {
 toast.error('Please enter a device name');
 return;
 }

 try {
 setLoading(true);
 
 // Complete pairing with the code from the display
 await apiClient.completePairing({
 code: form.pairingCode.toUpperCase(),
 nickname: form.deviceName,
 location: form.location || undefined,
 });

 toast.success(`Device "${form.deviceName}" paired successfully!`);
 
 // Redirect to devices page after short delay
 setTimeout(() => {
 router.push('/dashboard/devices');
 }, 1500);
 
 } catch (error: any) {
 console.error('Pairing error:', error);
 toast.error(error.message || 'Failed to pair device. Please check the code and try again.');
 } finally {
 setLoading(false);
 }
 };

 const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
 setForm({ ...form, pairingCode: value });
 };

 return (
 <div className="max-w-2xl mx-auto space-y-6">
 <toast.ToastContainer />

 {/* Header */}
 <div className="text-center">
 <h2 className="text-3xl font-bold text-[var(--foreground)]">Pair New Device</h2>
 <p className="mt-2 text-[var(--foreground-secondary)]">
 Enter the pairing code shown on your display device
 </p>
 </div>

 {/* Main Form */}
 <div className="bg-[var(--surface)] rounded-lg shadow-md p-8">
 <div className="space-y-6">
 {/* Step Instructions */}
 <div className="bg-gradient-to-r from-[#00E5A0]/5 to-[#00B4D8]/5 rounded-lg p-6 border border-[#00E5A0]/30">
 <h3 className="font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2">
 <Icon name="devices" size="lg" className="text-[#00E5A0]" />
 How to Pair Your Device
 </h3>
 <ol className="space-y-2 text-sm text-[var(--foreground-secondary)]">
 <li className="flex items-start gap-2">
 <span className="font-bold text-[#00E5A0] min-w-[24px]">1.</span>
 <span>Open the Vizora Display App on your device</span>
 </li>
 <li className="flex items-start gap-2">
 <span className="font-bold text-[#00E5A0] min-w-[24px]">2.</span>
 <span>A 6-character pairing code will be displayed on the screen</span>
 </li>
 <li className="flex items-start gap-2">
 <span className="font-bold text-[#00E5A0] min-w-[24px]">3.</span>
 <span>Enter that code below along with a name for your device</span>
 </li>
 <li className="flex items-start gap-2">
 <span className="font-bold text-[#00E5A0] min-w-[24px]">4.</span>
 <span>Click "Pair Device" to complete the pairing</span>
 </li>
 </ol>
 </div>

 {/* Pairing Code Input */}
 <div>
 <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">
 Pairing Code *
 <span className="text-xs text-[var(--foreground-tertiary)] ml-2">(6 characters from your display)</span>
 </label>
 <input
 type="text"
 value={form.pairingCode}
 onChange={handleCodeChange}
 className="w-full px-4 py-4 text-center text-3xl font-bold tracking-widest border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent uppercase"
 placeholder="ABC123"
 maxLength={6}
 autoFocus
 style={{ letterSpacing: '0.5em' }}
 />
 <p className="mt-2 text-xs text-[var(--foreground-tertiary)]">
 Enter the 6-character code shown on your display device
 </p>
 
 {/* QR Code - Show when code is entered */}
 {form.pairingCode.length === 6 && (
 <div className="mt-4 p-4 bg-[var(--background)] rounded-lg border border-[var(--border)]">
 <div className="flex items-center justify-between mb-3">
 <div>
 <p className="text-sm font-medium text-[var(--foreground)]">QR Code for Mobile</p>
 <p className="text-xs text-[var(--foreground-tertiary)]">Scan to autofill code on mobile devices</p>
 </div>
 </div>
 <div className="flex justify-center p-4 bg-[var(--surface)] rounded">
 <QRCodeSVG
 value={`${window.location.origin}/dashboard/devices/pair?code=${form.pairingCode}`}
 size={120}
 level="M"
 includeMargin={true}
 />
 </div>
 </div>
 )}
 </div>

 {/* Device Name Input */}
 <div>
 <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">
 Device Name *
 </label>
 <input
 type="text"
 value={form.deviceName}
 onChange={(e) => setForm({ ...form, deviceName: e.target.value })}
 className="w-full px-4 py-3 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
 placeholder="e.g., Lobby Display, Store Front Screen"
 />
 <p className="mt-2 text-xs text-[var(--foreground-tertiary)]">
 Choose a name to help you identify this device
 </p>
 </div>

 {/* Location Input */}
 <div>
 <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">
 Location (Optional)
 </label>
 <input
 type="text"
 value={form.location}
 onChange={(e) => setForm({ ...form, location: e.target.value })}
 className="w-full px-4 py-3 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
 placeholder="e.g., Main Entrance, Floor 2"
 />
 <p className="mt-2 text-xs text-[var(--foreground-tertiary)]">
 Physical location of the display (optional)
 </p>
 </div>

 {/* Action Buttons */}
 <div className="flex gap-3 pt-6">
 <button
 onClick={() => router.push('/dashboard/devices')}
 className="flex-1 px-6 py-3 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition"
 disabled={loading}
 >
 Cancel
 </button>
 <button
 onClick={handlePairing}
 className="flex-1 px-6 py-3 text-sm font-medium text-white bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition disabled:opacity-50 flex items-center justify-center gap-2"
 disabled={loading || !form.pairingCode || form.pairingCode.length !== 6 || !form.deviceName.trim()}
 >
 {loading ? (
 <>
 <LoadingSpinner size="sm" />
 <span>Pairing...</span>
 </>
 ) : (
 <>
 <Icon name="success" size="md" className="text-white" />
 <span>Pair Device</span>
 </>
 )}
 </button>
 </div>
 </div>
 </div>

 {/* Help Section */}
 <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
 <h4 className="font-semibold text-yellow-900 mb-3 flex items-center gap-2">
 <Icon name="info" size="md" className="text-yellow-600" />
 Troubleshooting Tips
 </h4>
 <ul className="text-sm text-yellow-800 space-y-2">
 <li>• Make sure the Vizora Display App is installed and running on your device</li>
 <li>• Ensure your device is connected to the internet</li>
 <li>• Pairing codes expire after 5 minutes - generate a new one if needed</li>
 <li>• Codes are case-insensitive (automatically converted to uppercase)</li>
 <li>• Contact support if you continue to experience issues</li>
 </ul>
 </div>

 {/* Visual Guide */}
 <div className="bg-[var(--surface)] rounded-lg shadow-md p-6">
 <h4 className="font-semibold text-[var(--foreground)] mb-4">What to Expect</h4>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
 <div className="p-4 bg-[var(--background)] rounded-lg">
 <Icon name="devices" size="2xl" className="mx-auto mb-2 text-[var(--foreground-secondary)]" />
 <div className="font-semibold text-sm text-[var(--foreground)] mb-1">On Your Display</div>
 <div className="text-xs text-[var(--foreground-secondary)]">
 A 6-character code like "ABC123" will be shown
 </div>
 </div>
 <div className="p-4 bg-[var(--background)] rounded-lg">
 <Icon name="edit" size="2xl" className="mx-auto mb-2 text-[var(--foreground-secondary)]" />
 <div className="font-semibold text-sm text-[var(--foreground)] mb-1">Enter Code Here</div>
 <div className="text-xs text-[var(--foreground-secondary)]">
 Type the code and give your device a name
 </div>
 </div>
 <div className="p-4 bg-[var(--background)] rounded-lg">
 <Icon name="success" size="2xl" className="mx-auto mb-2 text-green-600" />
 <div className="font-semibold text-sm text-[var(--foreground)] mb-1">Pairing Complete</div>
 <div className="text-xs text-[var(--foreground-secondary)]">
 Your device will connect automatically
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}
