import { Extension } from "@tiptap/core";
import type { EditorView } from "@tiptap/pm/view";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  deepEqualIterative,
  footerClickEvent,
  getFooter,
  getFooterHeight,
  getHeader,
  getHeaderHeight,
  getHeight,
  headerClickEvent,
  updateCssVariables,
} from "tiptap-pagination-plus/dist/utils";
import type { PaginationPlusOptions } from "tiptap-pagination-plus";

/**
 * Paginated pages for the document studio.
 *
 * The stock plugin reads layout inside every transaction, before paint. That
 * blocks scrolling and inserts blank pages from half-finished measurements.
 * This copy only measures after paint, and only when the document, the page
 * setup, or the paper's height actually changed.
 */

const PAGE_COUNT_META = "PAGE_COUNT_META_KEY";
const paginationKey = new PluginKey("pagination");

type PageConfig = {
  enabled: boolean;
  pageBreakBackground: string;
  pageHeight: number;
  pageWidth: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  pageGap: number;
  contentMarginTop: number;
  contentMarginBottom: number;
  footerRight: string;
  footerLeft: string;
  headerRight: string;
  headerLeft: string;
  customHeader: PaginationPlusOptions["customHeader"];
  customFooter: PaginationPlusOptions["customFooter"];
  pageGapBorderSize: number;
  pageGapBorderColor: string;
  onHeaderClick?: PaginationPlusOptions["onHeaderClick"];
  onFooterClick?: PaginationPlusOptions["onFooterClick"];
};

const defaultConfig: PageConfig = {
  enabled: true,
  pageBreakBackground: "#ffffff",
  pageHeight: 800,
  pageWidth: 789,
  marginTop: 20,
  marginBottom: 20,
  marginLeft: 50,
  marginRight: 50,
  pageGap: 50,
  contentMarginTop: 10,
  contentMarginBottom: 10,
  footerRight: "{page}",
  footerLeft: "",
  headerRight: "",
  headerLeft: "",
  customHeader: {},
  customFooter: {},
  pageGapBorderSize: 1,
  pageGapBorderColor: "#e5e5e5",
};

function pageConfigFrom(source: Partial<PageConfig> | undefined): PageConfig {
  return { ...defaultConfig, ...source };
}

function configChanged(storage: PageConfig, applied: PageConfig) {
  return (
    storage.enabled !== applied.enabled ||
    storage.pageBreakBackground !== applied.pageBreakBackground ||
    storage.pageHeight !== applied.pageHeight ||
    storage.pageWidth !== applied.pageWidth ||
    storage.marginTop !== applied.marginTop ||
    storage.marginBottom !== applied.marginBottom ||
    storage.marginLeft !== applied.marginLeft ||
    storage.marginRight !== applied.marginRight ||
    storage.pageGap !== applied.pageGap ||
    storage.contentMarginTop !== applied.contentMarginTop ||
    storage.contentMarginBottom !== applied.contentMarginBottom ||
    storage.headerLeft !== applied.headerLeft ||
    storage.headerRight !== applied.headerRight ||
    storage.footerLeft !== applied.footerLeft ||
    storage.footerRight !== applied.footerRight ||
    !deepEqualIterative(applied.customHeader, storage.customHeader) ||
    !deepEqualIterative(applied.customFooter, storage.customFooter)
  );
}

function existingPageCount(view: EditorView) {
  const pages = view.dom.querySelector("[data-rm-pagination]");
  return pages?.children.length ?? 0;
}

