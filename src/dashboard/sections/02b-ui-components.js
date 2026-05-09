// ── Shared UI components (mockup-aligned design system v2) ───────────────────
// Returns HTML strings for composition by screen-level renderXxx functions.
// All components are stateless. Click handlers are passed as raw JS strings
// to match the existing onclick="..." pattern used across sections.
//
// Spec reference: see /public/CLAUDE_CODE_PROMPT.md (in repo root if present).
// Each component below maps 1:1 to a numbered item in that spec.

// Tiny helpers — esc may already exist via 02-helpers.js; alias defensively.
function _uiEsc(s){
  if(s==null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function _uiAttr(v){ return _uiEsc(v); }

// 1. Hero card. variant in {default,success,warning}. progress=null|0-100.
//    breakdown is optional [{label,value}] — used by Properties for Income−Costs=Profit row.
function renderHeroCard(opts){
  opts = opts || {};
  var variant = opts.variant || opts.gradient || 'default';
  var icon = opts.icon || '';
  var label = opts.label || '';
  var value = opts.value || '';
  var subtitle = opts.subtitle || '';
  var progress = (opts.progress === 0 || opts.progress) ? Math.max(0, Math.min(100, +opts.progress || 0)) : null;
  var breakdown = Array.isArray(opts.breakdown) ? opts.breakdown : null;
  var cls = 'hero-card' + (variant && variant !== 'default' ? ' hero-card--' + _uiAttr(variant) : '');
  var h = '<div class="' + cls + '">';
  h += '<div class="hero-card__overlay"></div>';
  if (icon || label) {
    h += '<div class="hero-card__icon-row">'
      +    (icon ? '<span class="hero-card__icon">' + icon + '</span>' : '')
      +    (label ? '<p class="hero-card__label">' + _uiEsc(label) + '</p>' : '')
      +  '</div>';
  }
  h += '<p class="hero-card__value">' + value + '</p>';
  if (subtitle) h += '<p class="hero-card__subtitle">' + subtitle + '</p>';
  if (progress !== null) {
    h += '<div class="hero-card__progress"><div class="hero-card__progress-fill" style="width:' + progress + '%"></div></div>';
  }
  if (breakdown && breakdown.length) {
    h += '<div class="hero-card__breakdown">';
    breakdown.forEach(function(b){
      h += '<div class="hero-card__breakdown-item">'
        +    '<span class="hero-card__breakdown-label">' + _uiEsc(b.label) + '</span>'
        +    '<span>' + (b.value || '') + '</span>'
        +  '</div>';
    });
    h += '</div>';
  }
  h += '</div>';
  return h;
}

// 2. Alert card. severity in {danger,warning}.
function renderAlertCard(opts){
  opts = opts || {};
  var severity = opts.severity || 'danger';
  var icon = opts.icon || '⚠';
  var title = opts.title || '';
  var subtitle = opts.subtitle || '';
  var click = opts.onClick || '';
  var clickAttr = click ? ' onclick="' + _uiAttr(click) + '"' : '';
  return '<button type="button" class="alert-card alert-card--' + _uiAttr(severity) + '"' + clickAttr + '>'
    +  '<div class="alert-card__icon-wrap">' + icon + '</div>'
    +  '<div class="alert-card__body">'
    +    '<p class="alert-card__title">' + _uiEsc(title) + '</p>'
    +    (subtitle ? '<p class="alert-card__subtitle">' + _uiEsc(subtitle) + '</p>' : '')
    +  '</div>'
    +  '<span class="alert-card__chevron">›</span>'
    + '</button>';
}

// 3. Stat row — pass an array of 3 items: [{label, value, color, subtitle, onClick}].
//    color in {default,teal,emerald,orange,red,blue,amber,dim}.
//    Optional onClick (JS string) makes the cell behave as a button — used
//    e.g. on Landlords > Pending to drill into pending payments.
function renderStatRow(stats){
  if (!Array.isArray(stats) || !stats.length) return '';
  var h = '<div class="stat-row">';
  stats.slice(0, 3).forEach(function(s){
    var color = s.color || 'default';
    var click = s.onClick || '';
    var clickAttr = click ? ' onclick="' + _uiAttr(click) + '" role="button" tabindex="0" style="cursor:pointer"' : '';
    h += '<div class="stat-row__cell"' + clickAttr + '>'
      +    '<p class="stat-row__label">' + _uiEsc(s.label || '') + '</p>'
      +    '<p class="stat-row__value stat-row__value--' + _uiAttr(color) + '">' + (s.value != null ? s.value : '—') + '</p>'
      +    (s.subtitle ? '<p class="stat-row__subtitle">' + _uiEsc(s.subtitle) + '</p>' : '')
      +  '</div>';
  });
  h += '</div>';
  return h;
}

// 4. Filter button. count = number of active filters; null/0 hides the badge.
function renderFilterButton(opts){
  opts = opts || {};
  var click = opts.onClick || '';
  var count = (opts.count == null) ? 0 : +opts.count;
  return '<button type="button" class="filter-button"' + (click ? ' onclick="' + _uiAttr(click) + '"' : '') + '>'
    +  '<span style="font-size:14px">⛶</span><span>Filter</span>'
    +  (count > 0 ? '<span class="filter-button__badge">' + count + '</span>' : '')
    + '</button>';
}

// 5. Active-filter chips row.
function renderActiveFilters(filters, onRemoveTpl){
  if (!Array.isArray(filters) || !filters.length) return '';
  // onRemoveTpl is a JS string template containing '%KEY%' replaced with the chip's id/value.
  var h = '<div class="active-filters">';
  filters.forEach(function(f){
    var k = f.key != null ? f.key : (f.value || f.label);
    var click = onRemoveTpl ? onRemoveTpl.replace(/%KEY%/g, _uiAttr(k)) : '';
    h += '<span class="active-filter-chip">'
      +    _uiEsc(f.label || f.value || k)
      +    (click ? ' <button onclick="' + _uiAttr(click) + '" aria-label="Remove">×</button>' : '')
      +  '</span>';
  });
  h += '</div>';
  return h;
}

// 6. Empty state.
function renderEmptyState(opts){
  opts = opts || {};
  var emoji = opts.emoji || '✨';
  var title = opts.title || 'Nothing here yet';
  var subtitle = opts.subtitle || '';
  var ctaLabel = opts.ctaLabel || '';
  var ctaClick = opts.ctaOnClick || '';
  return '<div class="empty-card">'
    +  '<div class="empty-card__emoji">' + emoji + '</div>'
    +  '<p class="empty-card__title">' + _uiEsc(title) + '</p>'
    +  (subtitle ? '<p class="empty-card__subtitle">' + _uiEsc(subtitle) + '</p>' : '')
    +  (ctaLabel ? '<button class="empty-card__cta" onclick="' + _uiAttr(ctaClick) + '">' + _uiEsc(ctaLabel) + '</button>' : '')
    + '</div>';
}

// 7. Floating action button. Mobile-only (hidden ≥1024px via CSS).
function renderFAB(opts){
  opts = opts || {};
  var icon = opts.icon || '+';
  var click = opts.onClick || '';
  var label = opts.label || 'Create';
  return '<button class="fab" type="button" aria-label="' + _uiAttr(label) + '"'
    + (click ? ' onclick="' + _uiAttr(click) + '"' : '') + '>' + icon + '</button>';
}

// 8. Screen header.
//    leftActions and rightActions are arrays of HTML strings (already-rendered buttons).
function renderScreenHeader(opts){
  opts = opts || {};
  var title = opts.title || '';
  var subtitle = opts.subtitle || '';
  var rightActions = Array.isArray(opts.rightActions) ? opts.rightActions : [];
  return '<div class="screen-header">'
    +  '<div class="screen-header__main">'
    +    '<h1 class="screen-header__title">' + _uiEsc(title) + '</h1>'
    +    (subtitle ? '<p class="screen-header__subtitle">' + subtitle + '</p>' : '')
    +  '</div>'
    +  (rightActions.length ? '<div class="screen-header__actions">' + rightActions.join('') + '</div>' : '')
    + '</div>';
}

// 9. Tabs. tabs = [{id,label,count?,icon?}], activeId, onChangeTpl with '%ID%'.
function renderTabs(opts){
  opts = opts || {};
  var tabs = Array.isArray(opts.tabs) ? opts.tabs : [];
  var activeId = opts.activeId;
  var tpl = opts.onChangeTpl || '';
  var h = '<div class="ui-tabs">';
  tabs.forEach(function(t){
    var active = String(t.id) === String(activeId);
    var click = tpl ? tpl.replace(/%ID%/g, _uiAttr(t.id)) : '';
    h += '<button type="button" class="ui-tab' + (active ? ' ui-tab--active' : '') + '"'
      + (click ? ' onclick="' + _uiAttr(click) + '"' : '') + '>'
      + (t.icon ? '<span>' + t.icon + '</span>' : '')
      + _uiEsc(t.label)
      + (t.count != null ? '<span class="ui-tab__count">' + t.count + '</span>' : '')
      + '</button>';
  });
  h += '</div>';
  return h;
}
