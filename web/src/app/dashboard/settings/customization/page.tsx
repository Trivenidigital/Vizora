'use client';

import React, { useState } from 'react';
import { useCustomization } from '@/components/providers/CustomizationProvider';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import Button from '@/components/Button';

export const dynamic = 'force-dynamic';

export default function CustomizationPage() {
 const { brandConfig, updateBrandConfig } = useCustomization();
 const [formData, setFormData] = useState(brandConfig);
 const [saveSuccess, setSaveSuccess] = useState(false);

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

 return (
 <div className="space-y-6 max-w-4xl">
 {/* Header */}
 <div>
 <h2 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
 Brand Customization
 </h2>
 <p className="mt-2 text-neutral-600 dark:text-neutral-400">
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
 <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
 Brand Information
 </h3>
 </Card.Header>
 <Card.Body className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-50 mb-2">
 Brand Name
 </label>
 <input
 type="text"
 name="name"
 value={formData.name}
 onChange={handleInputChange}
 className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 placeholder="Your Brand Name"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-50 mb-2">
 Logo URL
 </label>
 <input
 type="url"
 name="logo"
 value={formData.logo || ''}
 onChange={handleInputChange}
 className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 placeholder="https://example.com/logo.png"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-50 mb-2">
 Logo Alt Text
 </label>
 <input
 type="text"
 name="logoAlt"
 value={formData.logoAlt || ''}
 onChange={handleInputChange}
 className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 placeholder="Logo description for accessibility"
 />
 </div>
 </Card.Body>
 </Card>

 {/* Colors */}
 <Card>
 <Card.Header>
 <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
 Brand Colors
 </h3>
 </Card.Header>
 <Card.Body className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-50 mb-2">
 Primary Color
 </label>
 <div className="flex gap-3 items-center">
 <input
 type="color"
 name="primaryColor"
 value={formData.primaryColor}
 onChange={handleInputChange}
 className="w-12 h-10 rounded cursor-pointer border border-neutral-300 dark:border-neutral-600"
 />
 <input
 type="text"
 value={formData.primaryColor}
 onChange={handleInputChange}
 disabled
 className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50"
 />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-50 mb-2">
 Secondary Color
 </label>
 <div className="flex gap-3 items-center">
 <input
 type="color"
 name="secondaryColor"
 value={formData.secondaryColor}
 onChange={handleInputChange}
 className="w-12 h-10 rounded cursor-pointer border border-neutral-300 dark:border-neutral-600"
 />
 <input
 type="text"
 value={formData.secondaryColor}
 onChange={handleInputChange}
 disabled
 className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50"
 />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-50 mb-2">
 Accent Color
 </label>
 <div className="flex gap-3 items-center">
 <input
 type="color"
 name="accentColor"
 value={formData.accentColor || formData.primaryColor}
 onChange={handleInputChange}
 className="w-12 h-10 rounded cursor-pointer border border-neutral-300 dark:border-neutral-600"
 />
 <input
 type="text"
 value={formData.accentColor || formData.primaryColor}
 onChange={handleInputChange}
 disabled
 className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50"
 />
 </div>
 </div>
 </Card.Body>
 </Card>

 {/* Display Settings */}
 <Card>
 <Card.Header>
 <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
 Display Settings
 </h3>
 </Card.Header>
 <Card.Body className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-50 mb-2">
 Font Family
 </label>
 <select
 name="fontFamily"
 value={formData.fontFamily || 'sans'}
 onChange={handleInputChange}
 className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
 className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
 />
 <label
 htmlFor="showPoweredBy"
 className="text-sm font-medium text-neutral-900 dark:text-neutral-50 cursor-pointer"
 >
 Show &quot;Powered by Vizora&quot; badge
 </label>
 </div>
 </Card.Body>
 </Card>

 {/* Custom Domain */}
 <Card>
 <Card.Header>
 <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
 Custom Domain
 </h3>
 </Card.Header>
 <Card.Body className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-50 mb-2">
 Custom Domain (Optional)
 </label>
 <input
 type="text"
 name="customDomain"
 value={formData.customDomain || ''}
 onChange={handleInputChange}
 className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 placeholder="example.com"
 />
 <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2">
 Configure DNS to point to our servers for white-label hosting
 </p>
 </div>
 </Card.Body>
 </Card>

 {/* Custom CSS */}
 <Card>
 <Card.Header>
 <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
 Custom CSS
 </h3>
 </Card.Header>
 <Card.Body className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-50 mb-2">
 Custom CSS Rules (Optional)
 </label>
 <textarea
 name="customCSS"
 value={formData.customCSS || ''}
 onChange={handleInputChange}
 rows={6}
 className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 placeholder=".navbar { background-color: #custom; }"
 />
 <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2">
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
 <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
 Preview
 </h3>
 </Card.Header>
 <Card.Body className="space-y-4">
 {/* Logo Preview */}
 {formData.logo && (
 <div className="flex items-center justify-center p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded">
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
 <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
 Primary
 </p>
 <div
 className="w-full h-12 rounded-lg border-2 border-neutral-200 dark:border-neutral-700"
 style={{ backgroundColor: formData.primaryColor }}
 />
 </div>

 <div>
 <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
 Secondary
 </p>
 <div
 className="w-full h-12 rounded-lg border-2 border-neutral-200 dark:border-neutral-700"
 style={{ backgroundColor: formData.secondaryColor }}
 />
 </div>

 <div>
 <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
 Accent
 </p>
 <div
 className="w-full h-12 rounded-lg border-2 border-neutral-200 dark:border-neutral-700"
 style={{ backgroundColor: formData.accentColor || formData.primaryColor }}
 />
 </div>
 </div>

 {/* Brand Info */}
 <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
 <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-2">
 Brand Name
 </p>
 <p className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
 {formData.name}
 </p>
 </div>

 {/* Font Preview */}
 {formData.fontFamily && (
 <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
 <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
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