/** Canvas zoom is a CSS transform, so viewport rects are scaled. Layout math stays in page pixels. */
function viewScale(view: EditorView) {
  const host = view.dom.closest("[data-doc-zoom]");
  const scale = host ? Number(host.getAttribute("data-doc-zoom")) : 1;
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

/** Distance from the last content edge to the last page break. */
function contentGap(view: EditorView) {
  const pages = view.dom.querySelector("[data-rm-pagination]");
  const lastBreak = pages?.lastElementChild?.querySelector(".breaker");
  const lastBlock = view.dom.lastElementChild;
  if (!lastBreak || !lastBlock || lastBlock === pages) return 0;
  let contentBottom = lastBlock.getBoundingClientRect().bottom;
  const extra = view.dom.querySelectorAll(
    'figure.document-image[data-wrap="left"], figure.document-image[data-wrap="right"], figure.document-image[data-placed="true"]',
  );
  extra.forEach((node) => {
    contentBottom = Math.max(contentBottom, node.getBoundingClientRect().bottom);
  });
  const breakBottom = lastBreak.getBoundingClientRect().bottom;
  if (contentBottom === 0 && breakBottom === 0) return 0;
  return (contentBottom - breakBottom) / viewScale(view);
}

/** Two layout reads. Avoids walking every page break on each keystroke. */
function nextPageCount(view: EditorView, options: PageConfig, contentHeight: number) {
  if (!options.enabled) return { count: 0, gap: 0 };
  const slot = Math.max(1, contentHeight);
  const pages = view.dom.querySelector("[data-rm-pagination]");
  const current = existingPageCount(view);
  if (!pages) {
    return { count: Math.max(1, Math.ceil(view.dom.scrollHeight / slot)), gap: view.dom.scrollHeight };
  }
  const gap = contentGap(view);
  // One page at a time. A formatting-context box that has fallen below the
  // page floats reports a huge gap; adding every missing page at once makes
  // that fall further and fills the document with blank sheets.
  if (gap > 1) return { count: current + 1, gap };
  const spare = Math.floor(-gap / slot);
  if (spare > 0) return { count: Math.max(1, current - spare), gap };
  return { count: Math.max(1, current), gap };
}

function refreshPaper(target: HTMLElement, enabled: boolean) {
  const pages = target.querySelector("[data-rm-pagination]");
  if (!enabled) {
    target.setAttribute("rm-pagination-disabled", "");
    target.style.minHeight = "auto";
    return;
  }
  target.removeAttribute("rm-pagination-disabled");
  const lastBreak = pages?.lastElementChild?.querySelector(".breaker");
  if (lastBreak instanceof HTMLElement) {
    target.style.minHeight = `calc(${lastBreak.offsetTop + lastBreak.offsetHeight}px + 2px)`;
  }
}

function createDecoration(
  options: PageConfig,
  headerHeight: Map<number, number>,
  footerHeight: Map<number, number>,
  pageCount: number,
) {
  if (!options.enabled) return [];
  const header = { headerLeft: options.headerLeft, headerRight: options.headerRight };
  const footer = { footerLeft: options.footerLeft, footerRight: options.footerRight };
  const pageWidget = Decoration.widget(
    0,
    () => {
      const el = document.createElement("div");
      el.dataset.rmPagination = "true";
      el.id = "pages";
      el.classList.add("rm-pages-wrapper");
      const baseHeader = headerHeight.get(0) || 0;
      const baseFooter = footerHeight.get(0) || 0;
      const count = Math.max(1, pageCount);
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < count; i += 1) {
        const pageNumber = i + 1;
        const headerPage = i + 2;
        const custom =
          headerPage in options.customHeader ||
          pageNumber in options.customFooter ||
          pageNumber in options.customHeader;
        const headerOptions = custom
          ? options.customHeader[headerPage] || header
          : header;
        const footerOptions = custom ? options.customFooter[pageNumber] || footer : footer;
        const pageHeaderHeight = custom
          ? headerHeight.get(headerPage) || baseHeader
          : baseHeader;
        const pageFooterHeight = custom
          ? footerHeight.get(pageNumber) || baseFooter
          : baseFooter;
        fragment.appendChild(
          pageBreak(
            options,
            i === 0,
            getHeader(
              headerOptions.headerRight,
              headerOptions.headerLeft,
              headerClickEvent(headerPage, options.onHeaderClick),
              custom ? headerPage : undefined,
            ),
            getFooter(
              footerOptions.footerRight,
              footerOptions.footerLeft,
              footerClickEvent(pageNumber, options.onFooterClick),
              custom ? pageNumber : undefined,
            ),
            pageHeaderHeight,
            pageFooterHeight,
            custom ? pageNumber : undefined,
          ),
        );
      }
      el.append(fragment);
      return el;
    },
    { side: -1, key: `pages-${pageCount}` },
  );
  const firstHeader = Decoration.widget(
    0,
    () => {
      const optionsForFirst = options.customHeader[1] || header;
      const el = getHeader(
        optionsForFirst.headerRight,
        optionsForFirst.headerLeft,
        headerClickEvent(1, options.onHeaderClick),
      );
      el.classList.add("rm-first-page-header");
      return el;
    },
    { side: -1 },
  );
  return [pageWidget, firstHeader];
}

