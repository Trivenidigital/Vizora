'use client';

import React, { useState, useRef } from 'react';
import { useCustomization } from '@/components/providers/CustomizationProvider';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import Button from '@/components/Button';

export const dynamic = 'force-dynamic';

export default function CustomizationPage() {
 const { brandConfig, updateBrandConfig, organizationId } = useCustomization();
 const [formData, setFormData] = useState(brandConfig);
 const [saveSuccess, setSaveSuccess] = useState(false);
 const [logoUploading, setLogoUploading] = useState(false);
 const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);

 const handleInputChange = (
 e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
 ) => {
 const { name, value, type } = e.currentTarget;
 setFormData((prev) => ({
 ...prev,
 [name]: type === 'checkbox' ? (e.currentTarget as HTMLInputElement).checked : value,
 }));
 };

 const handleSave = () => {
 updateBrandConfig(formData);
 setSaveSuccess(true);
 setTimeout(() => setSaveSuccess(false), 3000);
 };

 const handleReset = () => {
 setFormData(brandConfig);
 };

 const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file || !organizationId) return;

 const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
 if (!allowedTypes.includes(file.type)) {
   setLogoUploadError('Only PNG, JPEG, and SVG files are allowed');
   return;
 }

 if (file.size > 2 * 1024 * 1024) {
   setLogoUploadError('File size must be under 2MB');
   return;
 }

 setLogoUploading(true);
 setLogoUploadError(null);

 try {
   const formDataUpload = new FormData();
   formDataUpload.append('file', file);

   const res = await fetch(`/api/organizations/${organizationId}/branding/logo`, {
     method: 'POST',
     credentials: 'include',
     body: formDataUpload,
   });

   if (!res.ok) {
     const err = await res.json().catch(() => ({}));
     throw new Error(err.message || 'Upload failed');
   }

   const result = await res.json();
   setFormData((prev) => ({ ...prev, logo: result.logoUrl }));
   updateBrandConfig({ logo: result.logoUrl });
 } catch (err: any) {
   setLogoUploadError(err.message || 'Failed to upload logo');
 } finally {
   setLogoUploading(false);
   if (fileInputRef.current) fileInputRef.current.value = '';
 }
 };

 return (
 <div className="space-y-6 max-w-4xl">
 {/* Header */}
 <div>
 <h2 className="eh-heading font-[var(--font-sora)] text-2xl text-[var(--foreground)]">
 Brand Customization
 </h2>
 <p className="mt-2 text-[var(--foreground-secondary)]">
 Customize your white-label branding and appearance
 </p>
 </div>

 {/* Success Message */}
 {saveSuccess && (
 <div className="bg-success-100 dark:bg-success-900 border border-success-300 dark:border-success-700 rounded-lg p-4">
 <p className="text-success-800 dark:text-success-100 font-medium">
 Brand configuration saved successfully!
 </p>
 </div>
 )}

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Form */}
 <div className="lg:col-span-2 space-y-6">
 {/* Brand Basic Info */}
 <Card>
 <Card.Header>
 <h3 className="text-lg font-semibold text-[var(--foreground)]">
 Brand Information
 </h3>
 </Card.Header>
 <Card.Body className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
 Brand Name
 </label>
 <input
 type="text"
 name="name"
 value={formData.name}
 onChange={handleInputChange}
 className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
 placeholder="Your Brand Name"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
 Upload Logo
 </label>
 <div className="flex gap-3 items-center">
 <input
 ref={fileInputRef}
 type="file"
 accept="image/png,image/jpeg,image/svg+xml"
 onChange={handleLogoUpload}
 className="flex-1 text-sm text-[var(--foreground)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[var(--surface-hover)] file:text-[var(--foreground)] hover:file:bg-[var(--border)]"
 disabled={logoUploading || !organizationId}
 />
 {logoUploading && (
   <span className="text-sm text-[var(--foreground-secondary)]">Uploading...</span>
 )}
 </div>
 {logoUploadError && (
   <p className="text-xs text-red-500 mt-1">{logoUploadError}</p>
 )}
 <p className="text-xs text-[var(--foreground-secondary)] mt-1">
 PNG, JPEG, or SVG. Max 2MB.
 </p>
 </div>

 <div>
 <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
 Logo URL (manual)
 </label>
 <input
 type="url"
 name="logo"
 value={formData.logo || ''}
 onChange={handleInputChange}
 className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
 placeholder="https://example.com/logo.png"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
 Logo Alt Text
 </label>
 <input
 type="text"
 name="logoAlt"
 value={formData.logoAlt || ''}
 onChange={handleInputChange}
 className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
 placeholder="Logo description for accessibility"
 />
 </div>
 </Card.Body>
 </Card>

 {/* Colors */}
 <Card>
 <Card.Header>
 <h3 className="text-lg font-semibold text-[var(--foreground)]">
 Brand Colors
 </h3>
 </Card.Header>
 <Card.Body className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
 Primary Color
 </label>
 <div className="flex gap-3 items-center">
 <input
 type="color"
 name="primaryColor"
 value={formData.primaryColor}
 onChange={handleInputChange}
 className="w-12 h-10 rounded cursor-pointer border border-[var(--border)]"
 />
 <input
 type="text"
 value={formData.primaryColor}
 onChange={handleInputChange}
 disabled
 className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]"
 />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
 Secondary Color
 </label>
 <div className="flex gap-3 items-center">
 <input
 type="color"
 name="secondaryColor"
 value={formData.secondaryColor}
 onChange={handleInputChange}
 className="w-12 h-10 rounded cursor-pointer border border-[var(--border)]"
 />
 <input
 type="text"
 value={formData.secondaryColor}
 onChange={handleInputChange}
 disabled
 className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]"
 />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
 Accent Color
 </label>
 <div className="flex gap-3 items-center">
 <input
 type="color"
 name="accentColor"
 value={formData.accentColor || formData.primaryColor}
 onChange={handleInputChange}
 className="w-12 h-10 rounded cursor-pointer border border-[var(--border)]"
 />
 <input
 type="text"
 value={formData.accentColor || formData.primaryColor}
 onChange={handleInputChange}
 disabled
 className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]"
 />
 </div>
 </div>
 </Card.Body>
 </Card>

 {/* Display Settings */}
 <Card>
 <Card.Header>
 <h3 className="text-lg font-semibold text-[var(--foreground)]">
 Display Settings
 </h3>
 </Card.Header>
 <Card.Body className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
 Font Family
 </label>
 <select
 name="fontFamily"
 value={formData.fontFamily || 'sans'}
 onChange={handleInputChange}
 className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
 >
 <option value="sans">Sans Serif (Default)</option>
 <option value="serif">Serif</option>
 <option value="mono">Monospace</option>
 </select>
 </div>

 <div className="flex items-center gap-3">
 <input
 type="checkbox"
 id="showPoweredBy"
 name="showPoweredBy"
 checked={formData.showPoweredBy}
 onChange={handleInputChange}
 className="w-4 h-4 rounded border-[var(--border)] text-[#00E5A0] focus:ring-[#00E5A0] cursor-pointer"
 />
 <label
 htmlFor="showPoweredBy"
 className="text-sm font-medium text-[var(--foreground)] cursor-pointer"
 >
 Show &quot;Powered by Vizora&quot; badge
 </label>
 </div>
 </Card.Body>
 </Card>

 {/* Custom Domain */}
 <Card>
 <Card.Header>
 <h3 className="text-lg font-semibold text-[var(--foreground)]">
 Custom Domain
 </h3>
 </Card.Header>
 <Card.Body className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
 Custom Domain (Optional)
 </label>
 <input
 type="text"
 name="customDomain"
 value={formData.customDomain || ''}
 onChange={handleInputChange}
 className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
 placeholder="example.com"
 />
 <p className="text-xs text-[var(--foreground-secondary)] mt-2">
 Configure DNS to point to our servers for white-label hosting
 </p>
 </div>
 </Card.Body>
 </Card>

 {/* Custom CSS */}
 <Card>
 <Card.Header>
 <h3 className="text-lg font-semibold text-[var(--foreground)]">
 Custom CSS
 </h3>
 </Card.Header>
 <Card.Body className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
 Custom CSS Rules (Optional)
 </label>
 <textarea
 name="customCSS"
 value={formData.customCSS || ''}
 onChange={handleInputChange}
 rows={6}
 className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] font-mono text-sm focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
 placeholder=".navbar { background-color: #custom; }"
 />
 <p className="text-xs text-[var(--foreground-secondary)] mt-2">
 Add custom CSS to further customize the appearance
 </p>
 </div>
 </Card.Body>
 </Card>

 {/* Action Buttons */}
 <div className="flex gap-3">
 <Button
 onClick={handleSave}
 variant="primary"
 className="flex-1"
 >
 Save Changes
 </Button>
 <Button
 onClick={handleReset}
 variant="secondary"
 className="flex-1"
 >
 Reset
 </Button>
 </div>
 </div>

 {/* Preview */}
 <div className="lg:col-span-1">
 <Card className="sticky top-6">
 <Card.Header>
 <h3 className="text-lg font-semibold text-[var(--foreground)]">
 Preview
 </h3>
 </Card.Header>
 <Card.Body className="space-y-4">
 {/* Logo Preview */}
 {formData.logo && (
 <div className="flex items-center justify-center p-4 bg-[var(--surface-hover)] rounded">
 <img
 src={formData.logo}
 alt={formData.logoAlt || formData.name}
 className="max-w-full h-auto"
 style={{ maxHeight: '60px' }}
 />
 </div>
 )}

 {/* Color Preview */}
 <div className="space-y-3">
 <div>
 <p className="text-xs font-medium text-[var(--foreground-secondary)] mb-2">
 Primary
 </p>
 <div
 className="w-full h-12 rounded-lg border-2 border-[var(--border)]"
 style={{ backgroundColor: formData.primaryColor }}
 />
 </div>

 <div>
 <p className="text-xs font-medium text-[var(--foreground-secondary)] mb-2">
 Secondary
 </p>
 <div
 className="w-full h-12 rounded-lg border-2 border-[var(--border)]"
 style={{ backgroundColor: formData.secondaryColor }}
 />
 </div>

 <div>
 <p className="text-xs font-medium text-[var(--foreground-secondary)] mb-2">
 Accent
 </p>
 <div
 className="w-full h-12 rounded-lg border-2 border-[var(--border)]"
 style={{ backgroundColor: formData.accentColor || formData.primaryColor }}
 />
 </div>
 </div>

 {/* Brand Info */}
 <div className="pt-4 border-t border-[var(--border)]">
 <p className="text-sm font-semibold text-[var(--foreground)] mb-2">
 Brand Name
 </p>
 <p className="text-lg font-bold text-[var(--foreground)]">
 {formData.name}
 </p>
 </div>

 {/* Font Preview */}
 {formData.fontFamily && (
 <div className="pt-4 border-t border-[var(--border)]">
 <p className="text-xs font-medium text-[var(--foreground-secondary)] mb-2">
 Font Family
 </p>
 <Badge variant="info" size="sm">
 {formData.fontFamily}
 </Badge>
 </div>
 )}
 </Card.Body>
 </Card>
 </div>
 </div>
 </div>
 );
}
