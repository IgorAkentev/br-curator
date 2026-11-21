// ==UserScript==
// @name         BR Curator — Логи
// @namespace    br-curator
// @version      1.0.0
// @description  Сводка по логам Black Russia: группировка по игрокам, общие IP, подсветка, быстрые фильтры, копирование отчёта
// @author       Igor_Akentev
// @match        https://logs.blackrussia.online/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/IgorAkentev/br-curator/main/br-curator-logs.user.js
// @downloadURL  https://raw.githubusercontent.com/IgorAkentev/br-curator/main/br-curator-logs.user.js
// @note         1.0.0 — первая версия: сводка по игрокам, общие IP, подсветка слова, быстрые периоды, отчёт в буфер
// ==/UserScript==

(function () {
  'use strict';
  const VERSION = '1.0.0';
  const ls = {
    get: (k, d) => { try { const v = localStorage.getItem('brcl_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem('brcl_' + k, JSON.stringify(v)); } catch (e) {} },
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const pl = (n, a, b, c) => { const m = n % 100, k = n % 10; return n + ' ' + (m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c); };

  // ---------- стили ----------
  const css = `
  #brl-fab{position:fixed;right:14px;bottom:86px;z-index:99999;width:50px;height:50px;border-radius:50%;border:0;
    background:linear-gradient(135deg,#7c3aed,#14b8a6);color:#fff;font:700 13px/1 system-ui;box-shadow:0 6px 18px rgba(0,0,0,.45);cursor:pointer}
  #brl-fab b{position:absolute;top:-4px;right:-4px;background:#ef4444;border-radius:10px;padding:2px 6px;font-size:11px}
  #brl-ov{position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.55);display:none}
  #brl-sh{position:fixed;left:0;right:0;bottom:0;z-index:99999;max-height:86dvh;display:none;flex-direction:column;
    background:#141821;color:#e5e7eb;border-radius:18px 18px 0 0;box-shadow:0 -10px 30px rgba(0,0,0,.5);font:14px/1.4 system-ui,sans-serif}
  #brl-sh.on,#brl-ov.on{display:flex}#brl-ov.on{display:block}
  #brl-sh .hd{display:flex;align-items:center;gap:8px;padding:14px 16px 8px}
  #brl-sh .hd h3{margin:0;font-size:17px;flex:1;color:#fff}
  #brl-sh .hd small{color:#9ca3af}
  #brl-sh .x{background:#262b36;border:0;color:#fff;border-radius:10px;width:34px;height:34px;font-size:18px}
  #brl-sh .tabs{display:flex;gap:6px;padding:0 16px 8px}
  #brl-sh .tabs button{flex:1;background:#232836;color:#cbd5e1;border:0;border-radius:10px;padding:8px 4px;font-weight:600}
  #brl-sh .tabs button.a{background:#7c3aed;color:#fff}
  #brl-sh .bd{overflow:auto;padding:4px 16px 18px}
  #brl-sh .card{background:#1c212c;border:1px solid #2a3040;border-radius:12px;padding:10px 12px;margin:8px 0}
  #brl-sh .row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  #brl-sh .nick{font-weight:700;color:#5eead4;flex:1;word-break:break-all}
  #brl-sh .cnt{background:#7c3aed;color:#fff;border-radius:999px;padding:2px 9px;font-weight:700;font-size:12px}
  #brl-sh .mut{color:#9ca3af;font-size:12px}
  #brl-sh .tag{display:inline-block;background:#262b36;border-radius:6px;padding:1px 6px;margin:2px 4px 0 0;font-size:12px}
  #brl-sh .warn{background:#7f1d1d;color:#fecaca}
  #brl-sh .msgs{margin-top:6px;font-size:12.5px;color:#cbd5e1;display:none}
  #brl-sh .card.open .msgs{display:block}
  #brl-sh .msgs div{border-top:1px dashed #2a3040;padding:4px 0}
  #brl-sh .btn{background:#262b36;color:#e5e7eb;border:0;border-radius:9px;padding:7px 10px;font-weight:600;font-size:13px}
  #brl-sh .btn.p{background:#14b8a6;color:#04201c}
  #brl-sh .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
  #brl-sh input{width:100%;box-sizing:border-box;background:#0f131a;color:#fff;border:1px solid #2a3040;border-radius:10px;padding:9px 10px;font-size:14px}
  #brl-sh label{display:block;margin:10px 0 4px;color:#9ca3af;font-size:12px}
  #brl-sh .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
  #brl-toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:100000;background:#14b8a6;color:#04201c;
    padding:9px 14px;border-radius:10px;font:600 14px system-ui;display:none}
  mark.brl-hl{background:#facc15;color:#111;border-radius:3px;padding:0 2px}
  tr.brl-pick>td{outline:2px solid #f472b6;outline-offset:-2px}
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const toast = (t) => { let el = document.getElementById('brl-toast'); if (!el) { el = document.createElement('div'); el.id = 'brl-toast'; document.body.appendChild(el); }
    el.textContent = t; el.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => (el.style.display = 'none'), 1800); };
  const copy = async (t) => { try { await navigator.clipboard.writeText(t); } catch (e) {
    const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); } toast('Скопировано'); };

  // ---------- чтение таблицы ----------
  const COLS = { time: /врем/i, cat: /категор/i, nick: /имя\s*игрок|ник/i, pid: /^id\s*игрок/i, ip: /^ip/i, acc: /аккаунт/i, sum: /^сумм/i, after: /после/i };
  function findTable() {
    let best = null, bestN = 0;
    document.querySelectorAll('table').forEach((t) => { const n = t.querySelectorAll('tr').length; if (n > bestN && /врем/i.test(t.textContent)) { best = t; bestN = n; } });
    return best;
  }
  function headMap(table) {
    const map = {}; let hr = table.querySelector('thead tr');
    if (!hr) hr = [...table.querySelectorAll('tr')].find((r) => r.querySelector('th'));
    if (!hr) return map;
    [...hr.children].forEach((c, i) => { const t = norm(c.textContent).replace(/[↓↑⇅]/g, '');
      for (const k in COLS) if (map[k] == null && COLS[k].test(t)) { map[k] = i; break; } });
    return map;
  }
  function parse() {
    const table = findTable(); if (!table) return null;
    const m = headMap(table);
    const rows = [...table.querySelectorAll('tbody tr, tr')].filter((r, i, a) => a.indexOf(r) === i && !r.querySelector('th'));
    const out = []; let last = null;
    rows.forEach((r) => {
      const tds = [...r.children];
      if (tds.length >= 5) {
        const g = (k) => (m[k] != null && tds[m[k]] ? norm(tds[m[k]].textContent) : '');
        last = { tr: r, time: g('time'), cat: g('cat'), nick: g('nick'), pid: g('pid'), ip: g('ip'), acc: g('acc'), sum: g('sum'), after: g('after'), text: '' };
        if (!last.nick) last.nick = norm(tds[3] && tds[3].textContent);
        out.push(last);
      } else if (last && tds.length >= 1 && !last.text) {
        last.text = norm(r.textContent); last.textTr = r;
      }
    });
    return out.filter((x) => x.nick);
  }
  function group(list) {
    const by = new Map();
    list.forEach((x) => { const k = x.nick; if (!by.has(k)) by.set(k, { nick: x.nick, pid: x.pid, ips: new Set(), cats: {}, items: [] });
      const g = by.get(k); if (x.ip && x.ip !== '–' && x.ip !== '-') g.ips.add(x.ip); g.cats[x.cat] = (g.cats[x.cat] || 0) + 1; g.items.push(x); });
    const ipNicks = new Map();
    by.forEach((g) => g.ips.forEach((ip) => { if (!ipNicks.has(ip)) ipNicks.set(ip, new Set()); ipNicks.get(ip).add(g.nick); }));
    const arr = [...by.values()].sort((a, b) => b.items.length - a.items.length);
    arr.forEach((g) => { g.twins = new Set(); g.ips.forEach((ip) => ipNicks.get(ip).forEach((n) => n !== g.nick && g.twins.add(n))); });
    return { arr, ipNicks };
  }

  // ---------- подсветка ----------
  function currentWord() { const td = new URL(location.href).searchParams.get('td') || ''; return td.replace(/%/g, '').trim(); }
  function highlight(list) {
    const w = (ls.get('hl', '') || currentWord()).trim(); if (!w) return;
    const re = new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    list.forEach((x) => { const el = x.textTr; if (!el || el.dataset.brlHl === w) return;
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const nodes = []; while (walk.nextNode()) nodes.push(walk.currentNode);
      nodes.forEach((n) => { if (!re.test(n.nodeValue)) return; re.lastIndex = 0;
        const s = document.createElement('span'); s.innerHTML = esc(n.nodeValue).replace(re, '<mark class="brl-hl">$1</mark>'); n.replaceWith(s); });
      el.dataset.brlHl = w; });
  }

  // ---------- отчёт ----------
  const span = (g) => { const t = g.items.map((x) => x.time).filter(Boolean); return t.length ? (t.length > 1 ? t[t.length - 1] + ' — ' + t[0] : t[0]) : ''; };
  function reportOne(g) {
    const w = currentWord();
    return `${g.nick}${g.pid ? ' (ID ' + g.pid + ')' : ''} — ${pl(g.items.length, 'сообщение', 'сообщения', 'сообщений')}${w ? ' с «' + w + '»' : ''}` +
      `${span(g) ? ', ' + span(g) + ' МСК' : ''}${g.ips.size ? ', IP: ' + [...g.ips].join(', ') : ''}` +
      `${g.twins.size ? ', общий IP с: ' + [...g.twins].join(', ') : ''}`;
  }
  function reportAll(gr) {
    const w = currentWord();
    return `Логи Khabarovsk 49${w ? ' по «' + w + '»' : ''}: ${pl(gr.arr.length, 'игрок', 'игрока', 'игроков')}\n` + gr.arr.map((g, i) => `${i + 1}. ${reportOne(g)}`).join('\n');
  }

  // ---------- фильтры по ссылке ----------
  function go(params) { const u = new URL(location.href); for (const k in params) params[k] == null ? u.searchParams.delete(k) : u.searchParams.set(k, params[k]); location.href = u.toString(); }
  const period = (h) => { const now = Date.now(); go({ tstart: String(now - h * 3600e3), tend: String(now + 5 * 60e3) }); };
  const searchWord = (w) => { w = w.trim(); go({ td: w ? (w.includes('%') ? w : '%' + w + '%') : null }); };
  function filterNick(nick) {
    const inp = [...document.querySelectorAll('input')].find((i) => /имя игрока|ник/i.test(i.placeholder || ''));
    if (!inp) { copy(nick); toast('Поле ника не нашёл — ник скопирован'); return; }
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(inp, nick);
    inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
    const ap = [...document.querySelectorAll('button')].find((b) => /применить/i.test(b.textContent));
    close(); if (ap) setTimeout(() => ap.click(), 50); else toast('Ник вписан — жми «Применить»');
  }

  // ---------- UI ----------
  const fab = document.createElement('button'); fab.id = 'brl-fab'; fab.innerHTML = 'BRC'; document.body.appendChild(fab);
  const ov = document.createElement('div'); ov.id = 'brl-ov'; document.body.appendChild(ov);
  const sh = document.createElement('div'); sh.id = 'brl-sh'; document.body.appendChild(sh);
  let tab = 'sum', data = null, gr = null;
  const close = () => { sh.classList.remove('on'); ov.classList.remove('on'); };
  ov.onclick = close;
  fab.onclick = () => { refresh(); draw(); sh.classList.add('on'); ov.classList.add('on'); };

  function refresh() { data = parse(); gr = data ? group(data) : null; if (data) highlight(data); badge(); }
  function badge() { const n = gr ? gr.arr.length : 0; fab.innerHTML = 'BRC' + (n ? `<b>${n}</b>` : ''); }

  function draw() {
    const w = currentWord();
    let body = '';
    if (tab === 'sum') {
      if (!data) body = `<div class="card">Не нашёл таблицу логов. Дождись загрузки и нажми «Обновить». Если не помогло — скинь скрин разработчику.</div>`;
      else if (!data.length) body = `<div class="card">Пусто — по этим фильтрам строк нет.</div>`;
      else {
        const shared = [...gr.ipNicks.entries()].filter(([, s]) => s.size > 1);
        body += `<div class="card"><div class="row"><div style="flex:1"><b>${pl(data.length, 'строка', 'строки', 'строк')}</b> · ${pl(gr.arr.length, 'игрок', 'игрока', 'игроков')}${w ? ` · «${esc(w)}»` : ''}</div>
          <button class="btn p" data-a="all">📋 Отчёт</button><button class="btn" data-a="nicks">Ники</button></div>
          <div class="mut" style="margin-top:6px">Считаются только загруженные строки. Если логов больше — пролистай/подгрузи и нажми «Обновить».</div></div>`;
        if (shared.length) body += `<div class="card"><b>⚠️ Общие IP</b>${shared.map(([ip, s]) => `<div class="mut" style="margin-top:4px">${esc(ip)}: <span style="color:#fecaca">${[...s].map(esc).join(', ')}</span></div>`).join('')}</div>`;
        gr.arr.forEach((g, i) => {
          body += `<div class="card" data-i="${i}"><div class="row"><span class="nick">${esc(g.nick)}</span><span class="cnt">${g.items.length}</span></div>
            <div class="mut">ID ${esc(g.pid || '—')} · ${esc(span(g))}</div>
            <div>${[...g.ips].map((ip) => `<span class="tag${gr.ipNicks.get(ip).size > 1 ? ' warn' : ''}">${esc(ip)}</span>`).join('')}
            ${Object.entries(g.cats).map(([c, n]) => `<span class="tag">${esc(c || '?')}: ${n}</span>`).join('')}</div>
            ${g.twins.size ? `<div class="mut" style="color:#fca5a5">Общий IP с: ${[...g.twins].map(esc).join(', ')}</div>` : ''}
            <div class="row" style="margin-top:8px"><button class="btn" data-a="open">💬 Сообщения</button><button class="btn" data-a="one">📋</button>
            <button class="btn" data-a="nick">Логи ника</button><button class="btn" data-a="show">👁 В таблице</button></div>
            <div class="msgs">${g.items.map((x) => `<div><span class="mut">${esc(x.time)} · ${esc(x.cat)}</span><br>${esc(x.text || '—')}</div>`).join('')}</div></div>`;
        });
      }
    } else {
      const words = ls.get('words', ['br_banda', 't.me', 'тг', 'telegram', 'discord']);
      body = `<label>Период (от сейчас)</label><div class="grid">${[[1, '1 час'], [3, '3 часа'], [12, '12 часов'], [24, 'Сутки'], [72, '3 дня'], [168, 'Неделя']]
        .map(([h, t]) => `<button class="btn" data-h="${h}">${t}</button>`).join('')}</div>
        <label>Поиск по описанию / тексту</label><div class="row"><input id="brl-w" value="${esc(w)}" placeholder="например br_banda" style="flex:1"><button class="btn p" data-a="find">Искать</button></div>
        <div class="chips">${words.map((x) => `<button class="btn" data-w="${esc(x)}">${esc(x)}</button>`).join('')}<button class="btn" data-a="clr">✕ сброс</button></div>
        <label>Сохранённые слова (через запятую)</label><input id="brl-ws" value="${esc(words.join(', '))}">
        <label>Что подсвечивать (пусто = слово из поиска)</label><input id="brl-hl" value="${esc(ls.get('hl', ''))}">
        <div class="row" style="margin-top:10px"><button class="btn p" data-a="save">Сохранить</button></div>
        <div class="mut" style="margin-top:14px">BR Curator Логи v${VERSION} · <a href="https://vk.ru/igor_akentev" target="_blank" style="color:#5eead4">связь с разработчиком</a></div>`;
    }
    sh.innerHTML = `<div class="hd"><h3>Логи · сводка</h3><button class="x" data-a="ref" title="Обновить">⟳</button><button class="x" data-a="x">✕</button></div>
      <div class="tabs"><button data-t="sum" class="${tab === 'sum' ? 'a' : ''}">Игроки</button><button data-t="flt" class="${tab === 'flt' ? 'a' : ''}">Фильтры</button></div>
      <div class="bd">${body}</div>`;
  }

  sh.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const card = b.closest('.card[data-i]'); const g = card && gr.arr[+card.dataset.i];
    if (b.dataset.t) { tab = b.dataset.t; draw(); return; }
    if (b.dataset.h) return period(+b.dataset.h);
    if (b.dataset.w) return searchWord(b.dataset.w);
    switch (b.dataset.a) {
      case 'x': return close();
      case 'ref': refresh(); draw(); return toast('Обновлено');
      case 'all': return copy(reportAll(gr));
      case 'nicks': return copy(gr.arr.map((x) => x.nick).join('\n'));
      case 'one': return copy(reportOne(g));
      case 'open': card.classList.toggle('open'); return;
      case 'nick': return filterNick(g.nick);
      case 'show': {
        document.querySelectorAll('tr.brl-pick').forEach((r) => r.classList.remove('brl-pick'));
        g.items.forEach((x) => { x.tr.classList.add('brl-pick'); x.textTr && x.textTr.classList.add('brl-pick'); });
        close(); g.items[0].tr.scrollIntoView({ behavior: 'smooth', block: 'center' }); return;
      }
      case 'find': return searchWord(document.getElementById('brl-w').value);
      case 'clr': return searchWord('');
      case 'save':
        ls.set('words', document.getElementById('brl-ws').value.split(',').map((s) => s.trim()).filter(Boolean));
        ls.set('hl', document.getElementById('brl-hl').value.trim()); refresh(); draw(); return toast('Сохранено');
    }
  });

  // авто-обновление счётчика, когда таблица подгружается
  let tmr; new MutationObserver((ms) => { if (ms.every((m) => sh.contains(m.target) || m.target === fab)) return;
    clearTimeout(tmr); tmr = setTimeout(() => { if (!sh.classList.contains('on')) refresh(); }, 600); })
    .observe(document.body, { childList: true, subtree: true });
  setTimeout(refresh, 800);
})();
