'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import type { SelectedElement } from './PropertyPanel';
import { TEMPLATE_WIDTH, TEMPLATE_HEIGHT } from './useCanvasZoom';

// ── Public API ────────────────────────────────────────────────────────────────

export interface CanvasHandle {
  sendUpdate: (elementId: string, property: string, value: string) => void;
  serialize: () => Promise<string>;
}

interface TemplateEditorCanvasProps {
  templateHtml: string;
  onElementSelected: (element: SelectedElement | null) => void;
  onReady: () => void;
  scale?: number;
  isScrollable?: boolean;
}

// ── Editor Runtime (inlined) ──────────────────────────────────────────────────
// This is the verbatim content of editor-runtime.js. It runs inside the iframe
// as a standalone IIFE and communicates with this component via postMessage.

const EDITOR_RUNTIME_CODE = `(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────

  var idCounter = 0;
  var selectedElement = null;
  var editingElement = null; // Currently in contenteditable mode

  var SELECT_COLOR = '#3B82F6';
  var SELECT_STYLE = '2px solid ' + SELECT_COLOR;
  var SELECT_OFFSET = '2px';
  var HOVER_COLOR = 'rgba(0, 229, 160, 0.5)';
  var HOVER_STYLE = '2px dashed ' + HOVER_COLOR;
  var EDIT_COLOR = '#00E5A0';
  var EDIT_STYLE = '2px solid ' + EDIT_COLOR;

  var TEXT_TAGS = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'span', 'li', 'td', 'th', 'a', 'label',
    'strong', 'em', 'b', 'i'
  ];

  var STYLE_PROPERTIES = [
    'color', 'fontSize', 'fontFamily', 'fontWeight', 'textAlign',
    'backgroundColor', 'backgroundImage', 'borderRadius', 'padding', 'objectFit'
  ];

  // ── Helpers ────────────────────────────────────────────────────────

  function sendToParent(data) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(data, '*');
    }
  }

  function assignEditorIds() {
    var elements = document.body.querySelectorAll('*');
    for (var i = 0; i < elements.length; i++) {
      if (!elements[i].hasAttribute('data-editor-id')) {
        elements[i].setAttribute('data-editor-id', 'e-' + idCounter);
        idCounter++;
      }
    }
  }

  function getElementById(editorId) {
    return document.querySelector('[data-editor-id="' + editorId + '"]');
  }

  // Find nearest ancestor (or self) with data-editable="true"
  function findEditableAncestor(el) {
    var current = el;
    while (current && current !== document.body && current !== document.documentElement) {
      if (current.getAttribute && current.getAttribute('data-editable') === 'true') {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  // ── Element Type Detection ─────────────────────────────────────────

  function detectElementType(el) {
    var tag = el.tagName.toLowerCase();
    if (tag === 'img') return 'image';

    var computed = window.getComputedStyle(el);
    var bgImage = computed.backgroundImage;
    if (bgImage && bgImage !== 'none' && el.children.length === 0) return 'image';

    if (TEXT_TAGS.indexOf(tag) !== -1) return 'text';

    var childNodes = el.childNodes;
    for (var i = 0; i < childNodes.length; i++) {
      if (childNodes[i].nodeType === Node.TEXT_NODE) {
        if (childNodes[i].textContent.trim().length > 0) return 'text';
      }
    }
    return 'container';
  }

  // ── Computed Styles ────────────────────────────────────────────────

  function getComputedStyles(el) {
    var computed = window.getComputedStyle(el);
    var styles = {};
    for (var i = 0; i < STYLE_PROPERTIES.length; i++) {
      var prop = STYLE_PROPERTIES[i];
      styles[prop] = computed[prop] || '';
    }
    return styles;
  }

  // ── Contenteditable ────────────────────────────────────────────────

  function exitContentEditable() {
    if (editingElement) {
      editingElement.contentEditable = 'false';
      editingElement.style.outline = SELECT_STYLE;
      editingElement.style.outlineOffset = SELECT_OFFSET;
      // Notify parent of text change
      sendToParent({
        type: 'text-changed',
        elementId: editingElement.getAttribute('data-editor-id'),
        textContent: editingElement.textContent || ''
      });
      editingElement = null;
    }
  }

  function enterContentEditable(el) {
    exitContentEditable();
    if (detectElementType(el) !== 'text') return;
    editingElement = el;
    el.contentEditable = 'true';
    el.style.outline = EDIT_STYLE;
    el.style.outlineOffset = SELECT_OFFSET;
    el.focus();
    // Select all text for easy replacement
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // ── Selection ──────────────────────────────────────────────────────

  function clearSelection() {
    exitContentEditable();
    if (selectedElement) {
      selectedElement.style.outline = '';
      selectedElement.style.outlineOffset = '';
      selectedElement.style.cursor = '';
      selectedElement = null;
    }
  }

  function selectElement(el) {
    exitContentEditable();
    if (selectedElement && selectedElement !== el) {
      selectedElement.style.outline = '';
      selectedElement.style.outlineOffset = '';
      selectedElement.style.cursor = '';
    }
    selectedElement = el;
    el.style.outline = SELECT_STYLE;
    el.style.outlineOffset = SELECT_OFFSET;

    var tag = el.tagName.toLowerCase();
    var rect = el.getBoundingClientRect();

    sendToParent({
      type: 'element-selected',
      elementId: el.getAttribute('data-editor-id'),
      elementType: detectElementType(el),
      tagName: tag,
      textContent: el.textContent ? el.textContent.substring(0, 500) : '',
      src: el.src || el.getAttribute('src') || '',
      styles: getComputedStyles(el),
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        right: rect.right
      }
    });
  }

  // ── Hover Indicators for Editable Elements ─────────────────────────

  function setupHoverIndicators() {
    var editables = document.querySelectorAll('[data-editable="true"]');
    for (var i = 0; i < editables.length; i++) {
      (function(el) {
        el.style.cursor = 'pointer';
        el.addEventListener('mouseenter', function() {
          if (el !== selectedElement && el !== editingElement) {
            el.style.outline = HOVER_STYLE;
            el.style.outlineOffset = '4px';
          }
        });
        el.addEventListener('mouseleave', function() {
          if (el !== selectedElement && el !== editingElement) {
            el.style.outline = '';
            el.style.outlineOffset = '';
          }
        });
      })(editables[i]);
    }
  }

  // ── Click Handler (capture phase) ─────────────────────────────────

  function handleClick(e) {
    var target = e.target;
    var tag = target.tagName.toLowerCase();

    // If currently editing, allow normal click behavior within that element
    if (editingElement && editingElement.contains(target)) {
      return; // Let contenteditable handle it
    }

    e.preventDefault();
    e.stopPropagation();

    // Clicking body or html deselects
    if (tag === 'body' || tag === 'html') {
      clearSelection();
      sendToParent({ type: 'element-deselected' });
      return;
    }

    // Find nearest editable ancestor
    var editable = findEditableAncestor(target);
    if (!editable) {
      // Clicked a non-editable element — deselect
      clearSelection();
      sendToParent({ type: 'element-deselected' });
      return;
    }

    // Ensure the editable target has an editor ID
    if (!editable.hasAttribute('data-editor-id')) {
      editable.setAttribute('data-editor-id', 'e-' + idCounter);
      idCounter++;
    }

    selectElement(editable);
  }

  // ── Double-Click Handler — enter contenteditable ───────────────────

  function handleDblClick(e) {
    var target = e.target;

    // Find nearest editable ancestor
    var editable = findEditableAncestor(target);
    if (!editable) return;

    e.preventDefault();
    e.stopPropagation();

    // Enter inline editing mode
    enterContentEditable(editable);
  }

  // ── Property Updates ───────────────────────────────────────────────

  function handlePropertyUpdate(data) {
    var el = getElementById(data.elementId);
    if (!el) return;

    var property = data.property;
    var value = data.value;

    if (property === 'textContent') {
      // If we're editing this element inline, exit first
      if (editingElement === el) exitContentEditable();
      el.textContent = value;
    } else if (property === 'src' && el.tagName.toLowerCase() === 'img') {
      el.src = value;
    } else {
      el.style[property] = value;
    }

    sendToParent({
      type: 'property-updated',
      elementId: data.elementId,
      styles: getComputedStyles(el)
    });
  }

  // ── DOM Serialization ──────────────────────────────────────────────

  function serialize() {
    // Exit any active editing first
    exitContentEditable();

    var clone = document.documentElement.cloneNode(true);

    // Remove all data-editor-id attributes
    var allElements = clone.querySelectorAll('[data-editor-id]');
    for (var i = 0; i < allElements.length; i++) {
      allElements[i].removeAttribute('data-editor-id');
    }

    // Clean up editor-injected inline styles
    var styledElements = clone.querySelectorAll('[style]');
    for (var j = 0; j < styledElements.length; j++) {
      var el = styledElements[j];
      var styleText = el.getAttribute('style') || '';

      // Remove outline, outlineOffset, and cursor set by editor
      if (styleText.indexOf(SELECT_COLOR) !== -1 ||
          styleText.indexOf(EDIT_COLOR) !== -1 ||
          styleText.indexOf('dashed') !== -1) {
        el.style.outline = '';
        el.style.outlineOffset = '';
      }
      if (styleText.indexOf('cursor') !== -1) {
        el.style.cursor = '';
      }
      // Remove contentEditable attribute
      el.removeAttribute('contenteditable');

      var remaining = (el.getAttribute('style') || '').trim();
      if (remaining === '' || remaining === ';') {
        el.removeAttribute('style');
      }
    }

    // Also clean contenteditable from non-styled elements
    var ceElements = clone.querySelectorAll('[contenteditable]');
    for (var c = 0; c < ceElements.length; c++) {
      ceElements[c].removeAttribute('contenteditable');
    }

    // Remove editor runtime script tags
    var scripts = clone.querySelectorAll('script[data-editor-runtime]');
    for (var k = 0; k < scripts.length; k++) {
      scripts[k].parentNode.removeChild(scripts[k]);
    }

    var html = '<!DOCTYPE html>\\n' + clone.outerHTML;
    sendToParent({ type: 'serialized', html: html });
  }

  // ── Message Listener ───────────────────────────────────────────────

  function handleMessage(e) {
    var data = e.data;
    if (!data || !data.type) return;

    switch (data.type) {
      case 'update-property':
        handlePropertyUpdate(data);
        break;
      case 'serialize':
        serialize();
        break;
    }
  }

  // ── Initialization ─────────────────────────────────────────────────

  document.addEventListener('click', handleClick, true);
  document.addEventListener('dblclick', handleDblClick, true);
  window.addEventListener('message', handleMessage, false);

  assignEditorIds();
  setupHoverIndicators();

  sendToParent({ type: 'editor-ready' });
})();`;

