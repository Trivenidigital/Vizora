/**
 * Template Library Seed Data — Upgraded Design
 * 75 templates across 7 categories with Google Fonts, rich gradients,
 * CSS Grid, box-shadows, pseudo-elements, and polished layouts.
 */

export interface TemplateSeed {
  name: string;
  description: string;
  category: string;
  libraryTags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  templateOrientation: 'landscape' | 'portrait' | 'both';
  duration: number;
  isFeatured?: boolean;
  seasonalStart?: string;
  seasonalEnd?: string;
  templateHtml: string;
  sampleData?: Record<string, any>;
}

// Re-export all template arrays from category modules
export { retailTemplates, restaurantTemplates } from './_retail-restaurant';
export { corporateTemplates, educationTemplates } from './_corporate-education';
export { healthcareTemplates, eventsTemplates } from './_healthcare-events';
export { generalTemplates } from './_general';

// Import for aggregation
import { retailTemplates, restaurantTemplates } from './_retail-restaurant';
import { corporateTemplates, educationTemplates } from './_corporate-education';
import { healthcareTemplates, eventsTemplates } from './_healthcare-events';
import { generalTemplates } from './_general';

// Combined array of all template seeds
export const allTemplateSeeds: TemplateSeed[] = [
  ...retailTemplates,
  ...restaurantTemplates,
  ...corporateTemplates,
  ...educationTemplates,
  ...healthcareTemplates,
  ...eventsTemplates,
  ...generalTemplates,
];

// Category summary for verification
export const categorySummary = {
  retail: retailTemplates.length,
  restaurant: restaurantTemplates.length,
  corporate: corporateTemplates.length,
  education: educationTemplates.length,
  healthcare: healthcareTemplates.length,
  events: eventsTemplates.length,
  general: generalTemplates.length,
  total: allTemplateSeeds.length,
};
