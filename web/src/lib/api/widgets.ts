// Widget & Layout API methods

import type {
  WidgetType, Widget, LayoutPreset, LayoutZone, Layout, ResolvedLayout,
} from '../types';
import { ApiClient } from './client';

declare module './client' {
  interface ApiClient {
    getWidgetTypes(): Promise<WidgetType[]>;
    createWidget(data: { name: string; widgetType: string; widgetConfig?: Record<string, unknown>; description?: string }): Promise<Widget>;
    updateWidget(id: string, data: Partial<Widget>): Promise<Widget>;
    refreshWidget(id: string): Promise<Widget>;
    getLayoutPresets(): Promise<LayoutPreset[]>;
    createLayout(data: { name: string; layoutType: string; zones?: LayoutZone[]; description?: string }): Promise<Layout>;
    updateLayout(id: string, data: Partial<Layout>): Promise<Layout>;
    getResolvedLayout(id: string): Promise<ResolvedLayout>;
  }
}

ApiClient.prototype.getWidgetTypes = async function (): Promise<WidgetType[]> {
  return this.request<WidgetType[]>('/content/widgets/types');
};

ApiClient.prototype.createWidget = async function (data: { name: string; widgetType: string; widgetConfig?: Record<string, unknown>; description?: string }): Promise<Widget> {
  return this.request<Widget>('/content/widgets', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.updateWidget = async function (id: string, data: Partial<Widget>): Promise<Widget> {
  return this.request<Widget>(`/content/widgets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.refreshWidget = async function (id: string): Promise<Widget> {
  return this.request<Widget>(`/content/widgets/${id}/refresh`, {
    method: 'POST',
  });
};

ApiClient.prototype.getLayoutPresets = async function (): Promise<LayoutPreset[]> {
  return this.request<LayoutPreset[]>('/content/layouts/presets');
};

ApiClient.prototype.createLayout = async function (data: { name: string; layoutType: string; zones?: LayoutZone[]; description?: string }): Promise<Layout> {
  return this.request<Layout>('/content/layouts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.updateLayout = async function (id: string, data: Partial<Layout>): Promise<Layout> {
  return this.request<Layout>(`/content/layouts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.getResolvedLayout = async function (id: string): Promise<ResolvedLayout> {
  return this.request<ResolvedLayout>(`/content/layouts/${id}/resolved`);
};
