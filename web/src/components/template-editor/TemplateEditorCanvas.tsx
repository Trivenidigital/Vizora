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

// ── Public API ────────────────────────────────────────────────────────────────

export interface CanvasHandle {
  sendUpdate: (elementId: string, property: string, value: string) => void;
  serialize: () => Promise<string>;
}

interface TemplateEditorCanvasProps {
  templateHtml: string;
  onElementSelected: (element: SelectedElement | null) => void;
  onReady: () => void;
}

// ── Editor Runtime (inlined) ──────────────────────────────────────────────────
// This is the verbatim content of editor-runtime.js. It runs inside the iframe
// as a standalone IIFE and communicates with this component via postMessage.

const EDITOR_RUNTIME_CODE = `(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────

  var idCounter = 0;
  var selectedElement = null;

  var OUTLINE_COLOR = '#3B82F6';
  var OUTLINE_STYLE = '2px solid ' + OUTLINE_COLOR;
  var OUTLINE_OFFSET = '2px';

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

  // ── Element Type Detection ─────────────────────────────────────────

  function detectElementType(el) {
    var tag = el.tagName.toLowerCase();

    // Image tag
    if (tag === 'img') {
      return 'image';
    }

    // Element with background-image and no child elements
    var computed = window.getComputedStyle(el);
    var bgImage = computed.backgroundImage;
    if (bgImage && bgImage !== 'none' && el.children.length === 0) {
      return 'image';
    }

    // Known text tags
    if (TEXT_TAGS.indexOf(tag) !== -1) {
      return 'text';
    }

    // Element with direct text node children (non-whitespace)
    var childNodes = el.childNodes;
    for (var i = 0; i < childNodes.length; i++) {
      if (childNodes[i].nodeType === Node.TEXT_NODE) {
        var text = childNodes[i].textContent.trim();
        if (text.length > 0) {
          return 'text';
        }
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

  // ── Selection ──────────────────────────────────────────────────────

  function clearSelection() {
    if (selectedElement) {
      selectedElement.style.outline = '';
      selectedElement.style.outlineOffset = '';
      selectedElement = null;
    }
  }

  function selectElement(el) {
    clearSelection();
    selectedElement = el;
    el.style.outline = OUTLINE_STYLE;
    el.style.outlineOffset = OUTLINE_OFFSET;

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

  // ── Click Handler (capture phase) ─────────────────────────────────

  function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();

    var target = e.target;
    var tag = target.tagName.toLowerCase();

    // Clicking body or html deselects
    if (tag === 'body' || tag === 'html') {
      clearSelection();
      sendToParent({ type: 'element-deselected' });
      return;
    }

    // Ensure the target has an editor ID
    if (!target.hasAttribute('data-editor-id')) {
      target.setAttribute('data-editor-id', 'e-' + idCounter);
      idCounter++;
    }

    selectElement(target);
  }

  // ── Property Updates ───────────────────────────────────────────────

  function handlePropertyUpdate(data) {
    var el = getElementById(data.elementId);
    if (!el) return;

    var property = data.property;
    var value = data.value;

    if (property === 'textContent') {
      el.textContent = value;
    } else if (property === 'src' && el.tagName.toLowerCase() === 'img') {
      el.src = value;
    } else {
      el.style[property] = value;
    }

    // Re-read styles after the update and notify parent
    sendToParent({
      type: 'property-updated',
      elementId: data.elementId,
      styles: getComputedStyles(el)
    });
  }

  // ── DOM Serialization ──────────────────────────────────────────────

  function serialize() {
    var clone = document.documentElement.cloneNode(true);

    // Remove all data-editor-id attributes
    var allElements = clone.querySelectorAll('[data-editor-id]');
    for (var i = 0; i < allElements.length; i++) {
      allElements[i].removeAttribute('data-editor-id');
    }

    // Remove editor outline styles (look for the highlight color)
    var styledElements = clone.querySelectorAll('[style]');
    for (var j = 0; j < styledElements.length; j++) {
      var el = styledElements[j];
      var styleText = el.getAttribute('style') || '';

      // Remove outline properties that contain our editor color
      if (styleText.indexOf(OUTLINE_COLOR) !== -1) {
        el.style.outline = '';
        el.style.outlineOffset = '';
      }

      // Remove empty style attributes
      var remaining = (el.getAttribute('style') || '').trim();
      if (remaining === '' || remaining === ';') {
        el.removeAttribute('style');
      }
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
  window.addEventListener('message', handleMessage, false);

  assignEditorIds();

  sendToParent({ type: 'editor-ready' });
})();`;

// ── Component ─────────────────────────────────────────────────────────────────

const TemplateEditorCanvas = forwardRef<CanvasHandle, TemplateEditorCanvasProps>(
  function TemplateEditorCanvas({ templateHtml, onElementSelected, onReady }, ref) {
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
          return new Promise<string>((resolve) => {
            const iframe = iframeRef.current;
            if (!iframe?.contentWindow) {
              resolve('');
              return;
            }

            // 5-second timeout fallback
            const timeout = setTimeout(() => {
              serializeResolverRef.current = null;
              resolve('');
            }, 5000);

            serializeResolverRef.current = (html: string) => {
              clearTimeout(timeout);
              resolve(html);
            };

            iframe.contentWindow.postMessage({ type: 'serialize' }, '*');
          });
        },
      }),
      [],
    );

    // ── Render ────────────────────────────────────────────────────────

    return (
      <div className="relative w-full h-full bg-gray-900 rounded-xl overflow-hidden border border-gray-700">
        <iframe
          ref={iframeRef}
          srcDoc={editorHtml}
          className="w-full h-full border-0"
          sandbox="allow-scripts"
          title="Template Editor"
        />
      </div>
    );
  },
);

export default TemplateEditorCanvas;