function pageBreak(
  options: PageConfig,
  firstPage: boolean,
  pageHeader: HTMLElement,
  pageFooter: HTMLElement,
  headerHeight: number,
  footerHeight: number,
  pageNumber?: number,
) {
  const { _pageHeaderHeight, _pageHeight } = getHeight(options, headerHeight, footerHeight);
  const pageContainer = document.createElement("div");
  pageContainer.classList.add("rm-page-break");
  const page = document.createElement("div");
  page.classList.add("page");
  page.style.position = "relative";
  page.style.float = "left";
  page.style.clear = "both";
  const marginTop = firstPage
    ? `calc(${_pageHeaderHeight}px + ${_pageHeight}px)`
    : `${_pageHeight}px`;
  page.style.marginTop = pageNumber
    ? `var(--rm-page-content-${pageNumber}, ${marginTop})`
    : firstPage
      ? `var(--rm-page-content-first, ${marginTop})`
      : `var(--rm-page-content-general, ${marginTop})`;
  const breaker = document.createElement("div");
  breaker.classList.add("breaker");
  breaker.style.width = "calc(100% + var(--rm-margin-left) + var(--rm-margin-right))";
  breaker.style.marginLeft = "calc(-1 * var(--rm-margin-left))";
  breaker.style.marginRight = "calc(-1 * var(--rm-margin-right))";
  breaker.style.position = "relative";
  breaker.style.float = "left";
  breaker.style.clear = "both";
  breaker.style.zIndex = "2";
  const gap = document.createElement("div");
  gap.classList.add("rm-pagination-gap");
  gap.style.height = `${options.pageGap}px`;
  gap.style.borderLeft = "1px solid";
  gap.style.borderRight = "1px solid";
  gap.style.position = "relative";
  gap.style.setProperty("width", "calc(100% + 2px)", "important");
  gap.style.left = "-1px";
  gap.style.backgroundColor = options.pageBreakBackground;
  gap.style.borderLeftColor = options.pageBreakBackground;
  gap.style.borderRightColor = options.pageBreakBackground;
  breaker.append(pageFooter, gap, pageHeader);
  pageContainer.append(page, breaker);
  return pageContainer;
}

const paginationCss = `
.rm-pagination-gap{
  border-top: 1px solid;
  border-bottom: 1px solid;
  border-color: var(--rm-page-gap-border-color);
}
.rm-with-pagination,
.rm-with-pagination .rm-first-page-header {
  counter-reset: page-number page-number-plus 1;
}
.rm-with-pagination .rm-page-break {
  counter-increment: page-number page-number-plus;
}
.rm-with-pagination .rm-page-break:last-child .rm-pagination-gap,
.rm-with-pagination .rm-page-break:last-child .rm-page-header {
  display: none;
}
.rm-with-pagination .rm-br-decoration {
  display: table;
  width: 100%;
}
.rm-with-pagination .rm-page-footer-left,
.rm-with-pagination .rm-page-header-left {
  float: left;
  margin-left: var(--rm-margin-left);
}
.rm-with-pagination .rm-page-footer-right,
.rm-with-pagination .rm-page-header-right {
  float: right;
  margin-right: var(--rm-margin-right);
}
.rm-with-pagination .rm-first-page-header .rm-page-header-right { margin-right: 0 !important; }
.rm-with-pagination .rm-first-page-header .rm-page-header-left { margin-left: 0 !important; }
.rm-with-pagination .rm-page-number::before { content: counter(page-number); }
.rm-with-pagination .rm-page-number-plus::before { content: counter(page-number-plus); }
.rm-with-pagination .rm-page-header,
.rm-with-pagination .rm-page-footer { width: 100%; }
.rm-with-pagination .rm-page-header {
  padding-bottom: var(--rm-content-margin-top) !important;
  padding-top: var(--rm-margin-top) !important;
  display: inline-flex;
  justify-content: space-between;
}
.rm-with-pagination .rm-page-footer {
  padding-top: var(--rm-content-margin-bottom) !important;
  padding-bottom: var(--rm-margin-bottom) !important;
  display: inline-flex;
  justify-content: space-between;
}
.rm-with-pagination[rm-pagination-disabled] {
  padding-top: var(--rm-margin-top) !important;
  padding-bottom: var(--rm-margin-bottom) !important;
}
`;

