/* live-edit overlay — injected by the local proxy. */
(() => {
  if (window.__liveEditLoaded) return;
  window.__liveEditLoaded = true;

  let TOKEN = window.__LIVE_TOKEN;
  const host = document.createElement('div');
  host.id = '__live-host';
  host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647';
  document.documentElement.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });

  root.innerHTML = `
  <style>
    *{box-sizing:border-box;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif}
    .box{position:fixed;pointer-events:none;border-radius:4px;display:none}
    #hover{outline:1.5px dashed #6366f1;background:rgba(99,102,241,.06)}
    #sel{outline:2px solid #6366f1;background:rgba(99,102,241,.08);pointer-events:none}
    #tag{position:fixed;display:none;background:#6366f1;color:#fff;font-size:11px;font-weight:600;padding:2px 7px;border-radius:4px;pointer-events:none;white-space:nowrap;z-index:2147483640;box-shadow:0 2px 6px rgba(0,0,0,.25)}
    #dim{position:fixed;display:none;background:#0f172a;color:#93c5fd;font-size:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;padding:2px 6px;border-radius:4px;pointer-events:none;white-space:nowrap;border:1px solid #334155;z-index:2147483640}

    /* Interactive Resize handles */
    .handle{position:fixed;background:#ffffff;border:2.5px solid #6366f1;border-radius:50%;width:12px;height:12px;pointer-events:auto;display:none;z-index:2147483645;box-shadow:0 2px 6px rgba(0,0,0,.35)}
    .handle:hover{background:#6366f1;transform:scale(1.25);transition:transform .1s}
    #h-se{cursor:nwse-resize}
    #h-e{cursor:ew-resize}
    #h-s{cursor:ns-resize}

    /* Toolbars & Bars */
    .bar{position:fixed;pointer-events:auto;display:flex;gap:4px;padding:4px;background:#0f172a;border:1px solid #334155;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.5);z-index:2147483642}
    #tools{display:none;flex-wrap:wrap;max-width:92vw}
    button{all:unset;cursor:pointer;color:#e2e8f0;font-size:12px;font-weight:500;padding:5px 9px;border-radius:6px;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;transition:background .15s}
    button:hover{background:#1e293b;color:#ffffff}
    button.primary{background:#4f46e5;color:#ffffff;font-weight:600}button.primary:hover{background:#4338ca}
    button.accent{background:#0284c7;color:#ffffff;font-weight:600}button.accent:hover{background:#0369a1}
    button.danger:hover{background:#991b1b;color:#fee2e2}
    button.on{background:#334155;color:#38bdf8}

    #main{left:50%;bottom:18px;transform:translateX(-50%);align-items:center;padding:5px 8px}
    .sep{width:1px;background:#334155;margin:3px 2px}
    #count{color:#94a3b8;font-size:12px;padding:0 6px}
    #list{position:fixed;left:50%;bottom:64px;transform:translateX(-50%);width:380px;max-height:300px;overflow:auto;background:#0f172a;border:1px solid #334155;color:#cbd5e1;border-radius:10px;padding:8px;font-size:12px;display:none;pointer-events:auto;box-shadow:0 12px 36px rgba(0,0,0,.5);z-index:2147483644}
    #list div{padding:6px 8px;border-bottom:1px solid #1e293b}
    #result{position:fixed;right:16px;bottom:16px;width:380px;max-height:55vh;overflow:auto;background:#0f172a;border:1px solid #334155;color:#cbd5e1;border-radius:10px;padding:12px;font-size:12px;line-height:1.45;display:none;pointer-events:auto;box-shadow:0 12px 36px rgba(0,0,0,.5);z-index:2147483644}
    #result h4{margin:0 0 6px;font-size:12px;color:#fff;display:flex;justify-content:space-between;align-items:center}
    #result .ok{color:#86efac}#result .warn{color:#fcd34d}#result .mut{color:#94a3b8;word-break:break-all}
    #result div.row{padding:4px 0;border-top:1px solid #1e293b}
    #toast{position:fixed;left:50%;bottom:74px;transform:translateX(-50%);background:#0f172a;border:1px solid #475569;color:#fff;font-size:12px;padding:8px 14px;border-radius:8px;display:none;max-width:440px;box-shadow:0 8px 24px rgba(0,0,0,.4);z-index:2147483646}

    /* Popover Panels (Comment / Style / Size) */
    .popover{position:fixed;display:none;pointer-events:auto;background:#0f172a;border:1px solid #334155;border-radius:12px;padding:12px;box-shadow:0 16px 40px rgba(0,0,0,.6);z-index:2147483643;color:#e2e8f0;font-size:12px;width:320px}
    .popover h5{margin:0 0 8px;font-size:12px;color:#f8fafc;font-weight:600;display:flex;justify-content:space-between;align-items:center}
    .popover textarea{all:unset;box-sizing:border-box;width:100%;height:75px;background:#1e293b;border:1px solid #475569;border-radius:8px;padding:8px 10px;color:#ffffff;font-size:12px;line-height:1.4;margin-bottom:8px;resize:none}
    .popover textarea:focus{border-color:#6366f1}
    .popover-actions{display:flex;justify-content:flex-end;gap:6px}

    /* Style Picker Grid */
    .style-row{margin-bottom:10px}
    .style-row label{display:block;font-size:11px;color:#94a3b8;margin-bottom:4px;font-weight:500}
    .color-swatches{display:flex;gap:5px;flex-wrap:wrap}
    .swatch{width:22px;height:22px;border-radius:50%;border:2px solid #475569;cursor:pointer;padding:0;transition:transform .1s}
    .swatch:hover{transform:scale(1.2);border-color:#ffffff}
    .btn-group{display:flex;gap:4px;flex-wrap:wrap}
    .btn-group button{padding:3px 7px;font-size:11px;background:#1e293b;border:1px solid #334155;border-radius:5px}
    .btn-group button:hover{background:#334155}

    /* Visual Comment Pins attached to elements */
    .pin{position:fixed;pointer-events:auto;cursor:pointer;background:#f59e0b;color:#0f172a;font-weight:700;font-size:11px;padding:3px 8px;border-radius:12px;box-shadow:0 4px 12px rgba(245,158,11,.35);border:1.5px solid #ffffff;display:flex;align-items:center;gap:4px;z-index:2147483641;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:transform .15s}
    .pin:hover{background:#fbbf24;transform:scale(1.08)}
  </style>

  <div id="hover" class="box"></div>
  <div id="sel" class="box"></div>
  <div id="tag"></div>
  <div id="dim"></div>

  <!-- Resize handles -->
  <div id="h-se" class="handle" title="Drag to resize Width & Height"></div>
  <div id="h-e" class="handle" title="Drag to resize Width"></div>
  <div id="h-s" class="handle" title="Drag to resize Height"></div>

  <!-- Floating Selection Toolbar -->
  <div id="tools" class="bar"></div>

  <!-- Comment Popover Modal -->
  <div id="comment-pop" class="popover">
    <h5>💬 Add Comment for AI Agent <button id="close-comment" style="padding:0 4px;font-size:14px">✕</button></h5>
    <textarea id="comment-text" placeholder="Tell AI what to do with this element (e.g. 'Make font larger', 'Change background to dark slate', 'Add 20px padding', 'Move under header')..."></textarea>
    <div class="popover-actions">
      <button id="cancel-comment">Cancel</button>
      <button id="save-comment" class="primary">Add Comment</button>
    </div>
  </div>

  <!-- Quick Style Popover Modal -->
  <div id="style-pop" class="popover">
    <h5>🎨 Quick Visual Styling <button id="close-style" style="padding:0 4px;font-size:14px">✕</button></h5>
    <div class="style-row">
      <label>Background Color:</label>
      <div class="color-swatches" id="bg-swatches">
        <button class="swatch" style="background:transparent;border-style:dashed" title="Transparent" data-bg="transparent"></button>
        <button class="swatch" style="background:#ffffff" title="White" data-bg="#ffffff"></button>
        <button class="swatch" style="background:#0f172a" title="Dark Slate" data-bg="#0f172a"></button>
        <button class="swatch" style="background:#1e293b" title="Slate 800" data-bg="#1e293b"></button>
        <button class="swatch" style="background:#2563eb" title="Blue" data-bg="#2563eb"></button>
        <button class="swatch" style="background:#059669" title="Emerald" data-bg="#059669"></button>
        <button class="swatch" style="background:#dc2626" title="Red" data-bg="#dc2626"></button>
        <button class="swatch" style="background:#d97706" title="Amber" data-bg="#d97706"></button>
        <button class="swatch" style="background:#7c3aed" title="Purple" data-bg="#7c3aed"></button>
      </div>
    </div>
    <div class="style-row">
      <label>Text Color:</label>
      <div class="color-swatches" id="color-swatches">
        <button class="swatch" style="background:#ffffff" title="White" data-color="#ffffff"></button>
        <button class="swatch" style="background:#0f172a" title="Dark Slate" data-color="#0f172a"></button>
        <button class="swatch" style="background:#94a3b8" title="Slate 400" data-color="#94a3b8"></button>
        <button class="swatch" style="background:#38bdf8" title="Sky" data-color="#38bdf8"></button>
        <button class="swatch" style="background:#34d399" title="Green" data-color="#34d399"></button>
        <button class="swatch" style="background:#f87171" title="Rose" data-color="#f87171"></button>
      </div>
    </div>
    <div class="style-row">
      <label>Padding:</label>
      <div class="btn-group" id="padding-btns">
        <button data-pad="0px">None (0)</button>
        <button data-pad="6px 12px">Sm</button>
        <button data-pad="12px 18px">Md</button>
        <button data-pad="18px 24px">Lg</button>
        <button data-pad="24px 32px">Xl</button>
      </div>
    </div>
    <div class="style-row">
      <label>Border Radius:</label>
      <div class="btn-group" id="radius-btns">
        <button data-rad="0px">Square</button>
        <button data-rad="6px">Sm (6px)</button>
        <button data-rad="12px">Md (12px)</button>
        <button data-rad="20px">Lg (20px)</button>
        <button data-rad="9999px">Pill / Round</button>
      </div>
    </div>
  </div>

  <!-- Pins Layer for Comments -->
  <div id="pins-layer"></div>

  <!-- Change List & Results -->
  <div id="list"></div>
  <div id="result"></div>
  <div id="toast"></div>

  <!-- Main Bottom Bar -->
  <div id="main" class="bar">
    <button id="toggle" class="on">Live: on</button><span class="sep"></span>
    <button id="undo" title="Undo (Ctrl+Z)">Undo</button>
    <button id="cnt"><span id="count">0 changes</span></button><span class="sep"></span>
    <button id="save" class="primary" title="Save changes (Ctrl+S)">Save to code</button>
  </div>`;

  const $ = s => root.querySelector(s);
  const hoverBox = $('#hover'), selBox = $('#sel'), tagEl = $('#tag'), dimEl = $('#dim'), tools = $('#tools');
  const hSe = $('#h-se'), hE = $('#h-e'), hS = $('#h-s');
  const commentPop = $('#comment-pop'), commentText = $('#comment-text');
  const stylePop = $('#style-pop'), pinsLayer = $('#pins-layer');

  let on = true, hovered = null, selected = null, editing = null;
  const textChanges = new Map();   // key -> {old,new,selector,html}
  const ops = [];                  // structural changes (comment, resize, delete, reorder, style, duplicate, attr)
  const commentPins = [];          // { el, text, pinEl }
  const editedEls = new Set();
  const undoStack = [];
  const ids = new WeakMap(); let nextId = 1;
  const idOf = el => { if (!ids.has(el)) ids.set(el, nextId++); return ids.get(el); };
  const inUI = t => t === host || host.contains(t);

  // Resize state
  let isResizing = null;
  let resizeStart = { x: 0, y: 0, w: 0, h: 0, origWidthStyle: '', origHeightStyle: '' };

  function cssPath(el) {
    const parts = [];
    while (el && el.nodeType === 1 && el !== document.body && parts.length < 7) {
      if (el.id) { parts.unshift('#' + el.id); break; }
      let s = el.tagName.toLowerCase();
      const cls = [...el.classList].slice(0, 2).join('.');
      if (cls) s += '.' + cls;
      const sib = el.parentElement ? [...el.parentElement.children].filter(c => c.tagName === el.tagName) : [];
      if (sib.length > 1) s += `:nth-of-type(${sib.indexOf(el) + 1})`;
      parts.unshift(s); el = el.parentElement;
    }
    return parts.join(' > ');
  }
  const html = el => el.outerHTML.replace(/\s+/g, ' ').slice(0, 1800);
  const txt = el => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const label = el => el.tagName.toLowerCase() + ([...el.classList][0] ? '.' + [...el.classList][0] : '');
  const isButton = el => el.matches('button,[role=button],input[type=submit],input[type=button],a.btn,a[class*=button],a[class*=btn]');
  const directTexts = el => [...el.childNodes].filter(n => n.nodeType === 3 && n.nodeValue.trim()).map(n => n.nodeValue.trim().replace(/\s+/g, ' '));
  const meta = el => ({
    tag: el.tagName.toLowerCase(),
    text: txt(el),
    selector: cssPath(el),
    html: html(el),
    parentText: el.parentElement ? [...el.parentElement.children].slice(0, 6).map(txt) : []
  });

  function toast(msg, ms = 3500) {
    const t = $('#toast'); t.textContent = msg; t.style.display = 'block';
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.style.display = 'none'), ms);
  }

  // ---- drawing & frame loop ----
  function place(box, el) {
    if (!el || !el.isConnected) { box.style.display = 'none'; return; }
    const r = el.getBoundingClientRect();
    Object.assign(box.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  }

  function frame() {
    place(hoverBox, on && hovered !== selected ? hovered : null);
    place(selBox, selected);

    if (selected && selected.isConnected) {
      const r = selected.getBoundingClientRect();

      // Tag & Dimension pills
      tagEl.textContent = label(selected);
      tagEl.style.display = 'block';
      tagEl.style.left = Math.max(4, r.left) + 'px';
      tagEl.style.top = Math.max(4, r.top - 22) + 'px';

      dimEl.textContent = Math.round(r.width) + ' × ' + Math.round(r.height) + ' px';
      dimEl.style.display = 'block';
      dimEl.style.left = (r.right - dimEl.offsetWidth) + 'px';
      dimEl.style.top = Math.max(4, r.top - 22) + 'px';

      // Resize Handles
      hSe.style.display = 'block';
      hSe.style.left = (r.right - 6) + 'px';
      hSe.style.top = (r.bottom - 6) + 'px';

      hE.style.display = 'block';
      hE.style.left = (r.right - 6) + 'px';
      hE.style.top = (r.top + r.height / 2 - 6) + 'px';

      hS.style.display = 'block';
      hS.style.left = (r.left + r.width / 2 - 6) + 'px';
      hS.style.top = (r.bottom - 6) + 'px';

      // Tools Bar
      tools.style.display = 'flex';
      const tw = tools.offsetWidth;
      tools.style.left = Math.min(Math.max(8, r.left), innerWidth - tw - 8) + 'px';
      tools.style.top = (r.bottom + 48 > innerHeight ? Math.max(8, r.top - 62) : r.bottom + 10) + 'px';

      // Update position of popovers if open
      if (commentPop.style.display === 'block') {
        commentPop.style.left = Math.min(Math.max(8, r.left), innerWidth - 330) + 'px';
        commentPop.style.top = (r.bottom + 210 > innerHeight ? Math.max(10, r.top - 180) : r.bottom + 12) + 'px';
      }
      if (stylePop.style.display === 'block') {
        stylePop.style.left = Math.min(Math.max(8, r.left), innerWidth - 330) + 'px';
        stylePop.style.top = (r.bottom + 260 > innerHeight ? Math.max(10, r.top - 230) : r.bottom + 12) + 'px';
      }
    } else {
      tagEl.style.display = 'none';
      dimEl.style.display = 'none';
      tools.style.display = 'none';
      hSe.style.display = 'none';
      hE.style.display = 'none';
      hS.style.display = 'none';
    }

    // Keep comment pins updated to their element positions
    for (const p of commentPins) {
      if (p.el && p.el.isConnected) {
        const pr = p.el.getBoundingClientRect();
        p.pinEl.style.display = 'flex';
        p.pinEl.style.left = Math.max(4, pr.left + 4) + 'px';
        p.pinEl.style.top = Math.max(4, pr.top - 10) + 'px';
      } else {
        p.pinEl.style.display = 'none';
      }
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---- selection ----
  function select(el) {
    if (editing) commitEdit();
    selected = el;
    commentPop.style.display = 'none';
    stylePop.style.display = 'none';
    buildTools();
  }

  function buildTools() {
    tools.innerHTML = '';
    if (!selected) return;

    const add = (name, fn, cls = '', title = '') => {
      const b = document.createElement('button');
      b.textContent = name;
      if (cls) b.className = cls;
      if (title) b.title = title;
      b.onclick = e => { e.stopPropagation(); fn(); };
      tools.appendChild(b);
    };

    add('Edit text', startEdit, '', 'Double-click or click to edit text inline');
    add('💬 Comment', openComment, 'accent', 'Add instruction or feedback for AI agent');
    add('🎨 Style', openStyle, '', 'Quick background, color, and padding tweaks');

    // Hierarchy traversal
    add('Parent ↑', () => selected.parentElement && selected.parentElement !== document.documentElement && select(selected.parentElement), '', 'Select parent container');
    add('Child ↓', () => selected.firstElementChild && select(selected.firstElementChild), '', 'Select first child element');

    // Reorder siblings
    if (selected.previousElementSibling) {
      add('↑ Move Up', () => moveSibling('up'), '', 'Swap with previous sibling');
    }
    if (selected.nextElementSibling) {
      add('↓ Move Down', () => moveSibling('down'), '', 'Swap with next sibling');
    }

    add('Duplicate', duplicate, '', 'Clone this element / card');
    if (isButton(selected)) add(isDisabled(selected) ? 'Enable' : 'Disable', toggleDisabled);
    add('Delete', del, 'danger', 'Delete element');
  }

  document.addEventListener('mousemove', e => { if (on && !inUI(e.target) && !isResizing) hovered = e.target; }, true);
  document.addEventListener('click', e => {
    if (!on || inUI(e.target)) return;
    if (editing && editing.contains(e.target)) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if (e.target === document.documentElement || e.target === document.body) return select(null);
    select(e.target);
  }, true);
  document.addEventListener('dblclick', e => { if (on && !inUI(e.target)) { e.preventDefault(); select(e.target); startEdit(); } }, true);
  document.addEventListener('submit', e => { if (on) e.preventDefault(); }, true);

  // ---- Interactive Resizing ----
  function initResize(handleType, e) {
    if (!selected) return;
    e.preventDefault(); e.stopPropagation();
    isResizing = handleType;
    const r = selected.getBoundingClientRect();
    resizeStart = {
      x: e.clientX,
      y: e.clientY,
      w: r.width,
      h: r.height,
      origWidthStyle: selected.style.width,
      origHeightStyle: selected.style.height
    };
    window.addEventListener('pointermove', onResizeMove, true);
    window.addEventListener('pointerup', onResizeEnd, { once: true, capture: true });
  }

  function onResizeMove(e) {
    if (!isResizing || !selected) return;
    e.preventDefault(); e.stopPropagation();
    const dx = e.clientX - resizeStart.x;
    const dy = e.clientY - resizeStart.y;

    if (isResizing === 'se' || isResizing === 'e') {
      const newW = Math.max(24, Math.round(resizeStart.w + dx));
      selected.style.width = newW + 'px';
    }
    if (isResizing === 'se' || isResizing === 's') {
      const newH = Math.max(20, Math.round(resizeStart.h + dy));
      selected.style.height = newH + 'px';
    }
  }

  function onResizeEnd(e) {
    window.removeEventListener('pointermove', onResizeMove, true);
    if (!isResizing || !selected) { isResizing = null; return; }
    const r = selected.getBoundingClientRect();
    const newW = Math.round(r.width);
    const newH = Math.round(r.height);
    const prevW = resizeStart.origWidthStyle;
    const prevH = resizeStart.origHeightStyle;
    const el = selected;

    const op = {
      type: 'resize',
      width: newW,
      height: newH,
      oldWidth: Math.round(resizeStart.w),
      oldHeight: Math.round(resizeStart.h),
      ...meta(el)
    };
    ops.push(op);

    undoStack.push(() => {
      el.style.width = prevW;
      el.style.height = prevH;
      const idx = ops.indexOf(op);
      if (idx > -1) ops.splice(idx, 1);
    });

    isResizing = null;
    refresh();
    toast(`Resized to ${newW} × ${newH} px. Press Save to code when ready.`);
  }

  hSe.addEventListener('pointerdown', e => initResize('se', e));
  hE.addEventListener('pointerdown', e => initResize('e', e));
  hS.addEventListener('pointerdown', e => initResize('s', e));

  // ---- Comment Tool ----
  function openComment() {
    if (!selected) return;
    stylePop.style.display = 'none';
    commentText.value = '';
    commentPop.style.display = 'block';
    setTimeout(() => commentText.focus(), 50);
  }
  $('#close-comment').onclick = () => { commentPop.style.display = 'none'; };
  $('#cancel-comment').onclick = () => { commentPop.style.display = 'none'; };
  $('#save-comment').onclick = submitComment;
  commentText.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submitComment(); }
    if (e.key === 'Escape') { commentPop.style.display = 'none'; }
    e.stopPropagation();
  });

  function submitComment() {
    const val = commentText.value.trim();
    if (!val || !selected) return;
    const el = selected;
    commentPop.style.display = 'none';

    const op = {
      type: 'comment',
      comment: val,
      ...meta(el)
    };
    ops.push(op);

    // Create visual badge pin
    const pin = document.createElement('div');
    pin.className = 'pin';
    pin.innerHTML = `💬 <span>${esc(val.slice(0, 32))}${val.length > 32 ? '…' : ''}</span>`;
    pin.title = `Comment: "${val}" (Click to select element)`;
    pin.onclick = (e) => { e.stopPropagation(); select(el); };
    pinsLayer.appendChild(pin);
    const pinObj = { el, text: val, pinEl: pin };
    commentPins.push(pinObj);

    undoStack.push(() => {
      pin.remove();
      const pi = commentPins.indexOf(pinObj);
      if (pi > -1) commentPins.splice(pi, 1);
      const oi = ops.indexOf(op);
      if (oi > -1) ops.splice(oi, 1);
    });

    refresh();
    toast('💬 Comment added! AI Agent will process this instruction upon Save.');
  }

  // ---- Style Tool ----
  function openStyle() {
    if (!selected) return;
    commentPop.style.display = 'none';
    stylePop.style.display = stylePop.style.display === 'block' ? 'none' : 'block';
  }
  $('#close-style').onclick = () => { stylePop.style.display = 'none'; };

  function applyStyleProp(prop, val) {
    if (!selected) return;
    const el = selected;
    const prevVal = el.style[prop];
    el.style[prop] = val;

    const op = {
      type: 'style',
      property: prop,
      value: val,
      oldValue: prevVal,
      ...meta(el)
    };
    ops.push(op);

    undoStack.push(() => {
      el.style[prop] = prevVal;
      const oi = ops.indexOf(op);
      if (oi > -1) ops.splice(oi, 1);
    });

    refresh();
    toast(`Applied ${prop}: ${val}`);
  }

  // Style swatches event listeners
  $('#bg-swatches').onclick = e => {
    const btn = e.target.closest('button');
    if (btn && btn.dataset.bg) applyStyleProp('backgroundColor', btn.dataset.bg);
  };
  $('#color-swatches').onclick = e => {
    const btn = e.target.closest('button');
    if (btn && btn.dataset.color) applyStyleProp('color', btn.dataset.color);
  };
  $('#padding-btns').onclick = e => {
    const btn = e.target.closest('button');
    if (btn && btn.dataset.pad) applyStyleProp('padding', btn.dataset.pad);
  };
  $('#radius-btns').onclick = e => {
    const btn = e.target.closest('button');
    if (btn && btn.dataset.rad) applyStyleProp('borderRadius', btn.dataset.rad);
  };

  // ---- Reorder Sibling Tool ----
  function moveSibling(direction) {
    if (!selected || !selected.parentElement) return;
    const el = selected;
    const parent = el.parentElement;

    if (direction === 'up') {
      const prev = el.previousElementSibling;
      if (!prev) return;
      parent.insertBefore(el, prev);
    } else {
      const next = el.nextElementSibling;
      if (!next) return;
      parent.insertBefore(next, el);
    }

    const op = { type: 'reorder', direction, ...meta(el) };
    ops.push(op);

    undoStack.push(() => {
      moveSibling(direction === 'up' ? 'down' : 'up');
      const idx = ops.indexOf(op);
      if (idx > -1) ops.splice(idx, 1);
    });

    buildTools();
    refresh();
    toast(`Moved ${direction}`);
  }

  // ---- text editing ----
  function startEdit() {
    const el = selected; if (!el) return;
    const texts = directTexts(el);
    if (!texts.length) return toast('No text here — use Child ↓ to pick the element holding the text.');
    if (!el.__liveOrig) el.__liveOrig = texts;
    editing = el; el.__before = texts;
    el.contentEditable = 'true'; el.focus();
    const rng = document.createRange(); rng.selectNodeContents(el);
    const s = getSelection(); s.removeAllRanges(); s.addRange(rng);
    el.addEventListener('keydown', editKeys); el.addEventListener('paste', pastePlain);
    el.addEventListener('blur', commitEdit, { once: true });
  }
  const editKeys = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); editing && editing.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); editing.__cancel = true; editing.blur(); }
    e.stopPropagation();
  };
  const pastePlain = e => { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); };
  function commitEdit() {
    const el = editing; if (!el) return; editing = null;
    el.removeEventListener('keydown', editKeys); el.removeEventListener('paste', pastePlain);
    el.removeAttribute('contenteditable');
    const orig = el.__liveOrig, before = el.__before, cur = directTexts(el);
    if (el.__cancel) { el.__cancel = false; revertTexts(el, before); return; }
    const key0 = String(idOf(el)), prefix = key0 + ':';
    const prev = [...textChanges].filter(([k]) => k.startsWith(prefix));
    prev.forEach(([k]) => textChanges.delete(k));
    editedEls.add(el);
    const base = { selector: cssPath(el), html: html(el), ctx: context(el, orig.concat(cur)) };
    if (cur.length === orig.length) {
      cur.forEach((t, i) => { if (t !== orig[i]) textChanges.set(prefix + i, { old: orig[i], new: t, ...base }); });
    } else {
      const a = orig.join(' ').split(/\s+/), b = cur.join(' ').split(/\s+/);
      let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++;
      let s = 0; while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
      let lo = p, ao = a.length - s, bo = b.length - s;
      if (lo === ao) { if (lo > 0) lo--; else if (ao < a.length) { ao++; bo++; } }
      const o = a.slice(lo, ao).join(' '), n = b.slice(lo, bo).join(' ');
      if (o && o !== n) textChanges.set(prefix + 'span', { old: o, new: n, ...base });
    }
    undoStack.push(() => {
      revertTexts(el, before);
      [...textChanges.keys()].filter(k => k.startsWith(prefix)).forEach(k => textChanges.delete(k));
      prev.forEach(([k, v]) => textChanges.set(k, v));
    });
    refresh();
  }
  function revertTexts(el, texts) {
    const nodes = [...el.childNodes].filter(n => n.nodeType === 3 && n.nodeValue.trim());
    if (nodes.length === texts.length) nodes.forEach((n, i) => { n.nodeValue = texts[i]; });
    else if (!el.children.length) el.textContent = texts.join(' ');
  }
  function context(el, own) {
    let p = el.parentElement, depth = 0;
    while (p && p !== document.body && depth < 5) {
      const leaves = [...p.querySelectorAll('*')].filter(n => n !== el && directTexts(n).length);
      if (leaves.length >= 2) {
        const out = [];
        for (const n of leaves) for (const t of directTexts(n)) if (t.length > 2 && t.length < 140 && !own.includes(t) && !out.includes(t)) out.push(t);
        return out.slice(0, 10);
      }
      p = p.parentElement; depth++;
    }
    return [];
  }

  // ---- structural ops ----
  function duplicate() {
    const el = selected; if (!el || !el.parentElement) return;
    const clone = el.cloneNode(true);
    el.after(clone);
    const op = { type: 'duplicate', ...meta(el) }; ops.push(op);
    undoStack.push(() => { clone.remove(); ops.splice(ops.indexOf(op), 1); select(el); });
    select(clone); refresh(); toast('Card duplicated. Edit its text, then Save.');
  }
  function del() {
    const el = selected; if (!el || !el.parentElement) return;
    const prevDisplay = el.style.display;
    const op = { type: 'delete', ...meta(el) }; ops.push(op);
    el.style.display = 'none';
    el.setAttribute('data-live-deleted', 'true');
    select(null);
    undoStack.push(() => {
      el.style.display = prevDisplay;
      el.removeAttribute('data-live-deleted');
      ops.splice(ops.indexOf(op), 1);
      select(el);
    });
    refresh();
  }
  const isDisabled = el => el.disabled === true || el.getAttribute('aria-disabled') === 'true';
  function toggleDisabled() {
    const el = selected; const now = !isDisabled(el);
    const apply = v => { if ('disabled' in el) el.disabled = v; el.setAttribute('aria-disabled', String(v)); el.style.opacity = v ? '.5' : ''; };
    apply(now);
    const op = { type: 'attr', name: 'disabled', value: now, ...meta(el) }; ops.push(op);
    undoStack.push(() => { apply(!now); ops.splice(ops.indexOf(op), 1); buildTools(); });
    buildTools(); refresh();
  }

  // ---- change list / save ----
  function refresh() {
    const n = textChanges.size + ops.length;
    $('#count').textContent = n + (n === 1 ? ' change' : ' changes');
    const list = $('#list');
    list.innerHTML = [...textChanges.values()].map(c => `<div>text: “${esc(c.old)}” → “${esc(c.new)}”</div>`)
      .concat(ops.map(o => {
        if (o.type === 'comment') return `<div>💬 <b>Comment:</b> "${esc(o.comment)}" on &lt;${o.tag}&gt;</div>`;
        if (o.type === 'resize') return `<div>↔ <b>Resize:</b> ${o.width}×${o.height}px (&lt;${o.tag}&gt;)</div>`;
        if (o.type === 'style') return `<div>🎨 <b>Style:</b> ${o.property}=${esc(o.value)} (&lt;${o.tag}&gt;)</div>`;
        if (o.type === 'reorder') return `<div>⇅ <b>Move ${o.direction}:</b> &lt;${o.tag}&gt;</div>`;
        return `<div>${o.type}: &lt;${o.tag}&gt; ${esc(o.text.slice(0, 40))}${o.type === 'attr' ? ' (' + o.name + '=' + o.value + ')' : ''}</div>`;
      })).join('') || '<div>No pending changes</div>';
    buildTools();
  }
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  async function save() {
    if (editing) commitEdit();
    if (!textChanges.size && !ops.length) return toast('Nothing to save.');
    try {
      let curToken = TOKEN || window.__LIVE_TOKEN;
      let r = await fetch('/__live/save', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-live-token': curToken },
        body: JSON.stringify({ edits: [...textChanges.values()], ops, page: location.pathname })
      });
      let d = await r.json();
      if (d.error === 'bad token' || r.status === 403) {
        // Auto-heal token on server restart
        try {
          const tr = await fetch('/__live/token');
          const td = await tr.json();
          if (td.token) {
            TOKEN = td.token;
            window.__LIVE_TOKEN = td.token;
            r = await fetch('/__live/save', {
              method: 'POST', headers: { 'content-type': 'application/json', 'x-live-token': TOKEN },
              body: JSON.stringify({ edits: [...textChanges.values()], ops, page: location.pathname })
            });
            d = await r.json();
          }
        } catch {}
      }
      if (d.error) throw new Error(d.error);
      showResult(d);
      try { sessionStorage.setItem('__liveLast', JSON.stringify({ d, t: Date.now() })); } catch {}
      textChanges.clear(); ops.length = 0; undoStack.length = 0;
      editedEls.forEach(el => { if (el.isConnected) el.__liveOrig = directTexts(el); });
      editedEls.clear();
      refresh();
    } catch (e) { showResult({ error: e.message }); }
  }

  function showResult(d) {
    const el = $('#result');
    const head = (t) => `<h4><span>${t}</span><button id="rx">✕</button></h4>`;
    let h;
    if (d.error) {
      h = head('Save failed') + `<div class="warn">${esc(d.error)}</div><div class="mut">Is <code>npm run live</code> still running in your terminal?</div>`;
    } else {
      h = head(`${d.applied.length} written to source · ${d.queued.length} queued`);
      h += d.applied.map(a => `<div class="row"><span class="ok">✓</span> ${esc(a.file)}:${a.line}<div class="mut">“${esc(a.old)}” → “${esc(a.new)}”</div></div>`).join('');
      h += d.queued.map(q => {
        let label = q.type;
        if (q.type === 'comment') label = `💬 Comment: "${q.comment || ''}"`;
        if (q.type === 'resize') label = `↔ Resize: ${q.width}×${q.height}px`;
        return `<div class="row"><span class="warn">⚠ ${esc(label)}${q.reason ? ' — ' + esc(q.reason) : ''}</span><div class="mut">${q.old != null ? '“' + esc(q.old) + '”' : '&lt;' + esc(q.tag || '') + '&gt; ' + esc((q.text || '').slice(0, 60))}${q.candidates && q.candidates.length ? '<br>candidates: ' + esc(q.candidates.join(', ')) : ''}</div></div>`;
      }).join('');
      if (d.queued.length) h += `<div class="row warn">Queued items are sent to your AI Agent! In Antigravity simply prompt: <b>apply live-edit changes</b></div>`;
      if (!d.applied.length && d.queued.some(q => q.reason === 'notfound')) h += `<div class="row mut">Searched ${d.scanned} files in ${esc(d.root)}.</div>`;
    }
    el.innerHTML = h; el.style.display = 'block';
    el.querySelector('#rx').onclick = () => { el.style.display = 'none'; try { sessionStorage.removeItem('__liveLast'); } catch {} };
  }
  try { const s = JSON.parse(sessionStorage.getItem('__liveLast') || 'null'); if (s && Date.now() - s.t < 120000) showResult(s.d); } catch {}

  $('#save').onclick = save;
  $('#undo').onclick = () => { const f = undoStack.pop(); if (f) { f(); refresh(); } };
  $('#cnt').onclick = () => { const l = $('#list'); l.style.display = l.style.display === 'block' ? 'none' : 'block'; };
  $('#toggle').onclick = e => {
    on = !on; e.target.textContent = 'Live: ' + (on ? 'on' : 'off');
    e.target.classList.toggle('on', on);
    if (!on) { select(null); hovered = null; }
  };
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !editing) { e.preventDefault(); $('#undo').click(); }
    if (e.key === 'Escape' && !editing) {
      if (commentPop.style.display === 'block') commentPop.style.display = 'none';
      else if (stylePop.style.display === 'block') stylePop.style.display = 'none';
      else select(null);
    }
  }, true);
  refresh();
})();
