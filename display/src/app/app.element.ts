import './app.element.css';

/**
 * WARNING: This component is for development only and should not interfere
 * with the Electron display client. The actual display logic is handled
 * by renderer/app.ts and the HTML from renderer/index.html.
 *
 * This custom element is disabled to prevent it from hijacking the DOM.
 */
export class AppElement extends HTMLElement {
  public static observedAttributes = [];

  connectedCallback() {
    console.log('[AppElement] Custom element loaded (disabled)');
    // Do nothing - let the actual display app handle everything
    // The renderer process loads from index.html which has the proper UI
  }
}
// Register the element but it won't interfere since connectedCallback does nothing
customElements.define('vizora-root', AppElement);