export const StudioPagination = Extension.create<PageConfig>({
  name: "PaginationPlus",
  addOptions() {
    return { ...defaultConfig };
  },
  addStorage() {
    return {
      ...defaultConfig,
      headerHeight: new Map<number, number>(),
      footerHeight: new Map<number, number>(),
      appliedConfig: { ...defaultConfig },
      targetPageCount: 1,
      pendingCheck: true,
    };
  },
  onCreate() {
    const config = pageConfigFrom(this.options);
    const target = this.editor.view.dom;
    target.classList.add("rm-with-pagination");
    target.style.border = "1px solid var(--rm-page-gap-border-color)";
    target.style.paddingLeft = "var(--rm-margin-left)";
    target.style.paddingRight = "var(--rm-margin-right)";
    target.style.width = "var(--rm-page-width)";
    updateCssVariables(target, config);
    if (!document.head.querySelector("style[data-studio-pagination]")) {
      const style = document.createElement("style");
      style.dataset.studioPagination = "";
      style.textContent = paginationCss;
      document.head.appendChild(style);
    }
    refreshPaper(target, config.enabled);
  },
  addProseMirrorPlugins() {
    const editor = this.editor;
    const storage = this.storage;
    const options = this.options;
    const decorate = (doc: import("@tiptap/pm/model").Node, config: PageConfig) =>
      DecorationSet.create(
        doc,
        createDecoration(
          config,
          storage.headerHeight,
          storage.footerHeight,
          storage.targetPageCount,
        ),
      );
    return [
      new Plugin({
        key: paginationKey,
        state: {
          init: (_, state) => {
            const config = pageConfigFrom(options);
            Object.assign(storage, config, {
              headerHeight: new Map<number, number>(),
              footerHeight: new Map<number, number>(),
              appliedConfig: { ...config },
              targetPageCount: 1,
              pendingCheck: true,
            });
            return { decorations: decorate(state.doc, config) };
          },
          apply: (tr, old, _prev, state) => {
            const config = pageConfigFrom({ ...options, ...storage });
            if (!storage.enabled && !storage.appliedConfig.enabled) return old;
            const scheduled = Boolean(tr.getMeta(PAGE_COUNT_META));
            const changed = configChanged(config, storage.appliedConfig);
            if (!scheduled && !changed) {
              if (!tr.docChanged) return old;
              storage.pendingCheck = true;
              return { decorations: old.decorations.map(tr.mapping, tr.doc) };
            }
            if (editor.view.dom.isConnected) updateCssVariables(editor.view.dom, config);
            storage.appliedConfig = { ...config };
            storage.pendingCheck = true;
            return { decorations: decorate(state.doc, config) };
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)?.decorations;
          },
        },
        view: (editorView) => {
          let frame = 0;
          let ignoreResize = false;
          const measure = () => {
            frame = 0;
            if (!editorView.dom.isConnected || editorView.isDestroyed) return;
            const config = pageConfigFrom({ ...options, ...storage });
            if (!config.enabled) {
              refreshPaper(editorView.dom, false);
              return;
            }
            const measuredHeader = getHeaderHeight(editorView.dom, [], "content").get(0) ?? 0;
            const measuredFooter = getFooterHeight(editorView.dom, [], "content").get(0) ?? 0;
            storage.headerHeight.set(0, measuredHeader);
            storage.footerHeight.set(0, measuredFooter);
            const headerHeight = measuredHeader;
            const footerHeight = measuredFooter;
            const { _pageHeaderHeight, _pageHeight } = getHeight(config, headerHeight, footerHeight);
            editorView.dom.style.setProperty(
              "--rm-page-content-first",
              `${_pageHeight + _pageHeaderHeight}px`,
            );
            editorView.dom.style.setProperty("--rm-page-content-general", `${_pageHeight}px`);
            const layout = nextPageCount(editorView, config, _pageHeight);
            const current = existingPageCount(editorView);
            const count = Math.min(layout.count, 80);
            if (count !== current) {
              if (storage.targetPageCount !== count) {
                storage.targetPageCount = count;
                storage.pendingCheck = true;
                editorView.dispatch(editorView.state.tr.setMeta(PAGE_COUNT_META, true));
              }
              return;
            }
            storage.targetPageCount = current;
            ignoreResize = true;
            refreshPaper(editorView.dom, true);
            requestAnimationFrame(() => {
              ignoreResize = false;
            });
          };
          const schedule = () => {
            if (frame) return;
            frame = requestAnimationFrame(measure);
          };
          const observer = new ResizeObserver(() => {
            if (ignoreResize) return;
            schedule();
          });
          observer.observe(editorView.dom);
          schedule();
          return {
            update: (view, prev) => {
              const pending = storage.pendingCheck;
              storage.pendingCheck = false;
              const config = pageConfigFrom({ ...options, ...storage });
              if (
                !pending &&
                view.state.doc.eq(prev.doc) &&
                !configChanged(config, storage.appliedConfig)
              ) {
                return;
              }
              schedule();
            },
            destroy: () => {
              cancelAnimationFrame(frame);
              observer.disconnect();
            },
          };
        },
      }),
      new Plugin({
        key: new PluginKey("brDecoration"),
        state: {
          init: (_, state) => breakDecorations(state.doc),
          apply: (tr, old) => (tr.docChanged ? breakDecorations(tr.doc) : old),
        },
        props: {
          decorations(state) {
            return this.getState(state) ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
  addCommands() {
    return {
      updatePageBreakBackground: (color: string) => () => {
        this.storage.pageBreakBackground = color;
        return true;
      },
      updatePageSize: (size: {
        pageHeight: number;
        pageWidth: number;
        marginTop: number;
        marginBottom: number;
        marginLeft: number;
        marginRight: number;
      }) => () => {
        this.storage.pageHeight = size.pageHeight;
        this.storage.pageWidth = size.pageWidth;
        this.storage.marginTop = size.marginTop;
        this.storage.marginBottom = size.marginBottom;
        this.storage.marginLeft = size.marginLeft;
        this.storage.marginRight = size.marginRight;
        return true;
      },
      updatePageWidth: (width: number) => () => {
        this.storage.pageWidth = width;
        return true;
      },
      updatePageHeight: (height: number) => () => {
        this.storage.pageHeight = height;
        return true;
      },
      updatePageGap: (gap: number) => () => {
        this.storage.pageGap = gap;
        return true;
      },
      updateMargins: (margins: { top: number; bottom: number; left: number; right: number }) => () => {
        this.storage.marginTop = margins.top;
        this.storage.marginBottom = margins.bottom;
        this.storage.marginLeft = margins.left;
        this.storage.marginRight = margins.right;
        return true;
      },
      updateContentMargins: (margins: { top: number; bottom: number }) => () => {
        this.storage.contentMarginTop = margins.top;
        this.storage.contentMarginBottom = margins.bottom;
        return true;
      },
      updateHeaderContent: (left: string, right: string, pageNumber?: number) => () => {
        if (pageNumber) {
          this.storage.customHeader = {
            ...this.storage.customHeader,
            [pageNumber]: { headerLeft: left, headerRight: right },
          };
        } else {
          this.storage.headerLeft = left;
          this.storage.headerRight = right;
        }
        return true;
      },
      updateFooterContent: (left: string, right: string, pageNumber?: number) => () => {
        if (pageNumber) {
          this.storage.customFooter = {
            ...this.storage.customFooter,
            [pageNumber]: { footerLeft: left, footerRight: right },
          };
        } else {
          this.storage.footerLeft = left;
          this.storage.footerRight = right;
        }
        return true;
      },
      togglePagination: () => () => {
        this.storage.enabled = !this.storage.enabled;
        return true;
      },
      enablePagination: () => () => {
        this.storage.enabled = true;
        return true;
      },
      disablePagination: () => () => {
        this.storage.enabled = false;
        return true;
      },
    };
  },
});

function breakDecorations(doc: import("@tiptap/pm/model").Node) {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "hardBreak") return;
    decorations.push(
      Decoration.widget(pos + 1, () => {
        const el = document.createElement("span");
        el.classList.add("rm-br-decoration");
        return el;
      }),
    );
  });
  return DecorationSet.create(doc, decorations);
}
