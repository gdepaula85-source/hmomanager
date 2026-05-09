// ── public listings i18n ─────────────────────────────────────────────────────
// Tiny in-page translation shim for the public /rooms.html vacancies page.
// Three locales: English (default), Portuguese (Brazil/Portugal compatible),
// Spanish. Switching language:
//   1. Updates every element with `data-i18n="key"` (textContent) or
//      `data-i18n-placeholder="key"` (placeholder)
//   2. Persists choice to localStorage as `pm_rooms_lang`
//   3. Re-runs any dynamic-text re-renders (rooms.js calls window.t() and the
//      onLangChange callback we register here).
//
// Keys are namespaced by section (hero, filter, modal, form, success, etc.)
// so it's easy to add another locale later without renaming.

(function(){
  var STR = {
    en: {
      'page.title':         'Available rooms',
      'hero.title':         'Our available Properties',
      'hero.sub':           'Quality properties — rooms, studios & whole houses. No agency fees. Book a FREE viewing today.',
      'hero.loading':       '🏠 Loading listings…',
      'hero.share':         '🔗 Share page',
      'hero.shareWa':       '💬 Share on WhatsApp',
      'filter.all':         'All Types',
      'filter.single':      '🛏 Single',
      'filter.double':      '🛏🛏 Double',
      'filter.suite':       '✨ Suite',
      'filter.studio':      '🏠 Studio',
      'filter.allAreas':    'All Areas',
      'grid.loading':       'Loading available listings…',
      'grid.empty':         'No listings match your filters',
      'load.error':         'Could not load listings',
      'modal.title':        '📅 Book a Viewing',
      'modal.sub':          'Tell us when you\'d like to visit',
      'form.name':          'Your Full Name *',
      'form.phone':         'WhatsApp / Phone *',
      'form.email':         'Email',
      'form.date':          'Preferred Viewing Date *',
      'form.time':          'Preferred Time',
      'form.notes':         'About You (optional)',
      'form.timeAny':       'Any time',
      'form.timeEvening':   'Evening (after 7 PM)',
      'form.namePh':        'e.g. Maria Santos',
      'form.phonePh':       'e.g. +44 7700 900000',
      'form.emailPh':       'maria@email.com',
      'form.notesPh':       'Employment, move-in date, questions…',
      'btn.cancel':         'Cancel',
      'btn.submit':         '📅 Request Viewing',
      'btn.sending':        'Sending…',
      'btn.close':          'Close',
      'success.title':      'Viewing Requested!',
      'footer.brand':       'Property listings',
      'listings.count_one': '{n} listing available',
      'listings.count_other': '{n} listings available',
      'wa.contact':         '💬 WhatsApp Us',
      'form.errorRequired': 'Please enter your name, phone, and preferred date.',
      'form.errorWaMissing':'WhatsApp is not configured for this page. Please use another way to contact the agent.'
    },
    pt: {
      'page.title':         'Quartos disponíveis',
      'hero.title':         'Nossas propriedades disponíveis',
      'hero.sub':           'Propriedades de qualidade — quartos, estúdios e casas inteiras. Sem taxas de agência. Reserve uma visita GRATUITA hoje.',
      'hero.loading':       '🏠 Carregando anúncios…',
      'hero.share':         '🔗 Partilhar página',
      'hero.shareWa':       '💬 Partilhar no WhatsApp',
      'filter.all':         'Todos os Tipos',
      'filter.single':      '🛏 Solteiro',
      'filter.double':      '🛏🛏 Casal',
      'filter.suite':       '✨ Suíte',
      'filter.studio':      '🏠 Estúdio',
      'filter.allAreas':    'Todas as Áreas',
      'grid.loading':       'Carregando anúncios disponíveis…',
      'grid.empty':         'Nenhum anúncio corresponde aos filtros',
      'load.error':         'Não foi possível carregar os anúncios',
      'modal.title':        '📅 Reserve uma Visita',
      'modal.sub':          'Diga-nos quando gostaria de visitar',
      'form.name':          'Nome Completo *',
      'form.phone':         'WhatsApp / Telefone *',
      'form.email':         'E-mail',
      'form.date':          'Data Preferida da Visita *',
      'form.time':          'Hora Preferida',
      'form.notes':         'Sobre Você (opcional)',
      'form.timeAny':       'Qualquer hora',
      'form.timeEvening':   'Noite (após 19h)',
      'form.namePh':        'ex. Maria Santos',
      'form.phonePh':       'ex. +351 91 234 5678',
      'form.emailPh':       'maria@email.com',
      'form.notesPh':       'Trabalho, data de mudança, dúvidas…',
      'btn.cancel':         'Cancelar',
      'btn.submit':         '📅 Solicitar Visita',
      'btn.sending':        'Enviando…',
      'btn.close':          'Fechar',
      'success.title':      'Visita Solicitada!',
      'footer.brand':       'Listagens de propriedades',
      'listings.count_one': '{n} anúncio disponível',
      'listings.count_other': '{n} anúncios disponíveis',
      'wa.contact':         '💬 Fale Conosco no WhatsApp',
      'form.errorRequired': 'Por favor, preencha o nome, telefone e data preferida.',
      'form.errorWaMissing':'O WhatsApp não está configurado para esta página. Use outro meio de contato.'
    },
    es: {
      'page.title':         'Habitaciones disponibles',
      'hero.title':         'Nuestras propiedades disponibles',
      'hero.sub':           'Propiedades de calidad — habitaciones, estudios y casas enteras. Sin comisión de agencia. Reserva una visita GRATIS hoy.',
      'hero.loading':       '🏠 Cargando anuncios…',
      'hero.share':         '🔗 Compartir página',
      'hero.shareWa':       '💬 Compartir por WhatsApp',
      'filter.all':         'Todos los Tipos',
      'filter.single':      '🛏 Individual',
      'filter.double':      '🛏🛏 Doble',
      'filter.suite':       '✨ Suite',
      'filter.studio':      '🏠 Estudio',
      'filter.allAreas':    'Todas las Zonas',
      'grid.loading':       'Cargando anuncios disponibles…',
      'grid.empty':         'Ningún anuncio coincide con los filtros',
      'load.error':         'No se pudieron cargar los anuncios',
      'modal.title':        '📅 Reservar una Visita',
      'modal.sub':          'Cuéntanos cuándo te gustaría visitar',
      'form.name':          'Tu Nombre Completo *',
      'form.phone':         'WhatsApp / Teléfono *',
      'form.email':         'Correo electrónico',
      'form.date':          'Fecha de Visita Preferida *',
      'form.time':          'Hora Preferida',
      'form.notes':         'Sobre Ti (opcional)',
      'form.timeAny':       'Cualquier hora',
      'form.timeEvening':   'Noche (después de 19h)',
      'form.namePh':        'ej. María Santos',
      'form.phonePh':       'ej. +34 612 345 678',
      'form.emailPh':       'maria@email.com',
      'form.notesPh':       'Trabajo, fecha de mudanza, preguntas…',
      'btn.cancel':         'Cancelar',
      'btn.submit':         '📅 Solicitar Visita',
      'btn.sending':        'Enviando…',
      'btn.close':          'Cerrar',
      'success.title':      '¡Visita Solicitada!',
      'footer.brand':       'Anuncios de propiedades',
      'listings.count_one': '{n} anuncio disponible',
      'listings.count_other': '{n} anuncios disponibles',
      'wa.contact':         '💬 Contáctanos por WhatsApp',
      'form.errorRequired': 'Por favor, indica tu nombre, teléfono y fecha preferida.',
      'form.errorWaMissing':'WhatsApp no está configurado para esta página. Usa otro medio de contacto.'
    }
  };

  // Sniff initial language: localStorage > browser language > English fallback.
  function detectLang(){
    try {
      var saved = localStorage.getItem('pm_rooms_lang');
      if (saved && STR[saved]) return saved;
    } catch(_e) {}
    var nav = (navigator.language || 'en').toLowerCase().slice(0, 2);
    return STR[nav] ? nav : 'en';
  }

  var _lang = detectLang();
  var _onChangeCallbacks = [];

  // Translate a key with optional {placeholder} substitution. Falls back to
  // English then to the key itself so a missing translation never renders blank.
  function t(key, vars){
    var str = (STR[_lang] && STR[_lang][key]) || (STR.en && STR.en[key]) || key;
    if (vars) {
      Object.keys(vars).forEach(function(k){
        str = str.replace('{' + k + '}', vars[k]);
      });
    }
    return str;
  }

  // Pluralisation helper for messages with a count. Falls through to _other
  // when the count is 0 or > 1, _one otherwise.
  function tn(baseKey, count){
    var suffix = (count === 1) ? '_one' : '_other';
    return t(baseKey + suffix, { n: count });
  }

  // Walk the DOM and translate every tagged element. Re-run after dynamic
  // re-renders by calling window.applyRoomsLang().
  function applyLang(){
    document.documentElement.lang = _lang;
    var allEls = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < allEls.length; i++){
      var el = allEls[i];
      var k = el.getAttribute('data-i18n');
      el.textContent = t(k);
    }
    var phEls = document.querySelectorAll('[data-i18n-placeholder]');
    for (var j = 0; j < phEls.length; j++){
      var pe = phEls[j];
      pe.placeholder = t(pe.getAttribute('data-i18n-placeholder'));
    }
    // Update <title> and meta description if tagged.
    var titleEl = document.querySelector('title[data-i18n]');
    if (titleEl) titleEl.textContent = t(titleEl.getAttribute('data-i18n'));
    // Highlight the active language pill
    var langBtns = document.querySelectorAll('[data-lang-btn]');
    for (var b = 0; b < langBtns.length; b++){
      var btn = langBtns[b];
      var on = btn.getAttribute('data-lang-btn') === _lang;
      btn.style.opacity = on ? '1' : '0.55';
      btn.style.outline = on ? '2px solid var(--accent, #14B8A6)' : 'none';
    }
    // Notify any registered callbacks (rooms.js re-renders the grid here).
    for (var c = 0; c < _onChangeCallbacks.length; c++){
      try { _onChangeCallbacks[c](_lang); } catch(_e){ console.warn('i18n cb failed:', _e); }
    }
  }

  function setLang(lang){
    if (!STR[lang]) return;
    _lang = lang;
    try { localStorage.setItem('pm_rooms_lang', lang); } catch(_e){}
    applyLang();
  }

  function getLang(){ return _lang; }

  function onLangChange(cb){
    if (typeof cb === 'function') _onChangeCallbacks.push(cb);
  }

  window.t = t;
  window.tn = tn;
  window.setRoomsLang = setLang;
  window.getRoomsLang = getLang;
  window.applyRoomsLang = applyLang;
  window.onRoomsLangChange = onLangChange;

  // Run after DOM ready so static `data-i18n` elements are translated on
  // first paint (rooms.js still calls applyRoomsLang() after dynamic injects).
  if (document.readyState !== 'loading') applyLang();
  else document.addEventListener('DOMContentLoaded', applyLang);
})();
