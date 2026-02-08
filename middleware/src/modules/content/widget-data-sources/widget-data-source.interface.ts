/**
 * Interface for widget data sources.
 *
 * Each widget type (weather, RSS, social, etc.) implements this interface
 * to provide a consistent API for fetching, configuring, and previewing
 * widget data within the content system.
 */
export interface WidgetDataSource {
  /** Unique type identifier for this data source (e.g., 'weather', 'rss') */
  type: string;

  /**
   * Fetch live data from the external source.
   * @param config - Widget-specific configuration (API keys, URLs, etc.)
   * @returns The fetched data shaped for template rendering
   */
  fetchData(config: Record<string, any>): Promise<Record<string, any>>;

  /**
   * Return the JSON schema describing valid configuration options.
   * Used for UI form generation and validation.
   */
  getConfigSchema(): Record<string, any>;

  /**
   * Return the default Handlebars template for this widget type.
   * This is rendered when no custom template is specified.
   */
  getDefaultTemplate(): string;

  /**
   * Return realistic sample data for previewing the widget
   * without making any external API calls.
   */
  getSampleData(): Record<string, any>;
}