// ── Component ─────────────────────────────────────────────────────────────────

const TemplateEditorCanvas = forwardRef<CanvasHandle, TemplateEditorCanvasProps>(
  function TemplateEditorCanvas({ templateHtml, onElementSelected, onReady, scale = 1, isScrollable = false }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const serializeResolverRef = useRef<((html: string) => void) | null>(null);

    // ── Inject editor runtime into template HTML ──────────────────────

    const editorHtml = useMemo(() => {
      const scriptTag = `<script data-editor-runtime>${EDITOR_RUNTIME_CODE}<\/script>`;
      if (templateHtml.includes('</body>')) {
        return templateHtml.replace('</body>', scriptTag + '\n</body>');
      }
      // Fallback: append if no </body> tag found
      return templateHtml + scriptTag;
    }, [templateHtml]);

    // ── postMessage handler ───────────────────────────────────────────

    const handleMessage = useCallback(
      (event: MessageEvent) => {
        // Only accept messages from our iframe
        const iframe = iframeRef.current;
        if (!iframe || event.source !== iframe.contentWindow) return;

        const data = event.data;
        if (!data || typeof data.type !== 'string') return;

        switch (data.type) {
          case 'editor-ready':
            onReady();
            break;

          case 'element-selected': {
            const element: SelectedElement = {
              elementId: data.elementId,
              elementType: data.elementType,
              tagName: data.tagName,
              textContent: data.textContent ?? '',
              src: data.src ?? '',
              styles: data.styles ?? {},
              rect: data.rect ?? undefined,
            };
            onElementSelected(element);
            break;
          }

          case 'element-deselected':
            onElementSelected(null);
            break;

          case 'property-updated':
            // No-op — could update local state if needed
            break;

          case 'text-changed': {
            // Inline contenteditable text was changed — update parent state
            if (data.elementId && data.textContent !== undefined) {
              // Re-select the element to refresh property panel with new text
              const updatedElement: SelectedElement = {
                elementId: data.elementId,
                elementType: 'text',
                tagName: '',
                textContent: data.textContent ?? '',
                src: '',
                styles: {},
              };
              onElementSelected(updatedElement);
            }
            break;
          }

          case 'serialized':
            if (serializeResolverRef.current) {
              serializeResolverRef.current(data.html ?? '');
              serializeResolverRef.current = null;
            }
            break;
        }
      },
      [onElementSelected, onReady],
    );

    useEffect(() => {
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, [handleMessage]);

    // ── Imperative handle ─────────────────────────────────────────────

    useImperativeHandle(
      ref,
      () => ({
        sendUpdate(elementId: string, property: string, value: string) {
          const iframe = iframeRef.current;
          if (!iframe?.contentWindow) return;
          iframe.contentWindow.postMessage(
            { type: 'update-property', elementId, property, value },
            '*',
          );
        },

        serialize(): Promise<string> {
          return new Promise<string>((resolve, reject) => {
            const iframe = iframeRef.current;
            if (!iframe?.contentWindow) {
              reject(new Error('Editor iframe not available'));
              return;
            }

            // 5-second timeout — reject instead of resolving empty
            const timeout = setTimeout(() => {
              serializeResolverRef.current = null;
              reject(new Error('Editor serialize timed out — please try again'));
            }, 5000);

            serializeResolverRef.current = (html: string) => {
              clearTimeout(timeout);
              if (!html) {
                reject(new Error('Editor returned empty content'));
                return;
              }
              resolve(html);
            };

            iframe.contentWindow.postMessage({ type: 'serialize' }, '*');
          });
        },
      }),
      [],
    );

    // ── Render ────────────────────────────────────────────────────────

    const scaledW = TEMPLATE_WIDTH * scale;
    const scaledH = TEMPLATE_HEIGHT * scale;

    return (
      <div
        className={`relative w-full h-full bg-gray-900 rounded-xl border border-gray-700 ${
          isScrollable ? 'overflow-auto' : 'overflow-hidden'
        }`}
      >
        {/* Centering layer — flexbox center when fit, padding when scrollable */}
        <div
          className={
            isScrollable
              ? 'p-4'
              : 'flex items-center justify-center w-full h-full'
          }
        >
          {/* Scale box — tells layout engine the visual size */}
          <div
            style={{ width: scaledW, height: scaledH, flexShrink: 0 }}
            className="relative"
          >
            <iframe
              ref={iframeRef}
              srcDoc={editorHtml}
              style={{
                width: TEMPLATE_WIDTH,
                height: TEMPLATE_HEIGHT,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
              className="border-0 block"
              sandbox="allow-scripts"
              title="Template Editor"
            />
          </div>
        </div>
      </div>
    );
  },
);

export default TemplateEditorCanvas;
