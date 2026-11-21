// ==UserScript==
// @name         BR | Кураторы форума — автопроверка (РП био / ситуации / неоф. орг)
// @namespace    br-curator-khabarovsk
// @version      4.0.2
// @description  Проверяет темы по правилам разделов, готовит ответ (одобрено / отказ / доработка), ставит префикс, закрывает или закрепляет тему
// @match        https://forum.blackrussia.online/*
// @updateURL    https://raw.githubusercontent.com/IgorAkentev/br-curator/main/br-curator-forum.user.js
// @downloadURL  https://raw.githubusercontent.com/IgorAkentev/br-curator/main/br-curator-forum.user.js
// @note         4.0.2 — фото по ссылке текстом засчитываются, фикс иконки
// @note         4.0.1 — новая иконка настроек, фикс дублей и таймера на рассмотренных темах
// @note         4.0.0 — поиск копипаста и дублей, очередь с таймерами в разделах, контроль доработки 24ч, свои причины, подсветка в тексте
// @note         3.2.0 — новый дизайн панели, починены ложные срабатывания (заголовок, имя, фото)
// @note         3.1.0 — плавающая кнопка: проверка и установка обновлений
// @note         3.0.0 — проверки под правила разделов Хабаровска
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  /* ===================== НАСТРОЙКИ ===================== */

  // ID префиксов — ПРОВЕРЬ: "Редактировать тему" -> список префиксов -> value у option
  const PREFIX = { ACCEPT: 8, DECLINE: 7, WATCHED: 9 };
  const AUTO_SEND = false;            // true — отправлять сразу по клику
  const FONTS = /verdana|times new roman/i;
  const MIN_FONT_PX = 15;

  const RX_NICK = /[A-Z][a-z]+_[A-Z][a-z]+/;
  const RX_SUPER = /сверхспособн|магич|магия|колдун|ведьм|телепорт|бессмерт|вампир|оборот(ень|ни)|телекинез|воскрес/i;

  const SECTIONS = {
    2186: {
      key: 'bio', name: 'RP-биографии', what: 'Биография',
      titleRe: /биография\s*[|│¦\/\\:\-–—]?\s*[A-Za-z]+_[A-Za-z]+/i,
      titleHint: 'Биография | Nick_Name',
      minWords: 200, maxWords: 600,
      fields: [
        ['Имя и фамилия персонажа', /(имя|фио)[^:\n]{0,30}:/i],
        ['Пол', /(^|\n)\s*пол\s*:/i],
        ['Возраст', /возраст\s*:/i],
        ['Национальность', /национальность\s*:/i],
        ['Образование', /образование\s*:/i],
        ['Описание внешности', /внешност/i],
        ['Характер', /характер\s*:/i],
        ['Детство', /детство\s*:/i],
        ['Настоящее время', /настоящее\s+время\s*:/i],
        ['Итог', /итог\s*:/i],
      ],
      needMedia: true, mediaRule: '1.7',
    },
    2185: {
      key: 'sit', name: 'RP-ситуации', what: 'RP ситуация',
      titleRe: /^\s*\[[^\]]+\]\s*\S.{2,}$/,
      titleHint: '[Краткое название события] Событие',
      minWords: 0, maxWords: 0,
      fields: [
        ['Название', /назван/i],
        ['Пролог', /пролог/i],
        ['Сюжет', /сюжет/i],
        ['Эпилог', /эпилог/i],
        ['Ссылка на исходные материалы', /ссылка\s+на\s+исходн/i],
      ],
      needMedia: true, mediaRule: '1.4',
      needSourceLink: true,
    },
    2183: {
      key: 'org', name: 'Неоф. организации', what: 'Организация',
      titleRe: /^\s*Неофициальная\s+RP\s+организация\s+\S.+$/i,
      titleHint: 'Неофициальная RP организация [Название]',
      minWords: 0, maxWords: 0,
      fields: [
        ['Название организации', /название\s+(вашей\s+)?организац/i],
        ['История создания', /история\s+создания/i],
        ['Состав участников', /состав\s+участник/i],
        ['Устав', /устав/i],
        ['Описание деятельности', /описание\s+деятельност/i],
        ['Отличительная визуальная особенность', /визуальн/i],
        ['Как и где попасть', /как\s+и\s+где/i],
        ['Ссылка на одобренную RP биографию', /ссылка\s+на\s+(одобренную\s+)?rp\s+биограф/i],
      ],
      needMedia: true, mediaRule: '1.10',
      minMembers: 3,
      checkLeaderBio: true,
    },
  };

  /* ===================== ХЕЛПЕРЫ ===================== */

  const qs = (s, r = document) => r.querySelector(s);

  /* ===================== ОБНОВЛЕНИЯ ===================== */

  const VERSION = '4.0.2';
  // Прямая (raw) ссылка на файл скрипта. Та же, что в @updateURL сверху.
  const UPDATE_URL = 'https://raw.githubusercontent.com/IgorAkentev/br-curator/main/br-curator-forum.user.js';
  const CHECK_EVERY_H = 6; // автопроверка раз в N часов

  const ls = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem('brc_' + k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem('brc_' + k, JSON.stringify(v)); } catch {} },
  };
  const verCmp = (a, b) => {
    const x = a.split('.').map(Number), y = b.split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
    return 0;
  };

  (function updater() {
    const st = document.createElement('style');
    st.textContent = `
      #brc-fab{position:fixed;left:14px;bottom:90px;z-index:100001;width:50px;height:50px;border-radius:16px;border:1px solid #ffffff30;
        display:grid;place-items:center;padding:0;transition:transform .25s,box-shadow .25s;
        background:linear-gradient(135deg,#3ec6d0,#1ec27a);color:#fff;font-size:20px;box-shadow:0 6px 18px #1ec27a55;cursor:pointer}
      #brc-fab svg{width:26px!important;height:26px!important;transition:transform .5s;fill:none!important}
      #brc-fab svg *{fill:none!important;stroke:#fff!important;stroke-width:2px!important}
      #brc-fab.open svg{transform:rotate(90deg)}
      #brc-fab:active{transform:scale(.92)}
      #brc-fab .dot{position:absolute;top:-4px;right:-4px;width:14px;height:14px;border-radius:50%;background:#ff5468;border:2px solid #11181b;display:none;
        animation:brcpulse 1.4s infinite}
      @keyframes brcpulse{0%{box-shadow:0 0 0 0 #ff546899}70%{box-shadow:0 0 0 8px #ff546800}100%{box-shadow:0 0 0 0 #ff546800}}
      #brc-upd{position:fixed;left:14px;bottom:144px;z-index:100001;width:270px;max-width:calc(100vw - 28px);padding:12px;
        border-radius:16px;background:#11181bf2;color:#e6edf0;border:1px solid #3ec6d055;box-shadow:0 10px 30px #000a;font:13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;display:none;backdrop-filter:blur(6px)}
      #brc-upd b.v{color:#1ec27a}
      #brc-upd button{width:100%;margin-top:8px;padding:10px;border:none;border-radius:10px;font-weight:700;cursor:pointer}
      #brc-upd .chk{background:#ffffff14;color:#eee}
      #brc-upd .ins{background:linear-gradient(135deg,#3ec6d0,#1ec27a);color:#fff;display:none}
      #brc-upd ul{margin:6px 0 0;padding-left:16px}
      #brc-upd .st{margin-top:8px;opacity:.85}
    `;
    document.head.appendChild(st);

    const fab = document.createElement('button');
    fab.id = 'brc-fab';
    fab.title = 'Скрипт кураторов';
    fab.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/></svg><span class="dot"></span>`;
    const pnl = document.createElement('div');
    pnl.id = 'brc-upd';
    pnl.innerHTML = `
      <div><b>Скрипт кураторов</b></div>
      <div>Версия: <b class="v">${VERSION}</b></div>
      <div class="st" id="brc-upd-st"></div>
      <div id="brc-upd-notes"></div>
      <button class="ins" id="brc-upd-ins">⬇️ Установить обновление</button>
      <button class="chk" id="brc-upd-chk">🔄 Проверить обновления</button>
    `;
    document.body.append(fab, pnl);
    fab.onclick = () => { const o = pnl.style.display !== 'block'; pnl.style.display = o ? 'block' : 'none'; fab.classList.toggle('open', o); };

    const stEl = pnl.querySelector('#brc-upd-st');
    const notesEl = pnl.querySelector('#brc-upd-notes');
    const insBtn = pnl.querySelector('#brc-upd-ins');
    insBtn.onclick = () => { location.href = UPDATE_URL; }; // Tampermonkey сам откроет окно установки

    const last = ls.get('last_check', 0);
    stEl.textContent = last ? `Последняя проверка: ${new Date(last).toLocaleString('ru-RU')}` : 'Ещё не проверялось';

    async function check(manual) {
      if (!UPDATE_URL.startsWith('https://')) {
        stEl.textContent = '⚠️ Ссылка на обновления не настроена (UPDATE_URL).';
        return;
      }
      stEl.textContent = 'Проверяю…';
      try {
        const src = await (await fetch(UPDATE_URL + '?t=' + Date.now(), { cache: 'no-store' })).text();
        const remote = (src.match(/@version\s+([\d.]+)/) || [])[1];
        if (!remote) throw new Error('не нашёл @version');
        ls.set('last_check', Date.now());
        if (verCmp(remote, VERSION) > 0) {
          const notes = [...src.matchAll(/\/\/\s*@note\s+(.+)/g)].map((m) => m[1])
            .filter((n) => { const v = (n.match(/^([\d.]+)/) || [])[1]; return !v || verCmp(v, VERSION) > 0; });
          stEl.innerHTML = `🔥 Доступна версия <b class="v">${remote}</b>`;
          notesEl.innerHTML = notes.length ? `<ul>${notes.map((n) => `<li>${n}</li>`).join('')}</ul>` : '';
          insBtn.style.display = 'block';
          fab.querySelector('.dot').style.display = 'block';
          if (!manual) pnl.style.display = 'block';
        } else {
          stEl.textContent = `✅ Последняя версия (${VERSION})`;
          notesEl.innerHTML = '';
          insBtn.style.display = 'none';
          fab.querySelector('.dot').style.display = 'none';
        }
      } catch (e) {
        stEl.textContent = '❌ Не удалось проверить: ' + e.message;
      }
    }

    pnl.querySelector('#brc-upd-chk').onclick = () => check(true);
    if (Date.now() - last > CHECK_EVERY_H * 3600e3) check(false);
  })();

  /* ===================== 3. ОЧЕРЕДЬ НА СТРАНИЦЕ РАЗДЕЛА ===================== */

  (function queue() {
    const m = location.pathname.match(/^\/forums\/[^/]*\.(\d+)\/?/);
    if (!m || !SECTIONS[m[1]]) return;
    const items = [...document.querySelectorAll('.structItem--thread')];
    if (!items.length) return;

    const st = document.createElement('style');
    st.textContent = `
      .brcq{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:12px;font:700 11px/18px -apple-system,Segoe UI,Roboto,sans-serif;vertical-align:middle;white-space:nowrap}
      .brcq.g{background:#1ec27a22;color:#1ec27a}.brcq.y{background:#ffb54722;color:#ffb547}.brcq.r{background:#ff5468;color:#fff}
      .brcq-late{box-shadow:inset 3px 0 0 #ff5468}
      #brcq-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:10px 0;padding:12px 14px;border-radius:14px;
        background:#11181bf2;border:1px solid #3ec6d055;color:#e6edf0;font:13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 6px 18px #0006}
      #brcq-bar b{font-size:15px}
      #brcq-bar .sp{flex:1}
      #brcq-bar button{border:none;border-radius:10px;padding:8px 12px;font-weight:800;color:#fff;cursor:pointer;background:linear-gradient(135deg,#3ec6d0,#1ec27a)}
    `;
    document.head.appendChild(st);

    const now = Date.now() / 1000;
    const data = [];
    for (const it of items) {
      if (it.querySelector('.structItem-status--sticky')) continue;
      const pref = (it.querySelector('.structItem-title .label')?.textContent || '').trim();
      if (it.querySelector('.structItem-status--locked') || /одобрен|отказ|закрыт/i.test(pref)) continue;
      const t = +(it.querySelector('.structItem-startDate time, time.u-dt')?.getAttribute('data-time') || 0);
      if (!t) continue;
      const left = 72 - Math.floor((now - t) / 3600);
      data.push({ it, left });
      const chip = document.createElement('span');
      chip.className = 'brcq ' + (left <= 0 ? 'r' : left <= 24 ? 'y' : 'g');
      chip.textContent = left <= 0 ? `⏱ просрочено на ${-left} ч` : `⏱ ${left} ч`;
      (it.querySelector('.structItem-title') || it).appendChild(chip);
      if (left <= 0) it.classList.add('brcq-late');
    }

    const late = data.filter((d) => d.left <= 0).length;
    const soon = data.filter((d) => d.left > 0 && d.left <= 24).length;
    const bar = document.createElement('div');
    bar.id = 'brcq-bar';
    bar.innerHTML = `<span>📋 В очереди: <b>${data.length}</b></span>
      <span style="color:#ff5468">🔥 Просрочено: <b>${late}</b></span>
      <span style="color:#ffb547">⏳ Меньше суток: <b>${soon}</b></span>
      <span class="sp"></span><button>⇅ По сроку</button>`;
    const anchorEl = items[0].closest('.block') || items[0].parentElement;
    anchorEl.parentElement.insertBefore(bar, anchorEl);

    bar.querySelector('button').onclick = () => {
      const parent = data[0]?.it.parentElement;
      if (!parent) return;
      // самые горящие — наверх (закреплённые у XenForo в отдельной группе, их не трогаем)
      [...data].sort((a, b) => b.left - a.left).forEach((d) => {
        if (d.it.parentElement === parent) parent.prepend(d.it);
      });
      bar.querySelector('button').textContent = '✓ Отсортировано';
    };
  })();

  /* ===================== ДАЛЬШЕ — ТОЛЬКО В ТЕМАХ ===================== */

  const threadBase =(location.href.match(/^(https:\/\/forum\.blackrussia\.online\/threads\/[^/]+\.\d+\/)/) || [])[1];
  if (!threadBase) return;

  const sec = Object.keys(SECTIONS).map((id) => qs(`.p-breadcrumbs a[href*=".${id}/"]`) && SECTIONS[id]).find(Boolean);
  if (!sec) return;

  const firstMsg = qs('article.message');
  const post = firstMsg && qs('.message-body .bbWrapper', firstMsg);
  const text = post ? post.innerText : '';
  const author = (qs('.message-name .username', firstMsg) || {}).textContent?.trim() || 'игрок';
  const title = () => {
    const el = qs('.p-title-value');
    if (!el) return '';
    const c = el.cloneNode(true);
    c.querySelectorAll('.label, .label-append, .labelLink').forEach((x) => x.remove());
    return c.textContent.replace(/\s+/g, ' ').trim();
  };

  const threadId = (threadBase.match(/\.(\d+)\/$/) || [])[1];
  const authorId = qs('.message-name [data-user-id]', firstMsg)?.getAttribute('data-user-id');
  const RULE = { bio: { copy: '1.4', rw: '2.2' }, sit: { copy: '1.10', rw: '2.4' }, org: { copy: '1.5', rw: '2.5' } }[sec.key];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const token = () => window.XF?.config?.csrf || qs('input[name="_xfToken"]')?.value || '';
  const parseDoc = (h) => new DOMParser().parseFromString(h, 'text/html');
  const RX_MIXED = /[А-Яа-яЁё]+[A-Za-z]+[А-Яа-яЁёA-Za-z]*|[A-Za-z]+[А-Яа-яЁё]+[А-Яа-яЁёA-Za-z]*/g;

  // Результаты поиска XenForo -> [{id, href, title, label, minor, user}]
  function searchResults(d) {
    return [...d.querySelectorAll('li.block-row')].map((li) => {
      const a = li.querySelector('.contentRow-title a[href*="/threads/"]');
      if (!a) return null;
      const href = new URL(a.getAttribute('href'), location.origin).href;
      return {
        id: (href.match(/\.(\d+)\//) || [])[1],
        href: href.replace(/(\/threads\/[^/]+\/).*/, '$1'),
        title: (() => { const c = a.cloneNode(true); c.querySelectorAll('.label').forEach((x) => x.remove());
          return c.textContent.replace(/\s+/g, ' ').replace(/^(Отказано|Одобрено|На рассмотрении|Закрыто)\s*/i, '').trim(); })(),
        label: ((li.querySelector('.contentRow-title .label')?.textContent || '') + ' ' + a.textContent).trim(),
        minor: (li.querySelector('.contentRow-minor')?.textContent || '').replace(/\s+/g, ' ').trim(),
        user: (li.querySelector('.contentRow-minor .username')?.textContent || '').trim(),
      };
    }).filter(Boolean);
  }

  function searchError(d) {
    const e = (d.querySelector('.blockMessage--error, .p-body-pageContent > .blockMessage')?.textContent || '').trim();
    if (/подожд|секунд|wait/i.test(e)) throw new Error('flood');
  }

  async function forumSearch(phrase) {
    const fd = new FormData();
    fd.append('keywords', `"${phrase}"`);
    fd.append('order', 'relevance');
    fd.append('grouped', '1');
    fd.append('_xfToken', token());
    const r = await fetch('/search/search', { method: 'POST', body: fd, credentials: 'same-origin' });
    const d = parseDoc(await r.text());
    searchError(d);
    return searchResults(d);
  }

  // Уникальные фразы из текста (по 8 слов из середины самых длинных предложений)
  function pickPhrases() {
    return text.split(/[.!?…\n]+/)
      .map((s) => s.replace(/^[^:]{0,40}:/, '').match(/[А-Яа-яЁё]+/g) || [])
      .filter((w) => w.length >= 10)
      .sort((a, b) => b.length - a.length)
      .slice(0, 2)
      .map((w) => { const st = Math.floor((w.length - 8) / 2); return w.slice(st, st + 8).join(' '); });
  }
  let copyPhrases = pickPhrases();

  // 1. Копипаст
  async function copyCheck() {
    if (!copyPhrases.length) return { s: 'warn', t: 'Копипаст: мало текста для поиска — проверь через Google' };
    const hits = [];
    for (let i = 0; i < copyPhrases.length; i++) {
      if (i) await sleep(2500);
      hits.push(...(await forumSearch(copyPhrases[i])).filter((h) => h.id !== threadId));
      if (hits.length) break;
    }
    if (!hits.length) return { s: 'ok', t: 'Копипаст: совпадений на форуме нет' };
    const h = hits[0];
    if (h.user && h.user === author) return { s: 'warn', t: `Тот же текст в другой теме автора: «${h.title}»`, link: h.href };
    return { s: 'fail', t: `Копипаст! Совпадение: «${h.title}»${h.user ? ' — ' + h.user : ''}`, link: h.href,
      r: `${sec.what} скопирована у другого игрока: ${h.href} (п. ${RULE.copy}).` };
  }

  // 2. Дубли — другие темы автора
  async function dupCheck() {
    if (sec.key === 'sit') return null;
    if (!authorId) return { s: 'warn', t: 'Дубли: не смог определить автора' };
    const r = await fetch(`/search/member?user_id=${authorId}&content=thread`, { credentials: 'same-origin' });
    const d = parseDoc(await r.text());
    searchError(d);
    const re = sec.key === 'bio' ? /биограф/i : /организац/i;
    const rows = searchResults(d).filter((x) => x.id !== threadId && re.test(x.minor + ' ' + x.title));
    if (!rows.length) return { s: 'ok', t: 'Дубли: других тем автора в разделе нет' };
    // префикс темы важнее названия подраздела
    const st = (x) => /отказ|закрыт/i.test(x.label) ? 'dec' : /одобрен/i.test(x.label) ? 'acc'
      : /отказ/i.test(x.minor) ? 'dec' : /одобрен/i.test(x.minor) ? 'acc' : 'pend';
    const acc = rows.find((x) => st(x) === 'acc');
    const pend = rows.find((x) => st(x) === 'pend');
    if (sec.key === 'bio' && acc) return { s: 'fail', t: `Уже есть одобренная био: «${acc.title}»`, link: acc.href,
      r: `На данный аккаунт уже имеется одобренная RP биография: ${acc.href}` };
    if (pend) return { s: 'fail', t: `Дубль: ещё одна тема «${pend.title}»`, link: pend.href,
      r: `Тема является дублем — у вас уже есть тема на рассмотрении: ${pend.href}` };
    if (acc) return { s: 'warn', t: `У автора уже есть одобренная организация: «${acc.title}»`, link: acc.href };
    return { s: 'ok', t: `Дубли: прошлых тем ${rows.length}, все отказаны`, link: rows[0].href };
  }

  // 4. Доработка — последнее сообщение не от автора содержит "доработк"
  function reworkState() {
    const msgs = [...document.querySelectorAll('article.message')];
    const who = (m) => (qs('.message-name .username', m)?.textContent || '').trim();
    const when = (m) => +(qs('time.u-dt', m)?.getAttribute('data-time') || 0);
    const staff = msgs.filter((m) => m !== firstMsg && who(m) !== author);
    const last = staff[staff.length - 1];
    if (!last || !/доработк/i.test(qs('.bbWrapper', last)?.innerText || '')) return null;
    const t = when(last);
    if (!t) return null;
    const edited = +(qs('.message-lastEdit time', firstMsg)?.getAttribute('data-time') || 0) > t;
    const replied = msgs.some((m) => who(m) === author && when(m) > t);
    return { fixed: edited || replied, edited, left: 24 - Math.floor((Date.now() / 1000 - t) / 3600) };
  }

  /* ===================== ПРОВЕРКИ ===================== */
  // { s: 'ok'|'warn'|'fail', t: 'строка в списке', r: 'причина для ответа' }

  function checkFont() {
    if (!post) return null;
    let total = 0, badFont = 0, badSize = 0;
    const walker = document.createTreeWalker(post, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const len = n.textContent.replace(/\s/g, '').length;
      if (!len) continue;
      total += len;
      const ff = n.parentElement.closest('[style*="font-family"]');
      if (!ff || !FONTS.test(ff.style.fontFamily)) badFont += len;
      const fs = n.parentElement.closest('[style*="font-size"]');
      const px = fs ? parseFloat(fs.style.fontSize) : 0;
      if (!fs || px < MIN_FONT_PX) badSize += len;
    }
    return { total, badFont: badFont / (total || 1), badSize: badSize / (total || 1) };
  }

  async function runChecks() {
    const res = [];
    const words = (text.match(/[A-Za-zА-Яа-яЁё0-9]+/g) || []).length;

    // Заголовок
    res.push(sec.titleRe.test(title())
      ? { s: 'ok', t: 'Заголовок по форме' }
      : { s: 'fail', t: `Заголовок не по форме: «${title().slice(0, 50)}»`, r: `Заголовок темы оформлен не по форме. Правильно: «${sec.titleHint}».` });

    // Объём
    if (sec.minWords) {
      if (words < sec.minWords) res.push({ s: 'fail', t: `Мало слов: ${words}/${sec.minWords}`, r: `Недостаточный объём — ${words} слов при минимуме ${sec.minWords} (п. 1.9).` });
      else if (words > sec.maxWords) res.push({ s: 'fail', t: `Много слов: ${words}/${sec.maxWords}`, r: `Превышен максимальный объём — ${words} слов при максимуме ${sec.maxWords} (п. 1.9).` });
      else res.push({ s: 'ok', t: `Объём: ${words} слов` });
    }

    // Пункты формы
    const miss = sec.fields.filter(([, re]) => !re.test(text)).map(([n]) => n);
    res.push(!miss.length
      ? { s: 'ok', t: 'Все пункты формы на месте' }
      : { s: 'fail', t: `Нет пунктов: ${miss.join(', ')}`, r: `Тема составлена не по форме — отсутствуют пункты: ${miss.join(', ')}.` });

    // Шрифт и размер
    const f = checkFont();
    if (f && f.total) {
      const fontRule = sec.key === 'org' ? 'критерии' : 'п. 1.' + (sec.key === 'bio' ? '6' : '9');
      res.push(f.badFont <= 0.1 ? { s: 'ok', t: 'Шрифт Verdana / Times New Roman' }
        : { s: 'fail', t: `Шрифт не тот (${(f.badFont * 100) | 0}% текста)`, r: `Используется неразрешённый шрифт — допустимы только Verdana и Times New Roman (${fontRule}).` });
      res.push(f.badSize <= 0.1 ? { s: 'ok', t: `Размер шрифта ≥ ${MIN_FONT_PX}` }
        : { s: 'fail', t: `Мелкий шрифт (${(f.badSize * 100) | 0}% текста)`, r: `Размер шрифта меньше минимального (${MIN_FONT_PX}) (${fontRule}).` });
    }

    // Фото / видео
    if (sec.needMedia) {
      const embeds = firstMsg ? firstMsg.querySelectorAll('.message-body img:not(.smilie), .message-attachments img, .message-attachments a.file-preview, .bbMediaWrapper, .bbMediaJustifier, iframe, video').length : 0;
      // ссылки: и кликабельные, и просто текстом (https://radikal.host/...)
      const urls = new Set([
        ...(post ? [...post.querySelectorAll('a[href^="http"]')].map((a) => a.href) : []),
        ...(text.match(/https?:\/\/[^\s<>"']+/gi) || []),
      ].filter((u) => !/forum\.blackrussia\.online/i.test(u)));
      const total = embeds + urls.size;
      res.push(total ? { s: 'ok', t: `Фото/видео: ${embeds ? embeds + ' вставлено' : ''}${embeds && urls.size ? ', ' : ''}${urls.size ? urls.size + ' по ссылке' : ''}` }
        : { s: 'fail', t: 'Нет фото/видео', r: `Отсутствуют фото- или видеоматериалы (п. ${sec.mediaRule}).` });
    }

    // Ссылка на исходники (ситуации)
    if (sec.needSourceLink) {
      const links = (post ? [...post.querySelectorAll('a[href]')].filter((a) => !a.href.includes('forum.blackrussia.online/members')).length : 0)
        + (text.match(/https?:\/\/[^\s<>"']+/gi) || []).length;
      res.push(links ? { s: 'ok', t: 'Есть ссылка на исходники' }
        : { s: 'fail', t: 'Нет ссылки на исходники', r: 'Не предоставлена ссылка на исходные материалы с RP отыгровками (п. 1.8).' });
    }

    // Био: ник в заголовке = имя в анкете, возраст
    if (sec.key === 'bio') {
      const nick = (title().match(RX_NICK) || [])[0];
      const nameLine = (text.match(/(?:имя|фио)[^:\n]{0,30}:\s*([^\n]+)/i) || [])[1] || '';
      if (nick && nameLine.trim()) {
        const [n, s] = nick.split('_');
        res.push(nameLine.includes(n) && nameLine.includes(s)
          ? { s: 'ok', t: 'Ник совпадает с именем в анкете' }
          : { s: 'warn', t: `Ник ${nick} ≠ «${nameLine.trim().slice(0, 30)}»` });
      }
      const age = +((text.match(/возраст[^:\n]*:\s*(\d{1,3})/i) || [])[1] || NaN);
      if (isNaN(age)) res.push({ s: 'warn', t: 'Возраст не указан числом' });
      else if (age < 14 || age > 90) res.push({ s: 'warn', t: `Сомнительный возраст: ${age}` });
      else if (age < 21 && /университет|институт|высше[ег]о|бизнес|миллион|диплом/i.test(text))
        res.push({ s: 'fail', t: `Возраст ${age}, а пишет про вуз/бизнес`, r: `Логическое противоречие: возраст персонажа (${age}) не соответствует описанным событиям (п. 1.10).` });
      else res.push({ s: 'ok', t: `Возраст: ${age}` });
    }

    // Орг: состав, госфракция, биография лидера
    if (sec.key === 'org') {
      const nicks = new Set(text.match(new RegExp(RX_NICK.source, 'g')) || []);
      res.push(nicks.size >= sec.minMembers ? { s: 'ok', t: `Участников: ${nicks.size}` }
        : { s: 'fail', t: `Участников: ${nicks.size}/${sec.minMembers}`, r: `Недостаточный состав участников — минимум ${sec.minMembers} человека.` });

      if (/росгвард|\bмвд\b|\bфсб\b|гибдд|дпс|полици|армия|\bвч\b|фсин|мчс|правительств|прокуратур/i.test(title() + ' ' + (text.match(/название[^\n]*\n?[^\n]*/i) || [''])[0]))
        res.push({ s: 'warn', t: 'Похоже на госфракцию — проверь (п. 1.6)' });

      const bioLink = post && [...post.querySelectorAll('a[href*="forum.blackrussia.online/threads/"]')].map((a) => a.href)[0];
      if (!bioLink) res.push({ s: 'fail', t: 'Нет ссылки на биографию лидера', r: 'Отсутствует ссылка на одобренную RP биографию лидера.' });
      else {
        try {
          const html = await (await fetch(bioLink, { credentials: 'same-origin' })).text();
          const d = new DOMParser().parseFromString(html, 'text/html');
          const pref = (d.querySelector('.p-title-value .label')?.textContent || '').trim();
          const inBio = !!d.querySelector('.p-breadcrumbs a[href*=".2186/"]');
          if (!inBio) res.push({ s: 'warn', t: 'Ссылка ведёт не в раздел биографий' });
          else if (/одобрен/i.test(pref)) res.push({ s: 'ok', t: 'Биография лидера одобрена' });
          else res.push({ s: 'fail', t: `Биография лидера: «${pref || 'без префикса'}»`, r: 'RP биография лидера не одобрена.' });
        } catch { res.push({ s: 'warn', t: 'Не смог открыть биографию лидера' }); }
      }
    }

    // Сверхъестественное
    const sup = text.match(RX_SUPER);
    res.push(sup ? { s: 'warn', t: `Есть «${sup[0]}…» — глянь на нереалистичность` } : { s: 'ok', t: 'Без сверхъестественного' });

    // Капс
    const letters = text.replace(/[^A-Za-zА-Яа-яЁё]/g, '');
    const caps = letters ? letters.replace(/[^A-ZА-ЯЁ]/g, '').length / letters.length : 0;
    res.push(caps < 0.3 ? { s: 'ok', t: 'Без капса' }
      : { s: 'fail', t: `Капс ${(caps * 100) | 0}%`, r: 'Текст нечитабелен — написан с использованием CapsLock.' });

    // Грамотность (эвристика)
    const err = (text.match(/[.!?]\s+[а-яё]/g) || []).length + (text.match(/[а-яё][,.!?][а-яё]/gi) || []).length;
    res.push(err <= 3 ? { s: 'ok', t: 'Явных ошибок оформления нет' }
      : { s: 'warn', t: `Похоже на ошибки (${err}) — проверь глазами` });

    // Смешанные буквы (латиница внутри русских слов — обход антиплагиата)
    const mixed = (text.match(RX_MIXED) || []).length;
    res.push(!mixed ? { s: 'ok', t: 'Без подмены букв' }
      : { s: 'warn', t: `Латиница внутри русских слов: ${mixed} — признак обхода антиплагиата` });

    return res;
  }

  // Причины, которые скрипт сам не ловит — ставятся галочкой вручную
  const MANUAL = {
    bio: [
      'Персонаж обладает сверхспособностями — биография нереалистична (п. 1.2).',
      'Биография существующего человека (п. 1.3).',
      'Биография скопирована у другого игрока (п. 1.4).',
      'Большое количество грамматических и орфографических ошибок (п. 1.5).',
      'Биография содержит факторы, позволяющие нарушать правила сервера (п. 1.8).',
      'В биографии есть логические противоречия (п. 1.10).',
    ],
    sit: [
      'В ситуации присутствует OOC-информация (п. 1.1).',
      'Большое количество грамматических и пунктуационных ошибок (п. 1.2).',
      'Ситуация неправдоподобна / содержит сверхъестественные явления (п. 1.3).',
      'Скриншоты содержат OOC-информацию или интерфейс (п. 1.6).',
      'Ситуация скопирована у другого игрока (п. 1.10).',
      'Нарушены правила форума (п. 1.11).',
      'Ситуация противоречит игровой логике и здравому смыслу (п. 2.2).',
    ],
    org: [
      'Нет чёткого рода деятельности или истории организации.',
      'Отсутствует отличительная визуальная особенность.',
      'Деятельность организации нарушает правила проекта (п. 1.1).',
      'Нарушены правила форума (п. 1.4).',
      'Организация скопирована / воссоздана ранее распущенная (п. 1.5).',
      'Организация создана в форме государственной фракции (п. 1.6).',
      'Название не отражает тематику организации (п. 1.9).',
      'Скриншоты содержат OOC-информацию или интерфейс (п. 1.10).',
      'Описание составлено неграмотно / нечитабельно.',
      'Организация противоречит игровой логике и здравому смыслу (п. 2.2).',
    ],
  };

  /* ===================== ОТВЕТЫ ===================== */

  const G = 'rgb(0, 200, 83)', R = 'rgb(255, 60, 60)', Y = 'rgb(255, 170, 0)';
  const hello = `[CENTER]Здравствуйте, [USER]${author}[/USER].[/CENTER]<br>`;
  const list = (rs) => `[LIST]<br>${rs.map((r) => `[*]${r}`).join('<br>')}<br>[/LIST]<br>`;

  const T = {
    accept: () => `${hello}[CENTER]Требования соблюдены.[/CENTER]<br>[CENTER][COLOR=${G}][B]${sec.what} одобрена.[/B][/COLOR][/CENTER]`
      + (sec.key === 'org' ? `<br>[CENTER]Тема остаётся открытой — публикуйте отчёты о деятельности по форме. Если в течение недели от лидера не будет сообщений, организация будет считаться распущенной.[/CENTER]` : ''),
    decline: (rs) => `${hello}[CENTER]Требования не соблюдены:[/CENTER]<br>${list(rs)}[CENTER][COLOR=${R}][B]${sec.what} отказана.[/B][/COLOR][/CENTER]`,
    rework: (rs) => `${hello}[CENTER]Тема оставлена на доработку. Необходимо исправить:[/CENTER]<br>${list(rs)}[CENTER]На внесение изменений даётся 24 часа. Если тема не будет отредактирована за это время, она будет отказана.[/CENTER]<br>[CENTER][COLOR=${Y}][B]На доработке.[/B][/COLOR][/CENTER]`,
    watch: () => `${hello}[CENTER]Ваша тема взята на рассмотрение. Ожидайте ответа.[/CENTER]<br>[CENTER][COLOR=${Y}][B]На рассмотрении.[/B][/COLOR][/CENTER]`,
  };

  /* ===================== ДЕЙСТВИЯ ===================== */

  function insertReply(html) {
    const fr = qs('.js-quickReply .fr-element') || qs('.fr-element');
    if (fr) {
      qs('.js-quickReply .fr-placeholder')?.remove();
      fr.innerHTML = html.split('<br>').map((l) => `<p>${l || '<br>'}</p>`).join('');
      fr.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    const ta = qs('textarea[name="message"]');
    if (ta) { ta.value = html.replaceAll('<br>', '\n'); return true; }
    return false;
  }

  async function editThread({ prefix, close, sticky }) {
    const fd = new FormData();
    fd.append('title', title());
    if (prefix) fd.append('prefix_id', prefix);
    fd.append('_xfSet[discussion_open]', '1');
    if (!close) fd.append('discussion_open', '1');
    fd.append('_xfSet[sticky]', '1');
    if (sticky) fd.append('sticky', '1');
    fd.append('_xfToken', window.XF?.config?.csrf || qs('input[name="_xfToken"]')?.value || '');
    fd.append('_xfRequestUri', location.pathname);
    fd.append('_xfWithData', '1');
    fd.append('_xfResponseType', 'json');
    const r = await fetch(threadBase + 'edit', { method: 'POST', body: fd, credentials: 'same-origin' });
    const j = await r.json().catch(() => ({}));
    if (j.status && j.status !== 'ok') throw new Error((j.errors || []).join(', ') || 'не удалось изменить тему');
  }

  let pending = null;
  async function choose(html, opts) {
    if (!insertReply(html)) return toast('Не нашёл поле ответа');
    pending = opts;
    showSend('📨 Отправить' + (opts.close ? ' + закрыть' : '') + (opts.sticky ? ' + закрепить' : ''));
    if (AUTO_SEND) await finish();
    else toast('Ответ вставлен — проверь и жми «Отправить»');
  }

  async function finish() {
    if (!pending) return;
    try {
      qs('.js-quickReply button[type="submit"]')?.click();
      await new Promise((r) => setTimeout(r, 1500));
      await editThread(pending);
      toast('Готово ✔');
      setTimeout(() => location.reload(), 800);
    } catch (e) { toast('Ошибка: ' + e.message); }
  }

  /* ===================== ИНТЕРФЕЙС ===================== */

  const css = document.createElement('style');
  css.textContent = `
    #brc{--g:#1ec27a;--r:#ff5468;--y:#ffb547;--b:#3ec6d0;--card:#11181bf2;--line:#ffffff14;--txt:#e6edf0;--mut:#8b9aa1;
      position:relative;margin:14px 0;padding:1px;border-radius:18px;
      background:linear-gradient(135deg,#3ec6d0aa,#1ec27a33 40%,#ffffff10 60%,#3ec6d055);
      box-shadow:0 10px 30px #0008;font:14px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;color:var(--txt)}
    #brc .in{border-radius:17px;background:var(--card);padding:16px;backdrop-filter:blur(6px)}
    #brc .hd{display:flex;align-items:center;gap:14px}
    #brc .ring{position:relative;width:62px;height:62px;flex:none}
    #brc .ring svg{transform:rotate(-90deg)}
    #brc .ring b{position:absolute;inset:0;display:grid;place-items:center;font-size:15px}
    #brc .ttl{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}
    #brc .vrd{font-size:17px;font-weight:800;margin-top:2px}
    #brc .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
    #brc .chip{padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;background:#ffffff0d;border:1px solid var(--line)}
    #brc .chip.g{color:var(--g)}#brc .chip.y{color:var(--y)}#brc .chip.r{color:var(--r)}#brc .chip.t{color:var(--b)}
    #brc .chip.late{color:#fff;background:var(--r);border-color:var(--r)}
    #brc .tog{margin-left:auto;align-self:flex-start;background:none;border:none;color:var(--mut);font-size:18px;cursor:pointer;transition:.2s}
    #brc.min .tog{transform:rotate(180deg)}
    #brc.min .body{display:none}
    #brc .acts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:16px}
    #brc .a{border:none;border-radius:12px;padding:11px 6px;font-weight:800;font-size:13px;color:#fff;cursor:pointer;
      display:flex;flex-direction:column;align-items:center;gap:3px;transition:transform .12s,filter .12s}
    #brc .a span{font-size:18px}
    #brc .a:active{transform:scale(.96)}
    #brc .a.ok{background:linear-gradient(135deg,#1ec27a,#13925a)}
    #brc .a.no{background:linear-gradient(135deg,#ff5468,#c42c40)}
    #brc .a.wt{background:linear-gradient(135deg,#ffb547,#d98512);color:#241500}
    #brc .a[disabled]{filter:grayscale(1) brightness(.55);cursor:not-allowed}
    #brc .a.on{outline:2px solid #fff6;outline-offset:2px}
    #brc .sec{margin-top:16px}
    #brc .sh{font-size:12px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;display:flex;justify-content:space-between;cursor:pointer}
    #brc .it{display:flex;gap:10px;align-items:flex-start;padding:9px 11px;border-radius:10px;background:#ffffff08;margin-bottom:6px;border-left:3px solid}
    #brc .it.fail{border-color:var(--r)}#brc .it.warn{border-color:var(--y)}#brc .it.ok{border-color:var(--g)}
    #brc .ic{width:20px;height:20px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:11px;font-weight:900;color:#000}
    #brc .fail .ic{background:var(--r)}#brc .warn .ic{background:var(--y)}#brc .ok .ic{background:var(--g)}
    #brc .okl{display:none}#brc .okl.open{display:block}
    #brc .rs{display:none;margin-top:14px;padding:12px;border-radius:12px;background:#ff546810;border:1px solid #ff546833}
    #brc .rs.open{display:block}
    #brc .rs .sub{font-size:12px;color:var(--mut);margin:10px 0 6px;font-weight:700}
    #brc .rs .sub:first-child{margin-top:0}
    #brc .ck{display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border-radius:9px;background:#ffffff08;margin-bottom:5px;cursor:pointer}
    #brc .ck input{display:none}
    #brc .ck i{width:18px;height:18px;border-radius:5px;border:2px solid var(--mut);flex:none;margin-top:1px;display:grid;place-items:center;font-style:normal;font-size:12px}
    #brc .ck input:checked + i{background:var(--r);border-color:var(--r);color:#fff}
    #brc .ck input:checked + i::after{content:'✓'}
    #brc .rsb{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
    #brc .send{display:none;width:100%;margin-top:14px;padding:13px;border:none;border-radius:12px;font-weight:800;font-size:15px;color:#fff;
      background:linear-gradient(135deg,#3ec6d0,#1ec27a);box-shadow:0 6px 18px #1ec27a44;cursor:pointer}
    #brc .ft{margin-top:12px;font-size:11px;color:var(--mut);text-align:right}
    #brc .load{display:flex;align-items:center;gap:10px;color:var(--mut)}
    #brc .sp{width:18px;height:18px;border-radius:50%;border:2px solid #3ec6d055;border-top-color:#3ec6d0;animation:brcsp 0.8s linear infinite}
    @keyframes brcsp{to{transform:rotate(360deg)}}
    #brc .bn{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:14px;padding:11px 13px;border-radius:12px;font-weight:600}
    #brc .bn.r{background:#ff546818;border:1px solid #ff546855}#brc .bn.y{background:#ffb54718;border:1px solid #ffb54755}#brc .bn.t{background:#3ec6d018;border:1px solid #3ec6d055}
    #brc .bn .a{flex:1 1 100%;flex-direction:row;justify-content:center}
    #brc .lnk{color:var(--b);font-weight:700;white-space:nowrap}
    #brc .ic .sp{width:12px;height:12px;border-width:2px}
    #brc .it.load{border-color:var(--b);opacity:.8}#brc .load .ic{background:transparent}
    #brc .tools{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
    #brc .tb{flex:1;text-align:center;padding:9px 10px;border-radius:10px;border:1px solid var(--line);background:#ffffff0a;color:var(--txt);font-weight:700;font-size:13px;cursor:pointer;text-decoration:none}
    #brc .tb.on{border-color:var(--b);color:var(--b)}
    #brc .legend{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;font-size:11px}
    #brc .addr{display:flex;gap:6px;margin-top:8px}
    #brc .addr input{flex:1;min-width:0;padding:8px 10px;border-radius:9px;border:1px solid var(--line);background:#0006;color:var(--txt);font-size:13px}
    #brc .addr button{width:40px;border:none;border-radius:9px;background:var(--b);color:#012;font-weight:900;font-size:18px;cursor:pointer}
    #brc .ck .del{margin-left:auto;background:none;border:none;color:var(--mut);font-size:18px;line-height:1;cursor:pointer}
    mark.brc-m{color:inherit;border-radius:3px;padding:0 1px}
    mark.brc-m.copy{background:#a66bff55;outline:1px solid #a66bff}
    mark.brc-m.mix{background:#ff546866;outline:1px solid #ff5468}
    mark.brc-m.caps{background:#ff8a3d55}
    mark.brc-m.low{background:#ffb54755}
    mark.brc-m.sp{background:#ffe14755}
    mark.brc-m.sup{background:#3ec6d055}
    #brc-toast{position:fixed;left:50%;bottom:100px;transform:translateX(-50%) translateY(20px);opacity:0;transition:.25s;
      background:#11181bf2;color:#e6edf0;border:1px solid #3ec6d066;padding:10px 16px;border-radius:12px;z-index:100002;
      box-shadow:0 8px 24px #000a;font:600 13px -apple-system,Segoe UI,Roboto,sans-serif;pointer-events:none}
    #brc-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
  `;
  document.head.appendChild(css);

  const box = document.createElement('div');
  box.id = 'brc';
  box.innerHTML = `<div class="in"><div class="load"><div class="sp"></div>Проверяю тему…</div></div>`;
  const quick = qs('.js-quickReply');
  if (quick) quick.after(box);
  else (qs('.block--messages') || document.body).after(box);

  const toastEl = document.createElement('div');
  toastEl.id = 'brc-toast';
  document.body.appendChild(toastEl);
  function toast(m) {
    toastEl.textContent = m;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- состояние ---------- */
  const esc2 = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const manual = MANUAL[sec.key];
  const custKey = 'custom_' + sec.key;
  const getCust = () => ls.get(custKey, []);
  const rw = reworkState();
  const state = { rsOpen: false, okOpen: false, send: '', hl: false };
  const sel = new Set();      // выбранные причины (текстом)
  const seen = new Set();     // авто-причины, которые уже предлагались
  let checks = [];

  function showSend(label) {
    state.send = label;
    const b = qs('#brc-send');
    if (b) { b.style.display = 'block'; b.textContent = label; }
  }

  /* ---------- 6. подсветка в тексте ---------- */
  let hlOrig = null;
  const reEsc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const HL_RULES = () => [
    ['copy', copyPhrases.length ? new RegExp(copyPhrases.map((p) => p.split(' ').map(reEsc).join('[\\s,;:—–-]+')).join('|'), 'gi') : null, 'Фраза, по которой искали копипаст'],
    ['mix', new RegExp(RX_MIXED.source, 'g'), 'Латиница внутри русского слова'],
    ['caps', /(?<![А-Яа-яЁёA-Za-z])[А-ЯЁ]{4,}(?![А-Яа-яЁёA-Za-z])/g, 'Капс'],
    ['low', /[.!?]\s+[а-яё]/g, 'Предложение с маленькой буквы'],
    ['sp', /[а-яё][,.!?](?=[а-яё])/gi, 'Нет пробела после знака'],
    ['sup', new RegExp(RX_SUPER.source, 'gi'), 'Сверхъестественное'],
  ].filter((r) => r[1]);

  function toggleHL() {
    if (!post) return 0;
    if (hlOrig !== null) { post.innerHTML = hlOrig; hlOrig = null; state.hl = false; return 0; }
    hlOrig = post.innerHTML;
    state.hl = true;
    let count = 0;
    for (const [cls, re, tip] of HL_RULES()) {
      const nodes = [];
      const w = document.createTreeWalker(post, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.parentElement.closest('mark.brc-m') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
      });
      while (w.nextNode()) nodes.push(w.currentNode);
      for (const n of nodes) {
        const str = n.textContent;
        re.lastIndex = 0;
        let m, last = 0, hit = false;
        const frag = document.createDocumentFragment();
        while ((m = re.exec(str))) {
          if (!m[0]) { re.lastIndex++; continue; }
          hit = true;
          frag.append(str.slice(last, m.index));
          const mk = document.createElement('mark');
          mk.className = 'brc-m ' + cls;
          mk.title = tip;
          mk.textContent = m[0];
          frag.append(mk);
          last = m.index + m[0].length;
          count++;
        }
        if (hit) { frag.append(str.slice(last)); n.replaceWith(frag); }
      }
    }
    return count;
  }

  /* ---------- отрисовка ---------- */
  function render() {
    const draft = qs('#brc-newr', box)?.value || '';
    const done = checks.filter((c) => c.s !== 'load');
    const loading = checks.filter((c) => c.s === 'load');
    const ok = done.filter((c) => c.s === 'ok');
    const warns = done.filter((c) => c.s === 'warn');
    const fails = done.filter((c) => c.s === 'fail');
    fails.forEach((f) => { if (!seen.has(f.r)) { seen.add(f.r); sel.add(f.r); } });

    const pct = Math.round((ok.length / (done.length || 1)) * 100);
    const col = fails.length ? 'var(--r)' : warns.length ? 'var(--y)' : 'var(--g)';
    const verdict = fails.length ? `Найдено нарушений: ${fails.length}` : warns.length ? 'Проверь пару моментов' : loading.length ? 'Пока чисто…' : 'Можно одобрять';
    const RR = 26, C = 2 * Math.PI * RR;

    const statusTxt = (qs('.p-title-value .label')?.textContent || '') + ' ' + (qs('.p-breadcrumbs')?.textContent || '');
    const doneSt = /отказ/i.test(statusTxt) ? 'Отказано' : /одобрен/i.test(statusTxt) ? 'Одобрено' : '';
    const posted = doneSt ? null : qs('time.u-dt', firstMsg)?.getAttribute('data-time');
    const hours = posted ? Math.floor((Date.now() / 1000 - +posted) / 3600) : null;
    const timer = doneSt ? `<span class="chip ${doneSt === 'Одобрено' ? 'g' : 'r'}">📁 Уже рассмотрена: ${doneSt}</span>` : hours == null ? '' : hours >= 72
      ? `<span class="chip late">⏱ просрочено (${hours} ч)</span>`
      : `<span class="chip t">⏱ осталось ${72 - hours} ч</span>`;

    const item = (c) => `<div class="it ${c.s}"><div class="ic">${c.s === 'load' ? '<i class="sp"></i>' : { ok: '✓', warn: '!', fail: '✕' }[c.s]}</div>
      <div>${esc2(c.t)}${c.link ? ` <a class="lnk" href="${esc2(c.link)}" target="_blank">открыть ↗</a>` : ''}</div></div>`;
    const ck = (txt, del) => `<label class="ck"><input type="checkbox" data-t="${esc2(txt)}" ${sel.has(txt) ? 'checked' : ''}><i></i><span>${esc2(txt)}</span>${
      del != null ? `<button class="del" data-del="${del}" title="Удалить">×</button>` : ''}</label>`;

    let banner = '';
    if (rw && !rw.fixed && rw.left <= 0) banner = `<div class="bn r"><div>⏰ <b>24 ч на доработку вышли</b> — автор ничего не исправил.</div>
      <button class="a no" id="brc-rwno"><span>⛔</span>Отказать: не исправлено</button></div>`;
    else if (rw && !rw.fixed) banner = `<div class="bn y">🛠 Тема на доработке — у автора осталось <b>${rw.left} ч</b>.</div>`;
    else if (rw && rw.fixed) banner = `<div class="bn t">✏️ Автор ${rw.edited ? 'отредактировал тему' : 'ответил'} после доработки — перепроверь.</div>`;

    const q = copyPhrases[0] ? encodeURIComponent(`"${copyPhrases[0]}"`) : '';
    const cust = getCust();

    box.innerHTML = `<div class="in">
      <div class="hd">
        <div class="ring">
          <svg width="62" height="62"><circle cx="31" cy="31" r="${RR}" stroke="#ffffff14" stroke-width="6" fill="none"/>
            <circle cx="31" cy="31" r="${RR}" stroke="${col}" stroke-width="6" fill="none" stroke-linecap="round"
              stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}" style="transition:stroke-dashoffset .8s"/></svg>
          <b style="color:${col}">${pct}%</b>
        </div>
        <div>
          <div class="ttl">Автопроверка · ${sec.name}</div>
          <div class="vrd" style="color:${col}">${verdict}</div>
          <div class="chips">
            <span class="chip g">✓ ${ok.length}</span><span class="chip y">⚠ ${warns.length}</span><span class="chip r">✕ ${fails.length}</span>${timer}
          </div>
        </div>
        <button class="tog" title="Свернуть">▾</button>
      </div>

      <div class="body">
        ${banner}
        <div class="acts">
          <button class="a ok" id="brc-ok" ${fails.length ? 'disabled title="Есть нарушения"' : ''}><span>✅</span>Одобрить</button>
          <button class="a no ${state.rsOpen ? 'on' : ''}" id="brc-no"><span>⛔</span>Отказ / доработка</button>
          <button class="a wt" id="brc-wt"><span>⏳</span>На рассмотрение</button>
        </div>

        <div class="rs ${state.rsOpen ? 'open' : ''}" id="brc-rs">
          ${fails.length ? '<div class="sub">НАЙДЕНО СКРИПТОМ</div>' + fails.map((f) => ck(f.r)).join('') : ''}
          <div class="sub">ОТМЕТЬ САМ, ЕСЛИ ЕСТЬ</div>
          ${manual.map((m) => ck(m)).join('')}
          ${cust.length ? '<div class="sub">ТВОИ ПРИЧИНЫ</div>' + cust.map((c, i) => ck(c, i)).join('') : ''}
          <div class="addr"><input id="brc-newr" placeholder="Своя причина, например: Нет пункта «Образование» (п. 1.1)"><button id="brc-addr">＋</button></div>
          <div class="rsb">
            <button class="a no" id="brc-decline"><span>⛔</span>Отказать</button>
            <button class="a wt" id="brc-rework"><span>🛠</span>На доработку 24ч</button>
          </div>
        </div>

        <div class="tools">
          <button class="tb ${state.hl ? 'on' : ''}" id="brc-hl">🔍 ${state.hl ? 'Убрать подсветку' : 'Подсветить в тексте'}</button>
          ${q ? `<a class="tb" href="https://www.google.com/search?q=${q}" target="_blank">🌐 Google</a>
                 <a class="tb" href="https://yandex.ru/search/?text=${q}" target="_blank">🌐 Яндекс</a>` : ''}
        </div>
        ${state.hl ? `<div class="legend"><mark class="brc-m copy">копипаст-фраза</mark><mark class="brc-m mix">подмена букв</mark><mark class="brc-m caps">капс</mark><mark class="brc-m low">маленькая буква</mark><mark class="brc-m sp">нет пробела</mark><mark class="brc-m sup">сверхъестеств.</mark></div>` : ''}

        ${fails.length || warns.length || loading.length ? `<div class="sec"><div class="sh">Замечания</div>${[...fails, ...warns, ...loading].map(item).join('')}</div>` : ''}
        <div class="sec">
          <div class="sh" id="brc-okh"><span>Пройдено (${ok.length})</span><span>${state.okOpen ? 'скрыть ▴' : 'показать ▾'}</span></div>
          <div class="okl ${state.okOpen ? 'open' : ''}">${ok.map(item).join('')}</div>
        </div>

        <button class="send" id="brc-send" style="display:${state.send ? 'block' : 'none'}">${state.send}</button>
        <div class="ft">Скрипт кураторов v${VERSION}</div>
      </div>
    </div>`;

    if (ls.get('min', false)) box.classList.add('min');
    if (draft) qs('#brc-newr', box).value = draft;
    bind(fails);
  }

  function bind(fails) {
    const $ = (id) => qs('#' + id, box);
    const reasons = () => {
      const order = [...fails.map((f) => f.r), ...manual, ...getCust()];
      return order.filter((t, i) => sel.has(t) && order.indexOf(t) === i);
    };
    const mark = (id) => box.querySelectorAll('.acts .a').forEach((b) => b.classList.toggle('on', b.id === id));

    qs('.tog', box).onclick = () => { box.classList.toggle('min'); ls.set('min', box.classList.contains('min')); };
    $('brc-okh').onclick = () => { state.okOpen = !state.okOpen; render(); };
    $('brc-send').onclick = finish;

    box.querySelectorAll('.ck input').forEach((inp) => {
      inp.onchange = () => (inp.checked ? sel.add(inp.dataset.t) : sel.delete(inp.dataset.t));
    });
    box.querySelectorAll('.del').forEach((b) => {
      b.onclick = (e) => {
        e.preventDefault();
        const c = getCust(); const [gone] = c.splice(+b.dataset.del, 1);
        sel.delete(gone); ls.set(custKey, c); render();
      };
    });
    const add = () => {
      const v = $('brc-newr').value.trim();
      if (!v) return;
      const c = getCust(); if (!c.includes(v)) c.push(v);
      ls.set(custKey, c); sel.add(v); render(); toast('Причина сохранена');
    };
    $('brc-addr').onclick = add;
    $('brc-newr').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } };

    $('brc-hl').onclick = () => {
      const n = toggleHL();
      render();
      if (state.hl) { toast(n ? `Подсвечено мест: ${n}` : 'Подозрительных мест не нашёл'); post?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    };

    $('brc-no').onclick = () => { state.rsOpen = !state.rsOpen; render(); };
    $('brc-ok').onclick = () => {
      mark('brc-ok');
      choose(T.accept(), sec.key === 'org'
        ? { prefix: PREFIX.ACCEPT, close: false, sticky: true } // орга: открыта + закреп (п. 1.2, 2.4)
        : { prefix: PREFIX.ACCEPT, close: true });
    };
    $('brc-wt').onclick = () => { mark('brc-wt'); choose(T.watch(), { prefix: PREFIX.WATCHED, close: false }); };
    $('brc-decline').onclick = () => {
      const rs = reasons();
      if (!rs.length) return toast('Отметь хотя бы одну причину');
      choose(T.decline(rs), { prefix: PREFIX.DECLINE, close: true });
    };
    $('brc-rework').onclick = () => {
      const rs = reasons();
      if (!rs.length) return toast('Отметь, что нужно исправить');
      choose(T.rework(rs), { prefix: PREFIX.WATCHED, close: false });
    };
    const rwno = $('brc-rwno');
    if (rwno) rwno.onclick = () => choose(T.decline([`Тема не была исправлена в течение 24 часов после отправки на доработку (п. ${RULE.rw}).`]), { prefix: PREFIX.DECLINE, close: true });
  }

  /* ---------- запуск ---------- */
  (async () => {
    checks = await runChecks();
    const LOAD_DUP = { s: 'load', t: 'Ищу другие темы автора…' };
    const LOAD_COPY = { s: 'load', t: 'Ищу копипаст по форуму…' };
    if (sec.key !== 'sit') checks.push(LOAD_DUP);
    checks.push(LOAD_COPY);
    render();

    const cacheKey = 'c_' + threadId;
    const cache = ls.get(cacheKey, null);
    const fresh = cache && Date.now() - cache.ts < 30 * 60e3 && cache.len === text.length;
    const swap = (from, to) => { const i = checks.indexOf(from); if (i >= 0) { if (to) checks[i] = to; else checks.splice(i, 1); } render(); };
    const safe = async (fn) => {
      try { return await fn(); }
      catch (e) { return { s: 'warn', t: e.message === 'flood' ? 'Форум просит подождать с поиском — обнови страницу через минуту' : 'Поиск не сработал: ' + e.message }; }
    };

    let dup, copy;
    if (fresh) { dup = cache.dup; copy = cache.copy; }
    else {
      if (sec.key !== 'sit') { dup = await safe(dupCheck); swap(LOAD_DUP, dup); await sleep(2500); }
      copy = await safe(copyCheck);
      const okToCache = (x) => !x || !/подождать|не сработал/.test(x.t);
      if (okToCache(dup) && okToCache(copy)) ls.set(cacheKey, { ts: Date.now(), len: text.length, dup, copy });
    }
    if (sec.key !== 'sit') swap(LOAD_DUP, dup);
    swap(LOAD_COPY, copy);
  })();
})();
