(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const t = (key, values) => window.ROR_I18N.t(key, values);
  const cards = window.PHOTO_CARDS || [];
  const localize = (id, key, values = {}) => { const element = $(id); element.dataset.i18nValue = key; element.dataset.i18nValues = JSON.stringify(values); element.textContent = t(key, values); if (id === 'question') window.ROR_DESIGN?.stickerize(element); };
  const ROUNDS = 6;
  let seen = new Set();
  try { seen = new Set(JSON.parse(localStorage.getItem('ror-natural-seen-206-v3') || '[]')); } catch {}
  const TIME_LIMIT = 20000;
  let deck = [], answers = [], round = 0, score = 0, points = 0, loaded = false, best = null, mode = 'chill';
  let timer = null, deadline = 0, activeRound = -1, remaining = TIME_LIMIT, scopeOn = false, timedStarted = false;
  let imageZoom = 1, panX = 0, panY = 0, drag = null, lastScopePoint = null;
  try { mode = localStorage.getItem('ror-mode') === 'timed' ? 'timed' : 'chill'; } catch {}
  function readBest() { try { const saved = localStorage.getItem(mode === 'chill' ? 'ror-natural-best-points-v1' : 'ror-timed-best-points-v1'); best = saved === null ? null : Number(saved); if (!Number.isFinite(best)) best = null; } catch { best = null; } }
  function stopTimer() { clearInterval(timer); timer = null; deadline = 0; activeRound = -1; }
  const escape = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function generationRecord(card) {
    const locale = {en: 'en-GB', ru: 'ru-RU', uz: 'uz-Latn-UZ'}[window.ROR_I18N.language] || 'en-GB';
    const created = new Intl.DateTimeFormat(locale, {day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date((card.generationDate || '2026-10-19') + 'T12:00:00Z'));
    showInfo(`<div class="eyebrow">${t('generationEyebrow')}</div><h2>${escape(card.title)}</h2><p>${t('generationCopy')}</p><p><strong>${t('created')}</strong> ${escape(created)}</p><p><strong>${t('prompt')}</strong></p><p>${escape(card.prompt)}</p>`);
  }
  function sourceMarkup(card) {
    return card.generated ? `<button class="text-button" data-source-id="${escape(card.id)}">${t('generation')}</button>` : `<a href="${escape(card.source)}" target="_blank" rel="noopener">${t('source')}</a>`;
  }
  function bindRecords() {
    document.querySelectorAll('[data-source-id]').forEach(button => {
      button.onclick = () => generationRecord(cards.find(c => c.id === button.dataset.sourceId));
    });
  }
  function shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
    return copy;
  }
  function draw(ai, count) {
    const pool = cards.filter(c => c.ai === ai);
    const fresh = shuffle(pool.filter(c => !seen.has(c.id)));
    const selected = fresh.slice(0, count);
    if (selected.length < count) {
      pool.forEach(c => seen.delete(c.id));
      selected.push(...shuffle(pool.filter(c => !selected.includes(c))).slice(0, count - selected.length));
    }
    return selected;
  }
  function start() {
    stopTimer(); readBest();
    deck = shuffle([...draw(true, ROUNDS / 2), ...draw(false, ROUNDS / 2)]);
    round = 0; score = 0; points = 0; answers = []; remaining = TIME_LIMIT; timedStarted = false;
    $('result').hidden = true; document.querySelector('.game').hidden = false;
    $('review-list').hidden = true; $('share-status').textContent = ''; $('score').textContent = '0'; $('points').textContent = '0';
    $('mode-chill').setAttribute('aria-pressed', String(mode === 'chill'));
    $('mode-timed').setAttribute('aria-pressed', String(mode === 'timed'));
    $('mode-switch').setAttribute('data-mode', mode);
    $('session-announcement').textContent = ''; delete $('session-announcement').dataset.i18nValue; delete $('session-announcement').dataset.i18nValues;
    localize('mode-note', mode === 'chill' ? 'modeNoteChill' : 'modeNoteTimed');
    localize('deck-caption', 'deck', {count:cards.length,mode:mode === 'chill' ? t('deckChill') : t('deckTimed')});
    $('timer-strip').hidden = mode !== 'timed';
    $('celebration').replaceChildren();
    render(); updateTimer();
  }
  $('mode-chill').onclick = () => setMode('chill');
  $('mode-timed').onclick = () => setMode('timed');
  $('home').onclick = event => { event.preventDefault(); start(); };
  ['mode-chill', 'mode-timed'].forEach(id => $(id).addEventListener('keydown', e => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
    e.preventDefault(); const value = ['ArrowLeft','Home'].includes(e.key) ? 'chill' : 'timed';
    setMode(value); $(`mode-${value}`).focus();
  }));
  function setMode(value) {
    if (value === mode) return;
    mode = value; try { localStorage.setItem('ror-mode', mode); } catch {}
    start();
  }
  document.addEventListener('ror-language-change', () => {
    if (!document.querySelector('.game')) return;
    localize('mode-note', mode === 'chill' ? 'modeNoteChill' : 'modeNoteTimed');
    localize('deck-caption', 'deck', {count:cards.length,mode:mode === 'chill' ? t('deckChill') : t('deckTimed')});
    if ($('zoom-dialog').open) {
      $('inspect-mode-note').textContent = mode === 'timed' ? t('countdownContinues') : t('takeTime');
      $('scope-help').textContent = t(scopeOn ? 'scopeHelpLens' : imageZoom > 1 ? 'scopeHelpPan' : 'scopeHelpZoom');
    }
    if (!$('result').hidden) updateResult();
    else if (deck.length) render();
  });
  function progress() {
    $('progress').innerHTML = deck.map((_, i) => `<span class="${answers[i] ? (answers[i].correct ? 'correct' : 'wrong') : i === round ? 'current' : ''}"></span>`).join('');
    const progressValues = {done:answers.filter(Boolean).length,total:deck.length};
    $('progress').dataset.i18nAria = 'progress'; $('progress').dataset.i18nAriaValues = JSON.stringify(progressValues);
    $('progress').setAttribute('aria-label', t('progress', progressValues));
    $('back').disabled = round === 0;
    $('next').disabled = !answers[round];
    $('next').textContent = round === deck.length - 1 ? t('final') : t('next');
    localize('nav-hint', mode === 'timed' && !timedStarted ? 'pressStart' : answers[round] ? 'progress' : 'chooseAnswer', answers[round] ? {done:round + 1,total:deck.length} : {});
  }
  function render() {
    if (!deck.length) { $('question').textContent = t('unavailable'); return; }
    loaded = false;
    window.ROR_DESIGN?.card(deck[round], answers[round], round);
    $('choices').hidden = !!answers[round]; $('reveal').hidden = !answers[round];
    $('real').disabled = $('ai').disabled = true;
    localize('question', 'question'); localize('instruction', 'instruction');
    localize('round-label', 'roundLabel', {round:String(round + 1).padStart(2, '0'),total:String(deck.length).padStart(2, '0')});
    localize('image-index', 'exhibitLabel', {number:String(round + 1).padStart(3, '0')});
    $('image-error').hidden = true; $('photo-frame').classList.add('loading');
    // The alt text describes the scene without exposing its answer.
    $('photo').alt = deck[round].alt;
    $('photo').src = deck[round].image;
    if (answers[round]) reveal();
    updateReady(); progress(); updateTimer();
    if (deck[round + 1]) { const preload = new Image(); preload.src = deck[round + 1].image; }
  }
  $('photo').addEventListener('load', () => {
    loaded = true; $('photo-frame').classList.remove('loading');
    updateReady();
    if (!answers[round] && (mode !== 'timed' || timedStarted)) { $('real').disabled = $('ai').disabled = false; beginTimer(); }
  });
  $('photo').addEventListener('error', () => {
    loaded = false; $('image-error').hidden = false; $('photo-frame').classList.remove('loading'); $('real').disabled = $('ai').disabled = true; updateReady();
    if (activeRound === round) { remaining = Math.max(0, deadline - Date.now()); stopTimer(); updateTimer(); }
  });
  $('retry').onclick = () => { $('image-error').hidden = true; $('photo-frame').classList.add('loading'); $('photo').removeAttribute('src'); $('photo').src = deck[round].image; };
  function updateReady() {
    const waiting = mode === 'timed' && !timedStarted;
    $('timed-ready').hidden = !waiting;
    $('photo-frame').classList.toggle('is-ready', waiting);
    $('inspect-photo').disabled = waiting || !loaded;
    $('photo').setAttribute('aria-hidden', String(waiting));
    $('start-timed').disabled = !loaded;
    $('start-timed').textContent = loaded ? t('startTimed') : t('preparing');
    if (waiting) {
      localize('question', 'focusTitle');
      localize('instruction', 'clockWaiting');
      localize('nav-hint', 'pressStart');
    }
  }
  $('start-timed').onclick = () => {
    if (mode !== 'timed' || timedStarted || !loaded) return;
    timedStarted = true; updateReady();
    $('real').disabled = $('ai').disabled = false;
    localize('question', 'question'); localize('instruction', 'instruction');
    progress(); beginTimer(); $('real').focus({preventScroll:true});
  };
  function beginTimer() {
    if (mode !== 'timed' || !timedStarted || timer !== null || answers[round]) return;
    activeRound = round; deadline = Date.now() + remaining;
    timer = setInterval(updateTimer, 100); updateTimer();
  }
  function updateTimer() {
    const left = deadline ? Math.max(0, deadline - Date.now()) : remaining;
    window.ROR_DESIGN?.timer(left, TIME_LIMIT);
    const currentAnswered = !!answers[round];
    const timerKey = mode === 'timed' && !timedStarted ? 'readyTimer' : deadline ? 'timeRemaining' : currentAnswered ? 'answerLocked' : 'waitingImage';
    localize('timer-label', timerKey, {seconds:Math.ceil(left / 1000)});
    if (mode === 'timed') $('inspect-mode-note').textContent = deadline ? t('clockContinues', {seconds:Math.ceil(left / 1000)}) : currentAnswered ? t('closeReveal') : t('twentySeconds');
    $('timer-fill').style.width = `${left / TIME_LIMIT * 100}%`;
    $('timer-strip').classList.toggle('urgent', !!deadline && left <= 5000);
    const answer = answers[round], waiting = mode === 'timed' && !timedStarted;
    $('round-status').setAttribute('data-state', waiting ? 'ready' : answer ? (answer.correct ? 'correct' : 'missed') : 'playing');
    $('status-symbol').textContent = waiting ? '◷' : answer ? (answer.correct ? '✓' : '↳') : '◉';
    const statusKey = waiting ? 'readyStatus' : answer ? (answer.correct ? 'correctStatus' : answer.guess === null ? 'timeoutStatus' : 'missedStatus') : deadline ? 'secondsLeft' : mode === 'timed' ? 'timedLoading' : 'chillStatus';
    localize('status-caption', statusKey, {seconds:Math.ceil(left / 1000),image:activeRound + 1});
    if (deadline && left <= 0) recordAnswer(activeRound, null);
  }
  function guess(ai) {
    if (answers[round] || !loaded || (mode === 'timed' && !timedStarted) || document.querySelector('.game').hidden) return;
    // Check the actual deadline even if the browser delayed its interval callback.
    if (mode === 'timed' && deadline && Date.now() >= deadline) { recordAnswer(activeRound, null); return; }
    recordAnswer(round, ai);
  }
  function recordAnswer(index, ai) {
    if (answers[index]) return;
    if (index === activeRound) stopTimer();
    const card = deck[index], correct = ai !== null && card.ai === ai;
    const pointChange = correct ? 100 : -25;
    if (correct) score++;
    points += pointChange;
    answers[index] = {card, correct, guess: ai, pointChange};
    $('score').textContent = String(score); $('points').textContent = String(points);
    localize('session-announcement', 'answerAnnouncement', {image:index + 1,result:`$${correct ? 'correctAnnouncement' : ai === null ? 'expiredAnnouncement' : 'missedAnnouncement'}`,change:`$${pointChange > 0 ? 'plus' : 'minus'}`,points:Math.abs(pointChange),correct:score});
    seen.add(card.id);
    try { localStorage.setItem('ror-natural-seen-206-v3', JSON.stringify([...seen])); } catch {}
    remaining = TIME_LIMIT;
    if (index === round) { reveal(); $('next').focus({preventScroll:true}); }
    if (correct) celebrate();
    progress(); updateTimer();
  }
  function reveal() {
    const {card, correct, guess: choice, pointChange} = answers[round];
    $('choices').hidden = true; $('reveal').hidden = false;
    $('real').disabled = $('ai').disabled = true;
    localize('question', 'reveal'); localize('instruction', 'correctCount', {correct:score,total:answers.filter(Boolean).length});
    $('verdict').textContent = correct ? t('gotIt') : choice === null ? t('timedOut') : t('fooled');
    $('verdict').className = correct ? 'correct-text' : 'wrong-text';
    $('point-award').className = `point-award ${correct ? 'earned' : 'lost'}`;
    $('point-award-value').textContent = `${pointChange > 0 ? '+' : '−'}${Math.abs(pointChange)}`;
    $('truth').textContent = card.ai ? t('aiAnswer') : t('realAnswer');
    $('explanation').textContent = card.hint || card.note || '';
    $('explanation').hidden = !$('explanation').textContent.trim();
    window.ROR_DESIGN?.card(card, answers[round], round);
    $('source-link').href = card.source;
    $('source-link').textContent = card.generated ? t('generation') : t('source');
    $('source-link').onclick = event => { if (card.generated) { event.preventDefault(); generationRecord(card); } };
  }
  $('real').onclick = () => guess(false); $('ai').onclick = () => guess(true);
  $('next').onclick = () => { if (!answers[round]) return; if (++round >= deck.length) finish(); else render(); };
  $('back').onclick = () => { if (round > 0) { round--; render(); } };
  function finish() {
    stopTimer();
    best = best === null ? points : Math.max(best, points); try { localStorage.setItem(mode === 'chill' ? 'ror-natural-best-points-v1' : 'ror-timed-best-points-v1', String(best)); } catch {}
    document.querySelector('.game').hidden = true; $('result').hidden = false;
    updateResult();
    $('result').focus({preventScroll:true}); $('result').scrollIntoView({behavior:'auto',block:'center'});
  }
  function updateResult() {
    window.ROR_DESIGN?.result(score);
    $('final-score').textContent = points;
    $('point-summary').textContent = t('resultSummary', {correct:score,missed:deck.length - score});
    $('accuracy').textContent = Math.round(score / deck.length * 100) + '%'; $('best').textContent = `${best ?? 0} ${t('pointsShort')}`;
    $('result-title').textContent = score === deck.length ? t('resultPerfect') : score >= 4 ? t('resultSharp') : score >= 2 ? t('resultCompetition') : t('resultPixels');
    $('result-copy').textContent = t('resultCopy');
  }
  $('again').onclick = () => { start(); document.querySelector('.game').scrollIntoView({behavior:'smooth',block:'start'}); };
  $('share').onclick = async () => {
    const text = t('shareText', {points,score,total:deck.length,mode:mode === 'timed' ? t('timed') : t('chill')});
    try {
      if (navigator.share && location.protocol !== 'file:') await navigator.share({title:'Real or Render',text,url:location.href});
      else if (navigator.clipboard && location.protocol !== 'file:') { await navigator.clipboard.writeText(text + '\n' + location.href); $('share-status').textContent = t('scoreCopied'); }
      else $('share-status').textContent = text;
    } catch (e) { if (e.name !== 'AbortError') $('share-status').textContent = text; }
  };
  $('review').onclick = () => {
    const list = $('review-list'); list.hidden = !list.hidden;
    list.innerHTML = answers.map(({card, correct, pointChange}) => `<article class="review-card"><img src="${escape(card.image)}" alt="${escape(card.alt)}"><div><strong>${correct ? `✓ ${t('correctAnnouncement')}` : `↳ ${t('missedAnnouncement')}`} · ${card.ai ? t('aiAnswer') : t('realAnswer')} · ${pointChange > 0 ? '+' : '−'}${Math.abs(pointChange)} ${t('eyePoints')}</strong><p>${escape(card.note)}</p>${sourceMarkup(card)}</div></article>`).join('');
    bindRecords();
  };
  function showInfo(html) { $('dialog-content').innerHTML = html; $('info-dialog').showModal(); }
  $('design-credits').onclick = () => {
    const notices = window.UI_NOTICES;
    showInfo(`<div class="eyebrow">${t('designEyebrow')}</div><h2>${t('designTitle')}</h2>` + (notices ? notices.sources.map(s => `<div class="credit-item"><a href="${escape(s.url)}" target="_blank" rel="noopener"><strong>${escape(s.name)} ↗</strong></a><p>${escape(s.use)}</p></div>`).join('') + `<details><summary>${t('licenseWatermelon')}</summary><pre class="license-copy">${escape(notices.watermelonLicense)}</pre></details><details><summary>${t('licenseFonts')}</summary><pre class="license-copy">${escape(notices.fontLicenses)}</pre></details>` : `<p>${t('designFallback')}</p>`));
  };
  $('how').onclick = () => showInfo(`<div class="eyebrow">${t('helpEyebrow')}</div><h2>${t('helpTitle')}</h2><ol><li>${t('helpPace')}</li><li>${t('helpCloser')}</li><li>${t('helpPoints')}</li><li>${t('helpReveal')}</li></ol><p>${t('helpTimer')}</p><p>${t('helpDeck', {count:cards.length})}</p><p>${t('helpDefinition')}</p><p>${t('helpStorage')}</p>`);
  $('credits').onclick = () => {
    showInfo(`<h2>${t('imageCreditsTitle')}</h2><p>${t('imageCount', {count:cards.length,ai:cards.filter(c => c.ai).length,real:cards.filter(c => !c.ai).length})}</p>` + cards.map(c => `<div class="credit-item"><strong>${escape(c.title)}</strong>${escape(c.author)} · ${c.ai ? t('aiAnswer') : t('realAnswer')}<br>${sourceMarkup(c)} · ${c.licenseUrl ? `<a href="${escape(c.licenseUrl)}" target="_blank" rel="noopener">${escape(c.license)}</a>` : escape(c.license)}</div>`).join('') + (window.PHOTO_LICENSES ? `<details><summary>${t('licenseNotices')}</summary><pre style="white-space:pre-wrap;font:10px/1.7 monospace">${escape(window.PHOTO_LICENSES)}</pre></details>` : ''));
    bindRecords();
  };
  function inspect() {
    if (!loaded || (mode === 'timed' && !timedStarted)) return;
    drag = null; lastScopePoint = null; scopeOn = false; panX = panY = 0; imageZoom = 1;
    $('zoom-photo').src = deck[round].image; $('zoom-photo').alt = deck[round].alt;
    $('scope-lens').style.backgroundImage = `url("${deck[round].image}")`;
    $('scope-lens').hidden = true;
    $('scope-toggle').setAttribute('aria-pressed', 'false'); $('scope-toggle').textContent = t('scopeOff');
    $('inspect-stage').classList.remove('scope-enabled', 'is-dragging');
    $('inspect-mode-note').textContent = mode === 'timed' ? t('countdownContinues') : t('takeTime');
    $('zoom-dialog').showModal();
    applyZoom(); updateTimer();
  }
  $('photo').onclick = $('inspect-photo').onclick = inspect;
  $('photo').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inspect(); } });
  $('scope-toggle').onclick = () => {
    scopeOn = !scopeOn; $('scope-toggle').setAttribute('aria-pressed', String(scopeOn));
    $('scope-toggle').textContent = t(scopeOn ? 'scopeOn' : 'scopeOff');
    $('scope-lens').hidden = true;
    $('inspect-stage').classList.toggle('scope-enabled', scopeOn);
    $('scope-help').textContent = t(scopeOn ? 'scopeHelpLens' : imageZoom > 1 ? 'scopeHelpPan' : 'scopeHelpZoom');
    if (scopeOn) {
      const r = $('inspect-stage').getBoundingClientRect();
      moveScope({clientX:r.left + r.width / 2,clientY:r.top + r.height / 2});
    }
  };
  function fittedImage() {
    const stage = $('inspect-stage'), image = $('zoom-photo'), rect = stage.getBoundingClientRect();
    if (!image.naturalWidth || !image.naturalHeight) return {rect,width:rect.width,height:rect.height};
    const fit = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
    return {rect,width:image.naturalWidth * fit,height:image.naturalHeight * fit};
  }
  function applyZoom() {
    const {rect,width,height} = fittedImage();
    const maxX = Math.max(0, (width * imageZoom - rect.width) / 2), maxY = Math.max(0, (height * imageZoom - rect.height) / 2);
    panX = Math.max(-maxX, Math.min(maxX, panX)); panY = Math.max(-maxY, Math.min(maxY, panY));
    $('zoom-photo').style.transform = `translate(${panX}px, ${panY}px) scale(${imageZoom})`;
    $('scope-power').value = String(imageZoom);
    $('scope-power').style.setProperty('--range', `${(imageZoom - 1) / 3 * 100}%`);
    $('scope-power').setAttribute('aria-valuetext', t('scope100', {percent:Math.round(imageZoom * 100)}));
    $('scope-value').textContent = `${Math.round(imageZoom * 100)}%`;
    $('zoom-out').disabled = imageZoom <= 1; $('zoom-in').disabled = imageZoom >= 4;
    $('inspect-stage').classList.toggle('is-zoomed', imageZoom > 1);
    $('pan-controls').hidden = imageZoom <= 1;
    $('pan-left').disabled = panX >= maxX; $('pan-right').disabled = panX <= -maxX;
    $('pan-up').disabled = panY >= maxY; $('pan-down').disabled = panY <= -maxY;
    $('scope-help').textContent = t(scopeOn ? 'scopeHelpLens' : imageZoom > 1 ? 'scopeHelpPan' : 'scopeHelpZoom');
    if (scopeOn && lastScopePoint) moveScope(lastScopePoint);
  }
  function setZoom(value) {
    imageZoom = Math.max(1, Math.min(4, Number(value) || 1));
    if (imageZoom === 1) panX = panY = 0;
    applyZoom();
  }
  $('scope-power').oninput = () => setZoom($('scope-power').value);
  $('zoom-in').onclick = () => setZoom(imageZoom + .25);
  $('zoom-out').onclick = () => setZoom(imageZoom - .25);
  $('zoom-reset').onclick = () => { panX = panY = 0; setZoom(1); };
  const panSteps = {left:[64,0],right:[-64,0],up:[0,64],down:[0,-64]};
  Object.entries(panSteps).forEach(([direction,[x,y]]) => $(`pan-${direction}`).onclick = () => { if (imageZoom <= 1) return; panX += x; panY += y; applyZoom(); });
  $('zoom-photo').addEventListener('load', () => { applyZoom(); });
  window.addEventListener('resize', () => { if ($('zoom-dialog').open) applyZoom(); });
  function moveScope(e) {
    if (!scopeOn || !$('zoom-photo').naturalWidth) return;
    lastScopePoint = {clientX:e.clientX,clientY:e.clientY};
    const {rect:outer,width,height} = fittedImage();
    const w = width * imageZoom, h = height * imageZoom;
    const left = outer.left + (outer.width - w) / 2 + panX, top = outer.top + (outer.height - h) / 2 + panY;
    if (e.clientX < left || e.clientX > left + w || e.clientY < top || e.clientY > top + h) { $('scope-lens').hidden = true; return; }
    const x = e.clientX - left, y = e.clientY - top, zoom = 2.5, lens = $('scope-lens');
    lens.hidden = false;
    const diameter = lens.getBoundingClientRect().width;
    // Keep the lens inside the viewport while its center samples the pointer position.
    lens.style.left = `${Math.max(0, Math.min(e.clientX - outer.left - diameter / 2, outer.width - diameter))}px`;
    lens.style.top = `${Math.max(0, Math.min(e.clientY - outer.top - diameter / 2, outer.height - diameter))}px`;
    lens.style.backgroundSize = `${w * zoom}px ${h * zoom}px`;
    lens.style.backgroundPosition = `${diameter / 2 - x * zoom}px ${diameter / 2 - y * zoom}px`;
  }
  $('inspect-stage').addEventListener('pointermove', e => {
    if (e.target?.closest?.('.pan-controls')) { $('scope-lens').hidden = true; lastScopePoint = null; return; }
    if (drag && e.pointerId === drag.id) { panX = drag.panX + e.clientX - drag.x; panY = drag.panY + e.clientY - drag.y; applyZoom(); }
    moveScope(e);
  });
  $('inspect-stage').addEventListener('pointerdown', e => {
    if (e.target?.closest?.('.pan-controls')) return;
    if (e.button !== undefined && e.button !== 0) return;
    if (imageZoom > 1 || scopeOn) {
      e.preventDefault(); $('inspect-stage').focus({preventScroll:true}); $('inspect-stage').setPointerCapture(e.pointerId);
      if (imageZoom > 1) { drag = {id:e.pointerId,x:e.clientX,y:e.clientY,panX,panY}; $('inspect-stage').classList.add('is-dragging'); }
      moveScope(e);
    }
  });
  function endDrag(e) {
    drag = null; $('inspect-stage').classList.remove('is-dragging');
    if ($('inspect-stage').hasPointerCapture(e.pointerId)) $('inspect-stage').releasePointerCapture(e.pointerId);
    if (e.pointerType !== 'mouse') { $('scope-lens').hidden = true; lastScopePoint = null; }
  }
  $('inspect-stage').addEventListener('pointerleave', () => { if (!drag) { $('scope-lens').hidden = true; lastScopePoint = null; } });
  $('inspect-stage').addEventListener('pointerup', endDrag);
  $('inspect-stage').addEventListener('pointercancel', endDrag);
  $('inspect-stage').addEventListener('lostpointercapture', () => { drag = null; $('inspect-stage').classList.remove('is-dragging'); });
  $('inspect-stage').addEventListener('keydown', e => {
    if (imageZoom <= 1 || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
    e.preventDefault(); panX += e.key === 'ArrowLeft' ? 40 : e.key === 'ArrowRight' ? -40 : 0;
    panY += e.key === 'ArrowUp' ? 40 : e.key === 'ArrowDown' ? -40 : 0; applyZoom();
  });
  $('zoom-dialog').addEventListener('close', () => { drag = null; lastScopePoint = null; $('scope-lens').hidden = true; });
  function celebrate() {
    const layer = $('celebration'); layer.replaceChildren();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = $('photo-frame').getBoundingClientRect();
    // Three short firecracker bursts. No audio, so the game stays comfortable to play anywhere.
    for (let burst = 0; burst < 3; burst++) {
      const x = rect.left + rect.width * (.25 + burst * .25), y = rect.top + rect.height * (.45 + (burst % 2) * .15);
      for (let i = 0; i < 22; i++) {
        const spark = document.createElement('i'), angle = i / 22 * Math.PI * 2, distance = 45 + Math.random() * 95;
        spark.className = 'firecracker-spark';
        spark.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.cos(angle) * distance}px;--dy:${Math.sin(angle) * distance}px;--spin:${Math.random() * 400}deg;--delay:${burst * 110}ms;background:${['#FFD25A','#FF8A5B','#B79BFF','#7AD3A8','#FF9EC7'][i % 5]}`;
        spark.addEventListener('animationend', () => spark.remove()); layer.appendChild(spark);
      }
    }
  }
  document.querySelectorAll('dialog').forEach(d => { d.querySelector('.close').onclick = () => d.close(); d.onclick = e => { if (e.target === d) { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close(); } }; });
  document.addEventListener('keydown', e => { if (e.repeat || document.querySelector('dialog[open]') || e.ctrlKey || e.metaKey || e.altKey || ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return; if (e.key === '1') guess(false); if (e.key === '2') guess(true); });
  start();
})();

