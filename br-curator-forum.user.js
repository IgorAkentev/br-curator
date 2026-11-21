// ==UserScript==
// @name         BR | Кураторы форума — автопроверка (РП био / ситуации / неоф. орг)
// @namespace    br-curator-khabarovsk
// @version      3.2.0
// @description  Проверяет темы по правилам разделов, готовит ответ (одобрено / отказ / доработка), ставит префикс, закрывает или закрепляет тему
// @match        https://forum.blackrussia.online/*
// @updateURL    https://raw.githubusercontent.com/IgorAkentev/br-curator/main/br-curator-forum.user.js
// @downloadURL  https://raw.githubusercontent.com/IgorAkentev/br-curator/main/br-curator-forum.user.js
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

  const VERSION = '3.2.0';
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
      #brc-fab{position:fixed;left:14px;bottom:90px;z-index:100001;width:46px;height:46px;border-radius:50%;border:none;
        background:linear-gradient(135deg,#3ec6d0,#1ec27a);color:#fff;font-size:20px;box-shadow:0 6px 18px #1ec27a55;cursor:pointer}
      #brc-fab .dot{position:absolute;top:2px;right:2px;width:12px;height:12px;border-radius:50%;background:#ff3c3c;display:none}
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
    fab.innerHTML = '🛠<span class="dot"></span>';
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
    fab.onclick = () => (pnl.style.display = pnl.style.display === 'block' ? 'none' : 'block');

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
      const media = firstMsg ? firstMsg.querySelectorAll('.message-body img:not(.smilie), .message-attachments img, .message-attachments a.file-preview, .bbMediaWrapper, .bbMediaJustifier, iframe, video, a[href*="imgur"], a[href*="yapx"], a[href*="youtu"], a[href*="rutube"], a[href*="vk.com/video"], a[href*="disk.yandex"], a[href*="imgbb"], a[href*="postimg"]').length : 0;
      res.push(media ? { s: 'ok', t: `Фото/видео: ${media}` }
        : { s: 'fail', t: 'Нет фото/видео', r: `Отсутствуют фото- или видеоматериалы (п. ${sec.mediaRule}).` });
    }

    // Ссылка на исходники (ситуации)
    if (sec.needSourceLink) {
      const links = post ? [...post.querySelectorAll('a[href]')].filter((a) => !a.href.includes('forum.blackrussia.online/members')).length : 0;
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
    qs('#brc-send').style.display = 'block';
    qs('#brc-send').textContent = '📨 Отправить' + (opts.close ? ' + закрыть' : '') + (opts.sticky ? ' + закрепить' : '');
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

  runChecks().then((checks) => {
    const ok = checks.filter((c) => c.s === 'ok');
    const warns = checks.filter((c) => c.s === 'warn');
    const fails = checks.filter((c) => c.s === 'fail');
    const manual = MANUAL[sec.key];

    const pct = Math.round((ok.length / checks.length) * 100);
    const col = fails.length ? 'var(--r)' : warns.length ? 'var(--y)' : 'var(--g)';
    const verdict = fails.length ? `Найдено нарушений: ${fails.length}` : warns.length ? 'Проверь пару моментов' : 'Можно одобрять';
    const R = 26, C = 2 * Math.PI * R;

    const posted = qs('time.u-dt', firstMsg)?.getAttribute('data-time');
    const hours = posted ? Math.floor((Date.now() / 1000 - +posted) / 3600) : null;
    const timer = hours == null ? '' : hours >= 72
      ? `<span class="chip late">⏱ просрочено (${hours} ч)</span>`
      : `<span class="chip t">⏱ осталось ${72 - hours} ч</span>`;

    const item = (c) => `<div class="it ${c.s}"><div class="ic">${{ ok: '✓', warn: '!', fail: '✕' }[c.s]}</div><div>${esc(c.t)}</div></div>`;
    const ck = (txt, attr, on) => `<label class="ck"><input type="checkbox" ${attr} ${on ? 'checked' : ''}><i></i><span>${esc(txt)}</span></label>`;

    box.innerHTML = `<div class="in">
      <div class="hd">
        <div class="ring">
          <svg width="62" height="62"><circle cx="31" cy="31" r="${R}" stroke="#ffffff14" stroke-width="6" fill="none"/>
            <circle cx="31" cy="31" r="${R}" stroke="${col}" stroke-width="6" fill="none" stroke-linecap="round"
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
        <div class="acts">
          <button class="a ok" id="brc-ok" ${fails.length ? 'disabled title="Есть нарушения"' : ''}><span>✅</span>Одобрить</button>
          <button class="a no" id="brc-no"><span>⛔</span>Отказ / доработка</button>
          <button class="a wt" id="brc-wt"><span>⏳</span>На рассмотрение</button>
        </div>

        <div class="rs" id="brc-rs">
          ${fails.length ? '<div class="sub">НАЙДЕНО СКРИПТОМ</div>' + fails.map((f, i) => ck(f.r, `data-r="${i}"`, true)).join('') : ''}
          <div class="sub">ОТМЕТЬ САМ, ЕСЛИ ЕСТЬ</div>
          ${manual.map((m, i) => ck(m, `data-m="${i}"`, false)).join('')}
          <div class="rsb">
            <button class="a no" id="brc-decline"><span>⛔</span>Отказать</button>
            <button class="a wt" id="brc-rework"><span>🛠</span>На доработку 24ч</button>
          </div>
        </div>

        ${fails.length || warns.length ? `<div class="sec"><div class="sh">Замечания</div>${[...fails, ...warns].map(item).join('')}</div>` : ''}
        <div class="sec">
          <div class="sh" id="brc-okh"><span>Пройдено (${ok.length})</span><span>показать ▾</span></div>
          <div class="okl" id="brc-okl">${ok.map(item).join('')}</div>
        </div>

        <button class="send" id="brc-send">📨 Отправить</button>
        <div class="ft">Скрипт кураторов v${VERSION}</div>
      </div>
    </div>`;

    if (ls.get('min', false)) box.classList.add('min');
    qs('.tog', box).onclick = () => { box.classList.toggle('min'); ls.set('min', box.classList.contains('min')); };

    qs('#brc-okh').onclick = () => {
      const l = qs('#brc-okl'); l.classList.toggle('open');
      qs('#brc-okh span:last-child').textContent = l.classList.contains('open') ? 'скрыть ▴' : 'показать ▾';
    };

    const reasons = () => [
      ...[...box.querySelectorAll('input[data-r]:checked')].map((i) => fails[+i.dataset.r].r),
      ...[...box.querySelectorAll('input[data-m]:checked')].map((i) => manual[+i.dataset.m]),
    ];
    const mark = (id) => box.querySelectorAll('.acts .a').forEach((b) => b.classList.toggle('on', b.id === id));

    qs('#brc-send').onclick = finish;
    qs('#brc-no').onclick = () => { qs('#brc-rs').classList.toggle('open'); mark('brc-no'); };
    qs('#brc-ok').onclick = () => {
      mark('brc-ok');
      choose(T.accept(), sec.key === 'org'
        ? { prefix: PREFIX.ACCEPT, close: false, sticky: true } // орга: открыта + закреп (п. 1.2, 2.4)
        : { prefix: PREFIX.ACCEPT, close: true });
    };
    qs('#brc-wt').onclick = () => { mark('brc-wt'); choose(T.watch(), { prefix: PREFIX.WATCHED, close: false }); };
    qs('#brc-decline').onclick = () => {
      const rs = reasons();
      if (!rs.length) return toast('Отметь хотя бы одну причину');
      choose(T.decline(rs), { prefix: PREFIX.DECLINE, close: true });
    };
    qs('#brc-rework').onclick = () => {
      const rs = reasons();
      if (!rs.length) return toast('Отметь, что нужно исправить');
      choose(T.rework(rs), { prefix: PREFIX.WATCHED, close: false });
    };
  });
})();
