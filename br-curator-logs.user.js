// ==UserScript==
// @name         BR Curator — Логи
// @namespace    br-curator
// @version      1.3.0
// @description  Сводка по логам Black Russia: игроки, поиск ботов, общие IP, подсветка, быстрые фильтры, отчёты
// @author       Igor_Akentev
// @match        https://logs.blackrussia.online/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/IgorAkentev/br-curator/main/br-curator-logs.user.js
// @downloadURL  https://raw.githubusercontent.com/IgorAkentev/br-curator/main/br-curator-logs.user.js
// @note         1.3.0 — компактное меню ботов: поиск и фильтры сверху, периоды лентой, карточки меньше; мало сообщений = только «подозрение»
// @note         1.2.0 — вкладка «Боты» в шапке сайта вместо кнопки, поиск ботов по периоду, фильтр списка, мобильный вид логов карточками, тема исправлена
// @note         1.1.0 — новый дизайн панели (не ломается от стилей сайта), красивая таблица логов, плашка «Поиск ботов»
// @note         1.0.0 — первая версия: сводка по игрокам, общие IP, подсветка слова, быстрые периоды, отчёт в буфер
// ==/UserScript==

(function () {
  'use strict';
  const VERSION = '1.3.0';
  const ls = {
    get: (k, d) => { try { const v = localStorage.getItem('brcl_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem('brcl_' + k, JSON.stringify(v)); } catch (e) {} },
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const pl = (n, a, b, c) => { const m = n % 100, k = n % 10; return n + ' ' + (m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c); };
  const AD_RE = /(тгк|тг\b|телег|telegram|t\.me|tg\b|@[a-z0-9_]{3,}|discord|дискорд|vk\.com|вк\b|промо|раздач|раздает|раздаёт|бесплатн|халяв|донат\s*за|ссылк)/i;

  // ---------- стили (всё с префиксом brl-, чтобы Bootstrap сайта не ломал) ----------
  const css = `
  #brl-htab{all:unset;box-sizing:border-box;display:inline-flex!important;align-items:center;gap:6px;height:36px;padding:0 12px;margin:0 8px;
    border-radius:11px;background:linear-gradient(135deg,#7c3aed,#b45309);color:#fff!important;font:800 14px/1 system-ui,sans-serif;cursor:pointer;
    white-space:nowrap;box-shadow:0 4px 14px rgba(124,58,237,.35);flex:0 0 auto;width:auto!important}
  #brl-htab:active{transform:scale(.95)}
  #brl-htab .brl-hn{background:#fff;color:#7c2d12;border-radius:8px;padding:2px 6px;font-size:12px}
  #brl-htab.ok .brl-hn{background:#0f766e;color:#fff}
  #brl-htab.float{position:fixed;top:12px;right:118px;z-index:99990}
  #brl-ov{position:fixed;inset:0;z-index:99998;background:rgba(3,6,12,.6);backdrop-filter:blur(2px);display:none}
  #brl-ov.on{display:block}
  #brl-sh{position:fixed;left:0;right:0;bottom:0;z-index:99999;max-height:88dvh;display:none;flex-direction:column;
    background:linear-gradient(180deg,#171b26,#10131b);color:#e5e7eb;border-radius:22px 22px 0 0;
    box-shadow:0 -14px 40px rgba(0,0,0,.6);font:14px/1.45 system-ui,-apple-system,sans-serif;text-align:left}
  #brl-sh.on{display:flex;animation:brlUp .22s ease-out}
  @keyframes brlUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
  #brl-sh *,#brl-sh *::before,#brl-sh *::after{box-sizing:border-box;letter-spacing:normal;text-transform:none}
  #brl-sh .brl-grip{width:42px;height:5px;border-radius:3px;background:#374151;margin:8px auto 0}
  #brl-sh .brl-hd{display:flex;align-items:center;gap:10px;padding:10px 16px 10px}
  #brl-sh .brl-ttl{flex:1;font-size:18px;font-weight:800;color:#fff;margin:0}
  #brl-sh .brl-ttl small{display:block;font-size:11.5px;font-weight:500;color:#8b93a7}
  #brl-sh .brl-ib{all:unset;width:36px;height:36px;border-radius:11px;background:#232836;color:#e5e7eb;text-align:center;
    font:600 17px/36px system-ui;cursor:pointer}
  #brl-sh .brl-tabs{display:flex;gap:6px;margin:0 16px 8px;padding:4px;background:#0d1017;border-radius:13px}
  #brl-sh .brl-tab{all:unset;flex:1;text-align:center;padding:8px 2px;border-radius:10px;color:#9ca3af;font:700 13px system-ui;cursor:pointer}
  #brl-sh .brl-tab.a{background:#7c3aed;color:#fff;box-shadow:0 4px 12px rgba(124,58,237,.35)}
  #brl-sh .brl-tab .brl-n{display:inline-block;margin-left:5px;background:#f59e0b;color:#1a1200;border-radius:8px;padding:0 6px;font-size:11px}
  #brl-sh .brl-bd{overflow:auto;padding:2px 16px 22px;-webkit-overflow-scrolling:touch}
  #brl-sh .brl-c{background:#1b2030;border:1px solid #272e40;border-radius:14px;padding:12px;margin:0 0 10px}
  #brl-sh .brl-c.bot{border-color:#b45309;background:linear-gradient(180deg,#2a1f12,#1b2030 70%)}
  #brl-sh .brl-c.sus{border-color:#854d0e}
  #brl-sh .brl-ln{display:flex;align-items:center;gap:8px;flex-wrap:nowrap}
  #brl-sh .brl-nick{flex:1;min-width:0;font-weight:800;color:#5eead4;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #brl-sh .brl-cnt{flex:0 0 auto;background:#7c3aed;color:#fff;border-radius:999px;padding:2px 10px;font-weight:800;font-size:12px}
  #brl-sh .brl-mut{color:#8b93a7;font-size:12px;margin-top:3px}
  #brl-sh .brl-tags{margin-top:6px;display:flex;flex-wrap:wrap;gap:5px}
  #brl-sh .brl-tag{background:#262c3c;border-radius:7px;padding:2px 7px;font-size:12px;color:#cbd5e1}
  #brl-sh .brl-tag.r{background:#4c1d1d;color:#fecaca}
  #brl-sh .brl-tag.y{background:#422c06;color:#fcd34d}
  #brl-sh .brl-acts{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px}
  #brl-sh .brl-b{all:unset;box-sizing:border-box;text-align:center;background:#262c3c;color:#e5e7eb;border-radius:10px;padding:8px 6px;
    font:700 12.5px/1.2 system-ui;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #brl-sh .brl-b:active{filter:brightness(1.3)}
  #brl-sh .brl-b.p{background:#14b8a6;color:#042420}
  #brl-sh .brl-b.v{background:#7c3aed;color:#fff}
  #brl-sh .brl-b.o{background:#f59e0b;color:#1a1200}
  #brl-sh .brl-row2{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px}
  #brl-sh .brl-stat{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
  #brl-sh .brl-st{background:#0f131c;border-radius:11px;padding:8px;text-align:center}
  #brl-sh .brl-st b{display:block;font-size:19px;color:#fff}
  #brl-sh .brl-st span{font-size:11px;color:#8b93a7}
  #brl-sh .brl-msgs{display:none;margin-top:8px;font-size:12.5px;color:#d1d5db;max-height:240px;overflow:auto}
  #brl-sh .brl-c.open .brl-msgs{display:block}
  #brl-sh .brl-msgs div{border-top:1px dashed #2c3346;padding:5px 0}
  #brl-sh .brl-plate{display:flex;align-items:center;gap:10px;border-radius:14px;padding:12px;margin:0 0 10px;cursor:pointer;
    background:linear-gradient(135deg,#78350f,#b45309);color:#fff7ed}
  #brl-sh .brl-plate.ok{background:linear-gradient(135deg,#064e3b,#0f766e)}
  #brl-sh .brl-plate .brl-ico{font-size:26px}
  #brl-sh .brl-plate b{font-size:15px;display:block}
  #brl-sh .brl-plate small{opacity:.85;font-size:12px}
  #brl-sh .brl-meter{height:6px;border-radius:3px;background:#0f131c;margin-top:8px;overflow:hidden}
  #brl-sh .brl-meter i{display:block;height:100%;background:linear-gradient(90deg,#f59e0b,#ef4444)}
  #brl-sh .brl-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
  #brl-sh .brl-in{all:unset;box-sizing:border-box;width:100%;background:#0d1017;color:#fff;border:1px solid #2a3142;border-radius:11px;padding:10px 11px;font:14px system-ui}
  #brl-sh .brl-lb{display:block;margin:12px 0 6px;color:#8b93a7;font-size:12px;font-weight:600}
  #brl-sh .brl-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
  #brl-sh .brl-chips .brl-b{flex:0 0 auto}
  #brl-sh .brl-sw{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid #222839}
  #brl-sh .brl-sw input{width:20px;height:20px;accent-color:#14b8a6}
  #brl-sh a{color:#5eead4}
  #brl-sh{max-height:92dvh}
  #brl-sh .brl-hd{padding:6px 14px 8px}
  #brl-sh .brl-tabs{margin:0 14px 8px}
  #brl-sh .brl-bd{padding:0 14px 20px}
  #brl-sh .brl-stick{position:sticky;top:0;z-index:2;background:#151924;padding:2px 0 8px;margin:0}
  #brl-sh .brl-seg{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:8px}
  #brl-sh .brl-seg .brl-b{padding:7px 2px;font-size:12px;display:flex;flex-direction:column;gap:1px}
  #brl-sh .brl-seg .brl-b i{font-style:normal;font-size:15px;font-weight:800}
  #brl-sh .brl-seg .k-bot i{color:#f87171}#brl-sh .brl-seg .k-sus i{color:#fcd34d}
  #brl-sh .brl-seg .brl-b.v i{color:#fff}
  #brl-sh .brl-scan{display:flex;gap:6px;overflow-x:auto;padding:2px 0 10px;margin:0;scrollbar-width:none;align-items:center}
  #brl-sh .brl-scan::-webkit-scrollbar{display:none}
  #brl-sh .brl-scan span{flex:0 0 auto;color:#8b93a7;font-size:11.5px;font-weight:700;padding:0 2px 0 4px}
  #brl-sh .brl-scan .brl-b{flex:0 0 auto;padding:7px 11px;border-radius:999px}
  #brl-sh .brl-b.o2{background:#33240b;color:#fcd34d}
  #brl-sh .brl-sc{flex:0 0 auto;border-radius:8px;padding:2px 8px;font:800 12px/1.4 system-ui}
  #brl-sh .brl-sc.bot{background:#ef4444;color:#fff}#brl-sh .brl-sc.sus{background:#f59e0b;color:#1a1200}
  #brl-sh .brl-cnt{background:#262c3c;color:#cbd5e1}
  #brl-sh .brl-c{padding:11px 12px}
  #brl-sh .brl-c.bot{border-color:#7f1d1d;background:linear-gradient(180deg,#2a1414,#1b2030 60%)}
  #brl-sh .brl-c.sus{border-color:#713f12;background:linear-gradient(180deg,#261d0d,#1b2030 60%)}
  #brl-sh .brl-why{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
  #brl-sh .brl-why span{background:#11151f;border:1px solid #2a3142;border-radius:8px;padding:2px 7px;font-size:11.5px;color:#d1d5db}
  #brl-sh .brl-acts .brl-b{padding:7px 4px;font-size:12px}
  #brl-sh .brl-empty{text-align:center;padding:26px 10px;color:#e5e7eb;font-weight:700;font-size:15px}
  #brl-sh .brl-empty small{display:block;color:#8b93a7;font-weight:500;font-size:12px;margin-top:4px}
  #brl-sh .brl-help{color:#8b93a7;font-size:12px;margin-top:4px}
  #brl-sh .brl-help summary{cursor:pointer;color:#a5b4fc;font-weight:600;padding:4px 0}
  #brl-toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:100001;background:#14b8a6;color:#042420;
    padding:10px 16px;border-radius:12px;font:700 14px system-ui;display:none;box-shadow:0 6px 18px rgba(0,0,0,.4)}
  mark.brl-hl{background:#facc15!important;color:#111!important;border-radius:4px;padding:0 3px}
  tr.brl-pick>td{box-shadow:inset 0 0 0 2px #f472b6}
  /* красивые логи */
  html.brl-pretty tr.brl-row,html.brl-pretty tr.brl-row>td,html.brl-pretty tr.brl-row>td *:not(.brl-bot-tag){background:#171c28!important;background-image:none!important;
    color:#d1d5db!important;opacity:1!important;filter:none!important;border-color:#232a3a!important}
  html.brl-pretty tr.brl-row>td.brl-nk,html.brl-pretty tr.brl-row>td.brl-nk a{color:#5eead4!important;font-weight:800!important}
  html.brl-pretty tr.brl-row>td.brl-ct{color:#c4b5fd!important}
  html.brl-pretty tr.brl-msg,html.brl-pretty tr.brl-msg>td,html.brl-pretty tr.brl-msg>td *:not(mark){background:#0f131c!important;background-image:none!important;
    color:#f3f4f6!important;opacity:1!important;filter:none!important}
  html.brl-pretty tr.brl-msg>td{border:0!important;border-left:3px solid #7c3aed!important;font-size:15px!important;padding:10px 14px!important;line-height:1.45!important}
  html.brl-pretty tr.brl-msg.ad>td{border-left-color:#f59e0b!important}
  html.brl-pretty tr.brl-msg pre,html.brl-pretty tr.brl-msg code{white-space:pre-wrap!important;word-break:break-word!important;font-size:12px!important;color:#93c5fd!important;background:#0a0d14!important;border-radius:8px;padding:8px!important}
  html.brl-pretty tr.brl-row.bot,html.brl-pretty tr.brl-row.bot>td,html.brl-pretty tr.brl-row.bot>td *:not(.brl-bot-tag){background:#2b1a10!important}
  .brl-bot-tag{display:inline-block!important;width:auto!important;margin:2px 0 0 6px;border-radius:6px;padding:1px 6px;font:800 11px/16px system-ui!important;vertical-align:middle;
    background:#f59e0b!important;color:#1a1200!important;white-space:nowrap}
  .brl-bot-tag.bot{background:#ef4444!important;color:#fff!important}
  /* телефон: строки логов карточками */
  html.brl-mob .brl-tbl,html.brl-mob .brl-tbl>tbody{display:block!important;width:100%!important;border:0!important;background:none!important}
  html.brl-mob .brl-tbl>thead{display:none!important}
  html.brl-mob tr.brl-row{display:flex!important;flex-wrap:wrap;align-items:center;gap:2px 10px;padding:10px 12px 6px!important;margin:12px 6px 0!important;border-radius:14px 14px 0 0;overflow:hidden}
  html.brl-mob tr.brl-row>td{display:block!important;border:0!important;padding:0!important;width:auto!important;min-width:0!important;height:auto!important;text-align:left!important;font-size:12.5px!important;background:transparent!important}
  html.brl-mob tr.brl-row>td.brl-e,html.brl-mob tr.brl-row>td.brl-cn{display:none!important}
  html.brl-mob tr.brl-row>td.brl-nk{order:1;flex:1 1 auto;font-size:16px!important}
  html.brl-mob tr.brl-row>td.brl-ct{order:2;flex:0 0 auto;font-size:12px!important;background:#2a2347!important;border-radius:8px;padding:2px 8px!important}
  html.brl-mob tr.brl-row>td.brl-tm{order:3;flex:1 0 100%;color:#8b93a7!important}
  html.brl-mob tr.brl-row>td.brl-tm br{display:none}
  html.brl-mob tr.brl-row>td.brl-id,html.brl-mob tr.brl-row>td.brl-ip,html.brl-mob tr.brl-row>td.brl-ot{order:4;color:#8b93a7!important}
  html.brl-mob tr.brl-row>td.brl-id::before{content:'ID '}
  html.brl-mob tr.brl-row>td.brl-ip::before{content:'IP '}
  html.brl-mob tr.brl-row>td.brl-ot::before{content:attr(data-brl-h) ' '}
  html.brl-mob tr.brl-msg{display:block!important;margin:0 6px!important;border-radius:0 0 14px 14px;overflow:hidden}
  html.brl-mob tr.brl-msg>td{display:block!important;width:auto!important;max-width:100%!important;overflow:hidden}
  html.brl-pretty tr.brl-msg2>td{padding-top:0!important}
  html.brl-mob tr.brl-msg.brl-mid{border-radius:0!important;margin-bottom:0!important}
  html.brl-mob tr.brl-row.bot{box-shadow:inset 0 3px 0 #ef4444}
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  if (ls.get('pretty', true)) document.documentElement.classList.add('brl-pretty');
  const mobOn = () => ls.get('mob', innerWidth < 900);
  const applyMob = () => document.documentElement.classList.toggle('brl-mob', mobOn());
  applyMob();

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
  const toMs = (s) => { const m = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2}):?(\d{2})?/.exec(s || ''); return m ? Date.UTC(+m[3], m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0)) : 0; };
  function parse() {
    const table = findTable(); if (!table) return null;
    const m = headMap(table);
    const rows = [...table.querySelectorAll('tr')].filter((r) => !r.querySelector('th'));
    const out = []; let last = null;
    rows.forEach((r) => {
      const tds = [...r.children];
      if (tds.length >= 5) {
        const g = (k) => (m[k] != null && tds[m[k]] ? norm(tds[m[k]].textContent) : '');
        last = { tr: r, time: g('time'), cat: g('cat'), nick: m.nick != null && tds[m.nick] ? norm([...tds[m.nick].childNodes].filter((n) => !(n.classList && n.classList.contains('brl-bot-tag'))).map((n) => n.textContent).join(' ')) : '', pid: g('pid'), ip: g('ip'), acc: g('acc'), sum: g('sum'), after: g('after'), text: '' };
        last.ms = toMs(last.time);
        r.classList.add('brl-row'); table.classList.add('brl-tbl');
        const cls = { time: 'brl-tm', cat: 'brl-ct', nick: 'brl-nk', pid: 'brl-id', ip: 'brl-ip' };
        tds.forEach((td, i) => { const k = Object.keys(m).find((x) => m[x] === i); td.classList.add(k && cls[k] ? cls[k] : i === 0 && !k ? 'brl-cn' : 'brl-ot');
          if (k && !cls[k]) td.dataset.brlH = { acc: 'Аккаунт', sum: 'Сумма', after: '$ после' }[k] || '';
          td.classList.toggle('brl-e', /^[–—-]?$/.test(norm([...td.childNodes].filter((n) => !(n.classList && n.classList.contains('brl-bot-tag'))).map((n) => n.textContent).join('')))); });
        if (m.nick != null && tds[m.nick]) last.nkTd = tds[m.nick];
        out.push(last);
      } else if (last && tds.length >= 1) {
        r.classList.add('brl-msg');
        if (!last.textTr) { last.text = norm(r.textContent); last.textTr = r; if (AD_RE.test(last.text)) r.classList.add('ad'); }
        else { r.classList.add('brl-msg2'); (last.lastMsg || last.textTr).classList.add('brl-mid'); }
        last.lastMsg = r;
      }
    });
    return out.filter((x) => x.nick);
  }
  const bad = (ip) => !ip || /^[–—-]$/.test(ip);
  const subnet = (ip) => (ip || '').split('.').slice(0, 3).join('.');

  function group(list) {
    const by = new Map();
    list.forEach((x) => { const k = x.nick; if (!by.has(k)) by.set(k, { nick: x.nick, pid: x.pid, ips: new Set(), cats: {}, items: [] });
      const g = by.get(k); if (!bad(x.ip)) g.ips.add(x.ip); g.cats[x.cat] = (g.cats[x.cat] || 0) + 1; g.items.push(x); });
    const ipNicks = new Map(), netNicks = new Map(), textNicks = new Map();
    by.forEach((g) => {
      g.ips.forEach((ip) => { if (!ipNicks.has(ip)) ipNicks.set(ip, new Set()); ipNicks.get(ip).add(g.nick);
        const n = subnet(ip); if (!netNicks.has(n)) netNicks.set(n, new Set()); netNicks.get(n).add(g.nick); });
      g.items.forEach((x) => { const t = x.text.toLowerCase(); if (!t) return; if (!textNicks.has(t)) textNicks.set(t, new Set()); textNicks.get(t).add(g.nick); });
    });
    const arr = [...by.values()].sort((a, b) => b.items.length - a.items.length);
    arr.forEach((g) => { g.twins = new Set(); g.ips.forEach((ip) => ipNicks.get(ip).forEach((n) => n !== g.nick && g.twins.add(n))); });
    const res = { arr, ipNicks, netNicks, textNicks, list };
    botScore(res);
    return res;
  }

  // ---------- поиск ботов ----------
  function botScore(r) {
    const ids = r.arr.map((g) => parseInt(g.pid, 10)).filter((n) => n > 0).sort((a, b) => a - b);
    r.arr.forEach((g) => {
      const why = []; let s = 0;
      const n = g.items.length;
      const chat = g.items.filter((x) => /чат|chat|смс|sms|рация|ooc|\/b/i.test(x.cat) || !x.cat);
      const texts = chat.map((x) => x.text.toLowerCase()).filter(Boolean);
      const uniq = new Set(texts).size;
      // 1. повторяет одно и то же
      if (texts.length >= 3 && uniq / texts.length <= 0.5) { s += 30; why.push(`повторяет одно и то же (${uniq} уник. из ${texts.length})`); }
      else if (texts.length >= 2 && uniq < texts.length) { s += 10; why.push('есть повторы сообщений'); }
      // 2. реклама / ссылки
      const ads = texts.filter((t) => AD_RE.test(t)).length;
      if (ads && ads / Math.max(texts.length, 1) >= 0.6) { s += 25; why.push('почти всё — реклама/ссылки'); }
      else if (ads) { s += 10; why.push('упоминает тг/ссылки'); }
      // 3. скорость
      const ms = chat.map((x) => x.ms).filter(Boolean).sort((a, b) => a - b);
      // пачки одинаковых сообщений за пару секунд
      let burst = 0; const ch = chat.slice().sort((a, b) => a.ms - b.ms);
      for (let i = 1; i < ch.length; i++) if (ch[i].text && ch[i].text === ch[i - 1].text && ch[i].ms - ch[i - 1].ms <= 3000) burst++;
      if (burst >= 2) { s += 15; why.push(`шлёт одно и то же подряд (${pl(burst, 'раз', 'раза', 'раз')} за ≤3 сек)`); }
      if (ms.length >= 3) {
        const gaps = []; for (let i = 1; i < ms.length; i++) gaps.push((ms[i] - ms[i - 1]) / 1000);
        gaps.sort((a, b) => a - b); const med = gaps[Math.floor(gaps.length / 2)];
        if (med <= 4) { s += 20; why.push(`пишет каждые ~${Math.round(med)} сек`); }
        else if (med <= 15) { s += 8; why.push(`частые сообщения (~${Math.round(med)} сек)`); }
        g.med = med;
      }
      // 4. одинаковый текст у разных ников
      const clones = new Set(); texts.forEach((t) => (r.textNicks.get(t) || []).forEach((x) => x !== g.nick && clones.add(x)));
      if (clones.size) { s += 20; why.push('тот же текст пишут: ' + [...clones].slice(0, 4).join(', ')); }
      // 5. IP
      if (g.twins.size) { s += 15; why.push('общий IP с: ' + [...g.twins].join(', ')); }
      else { const net = new Set(); g.ips.forEach((ip) => (r.netNicks.get(subnet(ip)) || []).forEach((x) => x !== g.nick && net.add(x)));
        if (net.size) { s += 7; why.push('та же подсеть: ' + [...net].slice(0, 4).join(', ')); } }
      // 6. пачка регистраций (ID рядом)
      const id = parseInt(g.pid, 10);
      if (id) { const near = ids.filter((x) => x !== id && Math.abs(x - id) <= 30).length;
        if (near >= 1) { s += 10; why.push(`ID рядом с ещё ${pl(near, 'игроком', 'игроками', 'игроками')} (пачка регов)`); } }
      // 7. и в RP, и в NonRP одно и то же
      if (Object.keys(g.cats).length >= 2 && uniq < texts.length) { s += 5; why.push('дублирует в разные чаты'); }
      if (texts.length < 5) s = Math.min(s, 50);
      g.score = Math.min(100, s); g.why = why;
      g.lvl = g.score >= 55 ? 'bot' : g.score >= 30 ? 'sus' : '';
    });
    r.bots = r.arr.filter((g) => g.lvl === 'bot'); r.sus = r.arr.filter((g) => g.lvl === 'sus');
    r.arr.forEach((g) => g.items.forEach((x) => {
      x.tr.classList.toggle('bot', g.lvl === 'bot');
      if (x.nkTd) { const old = x.nkTd.querySelector('.brl-bot-tag'); if (old) old.remove();
        if (g.lvl) { const t = document.createElement('span'); t.className = 'brl-bot-tag ' + g.lvl; t.textContent = (g.lvl === 'bot' ? 'БОТ ' : '? ') + g.score + '%'; x.nkTd.appendChild(t); } }
    }));
  }

  // ---------- подсветка ----------
  function currentWord() { const td = new URL(location.href).searchParams.get('td') || ''; return td.replace(/%/g, '').trim(); }
  function highlight(list) {
    const w = (ls.get('hl', '') || currentWord()).trim(); if (!w) return;
    const re = new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    list.forEach((x) => { const el = x.textTr; if (!el || el.dataset.brlHl === w) return;
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const nodes = []; while (walk.nextNode()) nodes.push(walk.currentNode);
      nodes.forEach((n) => { re.lastIndex = 0; if (!re.test(n.nodeValue)) return; re.lastIndex = 0;
        const s = document.createElement('span'); s.innerHTML = esc(n.nodeValue).replace(re, '<mark class="brl-hl">$1</mark>'); n.replaceWith(s); });
      el.dataset.brlHl = w; });
  }

  // ---------- отчёты ----------
  const span = (g) => { const t = g.items.map((x) => x.time).filter(Boolean); return t.length ? (t.length > 1 ? t[t.length - 1] + ' — ' + t[0] : t[0]) : ''; };
  function reportOne(g) {
    const w = currentWord();
    return `${g.nick}${g.pid ? ' (ID ' + g.pid + ')' : ''} — ${pl(g.items.length, 'сообщение', 'сообщения', 'сообщений')}${w ? ' с «' + w + '»' : ''}` +
      `${span(g) ? ', ' + span(g) + ' МСК' : ''}${g.ips.size ? ', IP: ' + [...g.ips].join(', ') : ''}` +
      `${g.twins.size ? ', общий IP с: ' + [...g.twins].join(', ') : ''}`;
  }
  const reportAll = (gr) => { const w = currentWord();
    return `Логи Khabarovsk 49${w ? ' по «' + w + '»' : ''}: ${pl(gr.arr.length, 'игрок', 'игрока', 'игроков')}\n` + gr.arr.map((g, i) => `${i + 1}. ${reportOne(g)}`).join('\n'); };
  const reportBots = (gr) => { const L = [...gr.bots, ...gr.sus];
    return `🤖 Подозрение на ботов — Khabarovsk 49${currentWord() ? ' («' + currentWord() + '»)' : ''}\n` +
      L.map((g, i) => `${i + 1}. ${g.nick}${g.pid ? ' (ID ' + g.pid + ')' : ''} — ${g.lvl === 'bot' ? 'бот' : 'подозрение'} ${g.score}%: ${g.why.join('; ')}`).join('\n'); };

  // ---------- фильтры по ссылке ----------
  function go(params) { const u = new URL(location.href); for (const k in params) params[k] == null ? u.searchParams.delete(k) : u.searchParams.set(k, params[k]); location.href = u.toString(); }
  const period = (h) => { const now = Date.now(); go({ tstart: String(now - h * 3600e3), tend: String(now + 5 * 60e3) }); };
  const searchWord = (w) => { w = w.trim(); go({ td: w ? (w.includes('%') ? w : '%' + w + '%') : null }); };
  function filterNick(nick) {
    const inp = [...document.querySelectorAll('input')].find((i) => /имя игрока|ник/i.test(i.placeholder || ''));
    if (!inp) { copy(nick); toast('Поле ника не нашёл — ник скопирован'); return; }
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(inp, nick);
    inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
    const ap = [...document.querySelectorAll('button')].find((b) => /применить/i.test(b.textContent) && !b.closest('#brl-sh'));
    close(); if (ap) setTimeout(() => ap.click(), 50); else toast('Ник вписан — жми «Применить»');
  }

  // ---------- UI ----------
  const fab = document.createElement('button'); fab.id = 'brl-htab'; fab.type = 'button'; fab.innerHTML = '🤖 Боты';
  function mountTab() {
    if (fab.isConnected && !fab.classList.contains('float')) return;
    const nav = document.querySelector('nav, header, .navbar');
    const tg = nav && (nav.querySelector('.navbar-toggler, button[aria-label*="navig" i], button[data-bs-toggle], button[data-toggle]'));
    if (tg && tg.parentElement) { fab.classList.remove('float'); tg.parentElement.insertBefore(fab, tg); }
    else if (nav) { fab.classList.remove('float'); (nav.querySelector('.container, .container-fluid') || nav).appendChild(fab); }
    else { fab.classList.add('float'); document.body.appendChild(fab); }
  }
  mountTab();
  const ov = document.createElement('div'); ov.id = 'brl-ov'; document.body.appendChild(ov);
  const sh = document.createElement('div'); sh.id = 'brl-sh'; document.body.appendChild(sh);
  let tab = 'bots', data = null, gr = null, bf = '', bl = 'all';
  sh.addEventListener('input', (e) => { if (e.target.id !== 'brl-bf') return; bf = e.target.value; const pos = e.target.selectionStart; draw();
    const i = document.getElementById('brl-bf'); i.focus(); i.setSelectionRange(pos, pos); });
  const close = () => { sh.classList.remove('on'); ov.classList.remove('on'); };
  ov.onclick = close;
  const open = (t) => { if (t) tab = t; refresh(); draw(); sh.classList.add('on'); ov.classList.add('on'); };
  fab.onclick = (e) => { e.preventDefault(); e.stopPropagation(); open('bots'); };

  function refresh() { data = parse(); gr = data ? group(data) : null; if (data) highlight(data); badge(); }
  function badge() {
    const n = gr ? gr.arr.length : 0, b = gr ? gr.bots.length : 0;
    const s = gr ? gr.sus.length : 0; fab.classList.toggle('ok', !b && !s);
    fab.innerHTML = '🤖 Боты' + (gr ? `<span class="brl-hn">${b + s}</span>` : '');
  }

  const sel = '[data-a],[data-t],[data-h],[data-w],[data-bh],[data-bl]';
  const B = (a, t, cls = '', extra = '') => `<button class="brl-b ${cls}" data-a="${a}" ${extra}>${t}</button>`;
  function playerCard(g, i, botView) {
    const tags = [...g.ips].map((ip) => `<span class="brl-tag${gr.ipNicks.get(ip).size > 1 ? ' r' : ''}">${esc(ip)}</span>`).join('') +
      Object.entries(g.cats).map(([c, n]) => `<span class="brl-tag">${esc(c || '?')} · ${n}</span>`).join('');
    const sc = g.lvl ? `<span class="brl-sc ${g.lvl}">${g.score}%</span>` : '';
    const t = g.items.map((x) => x.time.split(' ').pop()).filter(Boolean);
    return `<div class="brl-c ${g.lvl}" data-i="${i}">
      <div class="brl-ln"><span class="brl-nick">${esc(g.nick)}</span>${sc}<span class="brl-cnt" title="сообщений">💬 ${g.items.length}</span></div>
      <div class="brl-mut">ID ${esc(g.pid || '—')} · ${esc(t.length > 1 ? t[t.length - 1] + '–' + t[0] : t[0] || '')}</div>
      <div class="brl-tags">${tags}</div>
      ${botView && g.why.length ? `<div class="brl-why">${g.why.map((x) => `<span>${esc(x)}</span>`).join('')}</div>`
        : g.twins.size ? `<div class="brl-mut" style="color:#fca5a5">Общий IP с: ${[...g.twins].map(esc).join(', ')}</div>` : ''}
      <div class="brl-acts">${B('open', '💬 Текст')}${B('one', '📋')}${B('nick', '🔎 Логи')}${B('show', '👁')}</div>
      <div class="brl-msgs">${g.items.map((x) => `<div><span class="brl-mut">${esc(x.time)} · ${esc(x.cat)}</span><br>${esc(x.text || '—')}</div>`).join('')}</div></div>`;
  }

  function draw() {
    const w = currentWord(); let body = '';
    const nb = gr ? gr.bots.length + gr.sus.length : 0;
    if (tab !== 'flt' && !data) body = `<div class="brl-c">Не нашёл таблицу логов. Дождись загрузки и нажми ⟳. Не помогло — скинь скрин разработчику.</div>`;
    else if (tab !== 'flt' && !data.length) body = `<div class="brl-c">Пусто — по этим фильтрам строк нет.</div>`;
    else if (tab === 'sum') {
      const shared = [...gr.ipNicks.entries()].filter(([, s]) => s.size > 1);
      body += `<div class="brl-plate ${nb ? '' : 'ok'}" data-a="bots"><span class="brl-ico">🤖</span><div style="flex:1"><b>Поиск ботов</b>
        <small>${nb ? `${pl(gr.bots.length, 'бот', 'бота', 'ботов')} · ${pl(gr.sus.length, 'подозрительный', 'подозрительных', 'подозрительных')} — открыть` : 'ботов не видно — чисто'}</small></div><span>›</span></div>`;
      body += `<div class="brl-c"><div class="brl-stat"><div class="brl-st"><b>${data.length}</b><span>строк</span></div>
        <div class="brl-st"><b>${gr.arr.length}</b><span>игроков</span></div><div class="brl-st"><b>${shared.length}</b><span>общих IP</span></div></div>
        ${w ? `<div class="brl-mut" style="margin-top:8px">Поиск: «${esc(w)}»</div>` : ''}
        <div class="brl-row2">${B('all', '📋 Отчёт', 'p')}${B('nicks', 'Ники столбиком')}</div></div>`;
      if (shared.length) body += `<div class="brl-c"><b>⚠️ Общие IP</b>${shared.map(([ip, s]) => `<div class="brl-mut">${esc(ip)} — <span style="color:#fecaca">${[...s].map(esc).join(', ')}</span></div>`).join('')}</div>`;
      gr.arr.forEach((g, i) => (body += playerCard(g, i, false)));
      body += `<div class="brl-mut" style="text-align:center">Считаются только загруженные строки. Подгрузил ещё — жми ⟳.</div>`;
    } else if (tab === 'bots') {
      const q = bf.toLowerCase(), nn = gr.arr.length - nb;
      body += `<div class="brl-stick"><input class="brl-in" id="brl-bf" placeholder="🔍 Ник, ID или IP" value="${esc(bf)}">
        <div class="brl-seg">${[['all', 'Все', nb], ['bot', 'Боты', gr.bots.length], ['sus', 'Подозр.', gr.sus.length], ['ok', 'Норм', nn]]
          .map(([k, t, n]) => `<button class="brl-b ${bl === k ? 'v' : ''} k-${k}" data-bl="${k}">${t}<i>${n}</i></button>`).join('')}</div></div>
        <div class="brl-scan"><span>Искать за</span>${[[0.5, '30м'], [1, '1ч'], [3, '3ч'], [6, '6ч'], [12, '12ч'], [24, '24ч']]
          .map(([h, t]) => `<button class="brl-b" data-bh="${h}">${t}</button>`).join('')}<span>реклама</span>${['тгк', 't.me', 'телег', '@', 'раздает', 'бесплатно', 'промо']
          .map((x) => `<button class="brl-b o2" data-w="${esc(x)}" data-bot="1">${esc(x)}</button>`).join('')}</div>
        <div class="brl-row2" style="margin:0 0 10px">${B('rbots', '📋 Отчёт по ботам', 'o')}${B('nbots', '👤 Ники ботов')}</div>`;
      const L = gr.arr.map((g, i) => [g, i]).filter(([g]) => (bl === 'all' ? g.lvl : bl === 'ok' ? !g.lvl : g.lvl === bl))
        .filter(([g]) => !q || (g.nick + ' ' + g.pid + ' ' + [...g.ips].join(' ')).toLowerCase().includes(q)).sort((a, b) => b[0].score - a[0].score);
      if (!L.length) body += `<div class="brl-empty">${q || bl !== 'all' ? '🤷 Ничего не нашёл' : '👌 Чисто, ботов не видно'}<small>${gr.arr.length} игроков проверено</small></div>`;
      L.forEach(([g, i]) => (body += playerCard(g, i, true)));
      body += `<details class="brl-help"><summary>Как считается?</summary>Повторы текста, реклама/тг, скорость сообщений, одинаковый текст у разных ников, общий IP/подсеть, ID подряд (пачка регов). Только сообщения чатов. Меньше 5 сообщений — максимум «подозрение». Это подсказка — решение за тобой.</details>`;
    } else {
      const words = ls.get('words', ['br_banda', 't.me', 'тгк', 'telegram', 'discord']);
      body = `<label class="brl-lb">Период (от сейчас)</label><div class="brl-grid">${[[1, '1 час'], [3, '3 часа'], [12, '12 часов'], [24, 'Сутки'], [72, '3 дня'], [168, 'Неделя']]
        .map(([h, t]) => `<button class="brl-b" data-h="${h}">${t}</button>`).join('')}</div>
        <label class="brl-lb">Поиск по тексту / описанию</label>
        <div class="brl-ln"><input class="brl-in" id="brl-w" value="${esc(w)}" placeholder="например br_banda">${B('find', 'Искать', 'p', 'style="flex:0 0 auto;padding:11px 14px"')}</div>
        <div class="brl-chips">${words.map((x) => `<button class="brl-b" data-w="${esc(x)}">${esc(x)}</button>`).join('')}${B('clr', '✕ сброс')}</div>
        <label class="brl-lb">Сохранённые слова (через запятую)</label><input class="brl-in" id="brl-ws" value="${esc(words.join(', '))}">
        <label class="brl-lb">Что подсвечивать (пусто = слово из поиска)</label><input class="brl-in" id="brl-hl" value="${esc(ls.get('hl', ''))}">
        <div class="brl-sw" style="margin-top:12px"><span>✨ Красивая таблица логов</span><input type="checkbox" id="brl-pr" ${ls.get('pretty', true) ? 'checked' : ''}></div>
        <div class="brl-sw"><span>📱 Логи карточками (для телефона)</span><input type="checkbox" id="brl-mb" ${mobOn() ? 'checked' : ''}></div>
        <div class="brl-row2">${B('save', 'Сохранить', 'p')}${B('x', 'Закрыть')}</div>
        <div class="brl-mut" style="margin-top:16px;text-align:center">BR Curator Логи v${VERSION} · <a href="https://vk.ru/igor_akentev" target="_blank">связь с разработчиком</a></div>`;
    }
    const t = (id, txt, n) => `<button class="brl-tab ${tab === id ? 'a' : ''}" data-t="${id}">${txt}${n ? `<span class="brl-n">${n}</span>` : ''}</button>`;
    sh.innerHTML = `<div class="brl-grip"></div><div class="brl-hd"><div class="brl-ttl">${tab === 'bots' ? '🤖 Поиск ботов' : tab === 'sum' ? '👥 Игроки' : '⚙️ Фильтры'}<small>Khabarovsk 49${w ? ' · «' + esc(w) + '»' : ''}</small></div>
      <button class="brl-ib" data-a="ref">⟳</button><button class="brl-ib" data-a="x">✕</button></div>
      <div class="brl-tabs">${t('bots', '🤖 Боты', nb)}${t('sum', '👥 Игроки')}${t('flt', '⚙️ Фильтры')}</div>
      <div class="brl-bd">${body}</div>`;
  }

  sh.addEventListener('click', (e) => {
    const b = e.target.closest(sel); if (!b) return;
    const card = b.closest('.brl-c[data-i]'); const g = card && gr.arr[+card.dataset.i];
    if (b.dataset.t) { tab = b.dataset.t; draw(); return; }
    if (b.dataset.h) return period(+b.dataset.h);
    if (b.dataset.bh) { sessionStorage.setItem('brl_open', 'bots'); return go({ td: null, tstart: String(Date.now() - b.dataset.bh * 3600e3), tend: String(Date.now() + 5 * 60e3) }); }
    if (b.dataset.bl) { bl = b.dataset.bl; draw(); return; }
    if (b.dataset.w) { if (b.dataset.bot) sessionStorage.setItem('brl_open', 'bots'); return searchWord(b.dataset.w); }
    switch (b.dataset.a) {
      case 'x': return close();
      case 'ref': refresh(); draw(); return toast('Обновлено');
      case 'bots': tab = 'bots'; return draw();
      case 'all': return copy(reportAll(gr));
      case 'nicks': return copy(gr.arr.map((x) => x.nick).join('\n'));
      case 'rbots': return gr.bots.length + gr.sus.length ? copy(reportBots(gr)) : toast('Ботов нет');
      case 'nbots': return copy([...gr.bots, ...gr.sus].map((x) => x.nick).join('\n'));
      case 'one': return copy(reportOne(g) + (g.lvl ? ` — 🤖 ${g.score}%: ${g.why.join('; ')}` : ''));
      case 'open': card.classList.toggle('open'); return;
      case 'nick': return filterNick(g.nick);
      case 'show': {
        document.querySelectorAll('tr.brl-pick').forEach((r) => r.classList.remove('brl-pick'));
        g.items.forEach((x) => { x.tr.classList.add('brl-pick'); x.textTr && x.textTr.classList.add('brl-pick'); });
        close(); g.items[0].tr.scrollIntoView({ behavior: 'smooth', block: 'center' }); return;
      }
      case 'find': return searchWord(document.getElementById('brl-w').value);
      case 'clr': return searchWord('');
      case 'save': {
        ls.set('words', document.getElementById('brl-ws').value.split(',').map((s) => s.trim()).filter(Boolean));
        ls.set('hl', document.getElementById('brl-hl').value.trim());
        ls.set('mob', document.getElementById('brl-mb').checked); applyMob();
        const pr = document.getElementById('brl-pr').checked; ls.set('pretty', pr); document.documentElement.classList.toggle('brl-pretty', pr);
        refresh(); draw(); return toast('Сохранено');
      }
    }
  });

  // счётчик обновляется сам, когда таблица подгружается
  let tmr, busy = false;
  new MutationObserver((ms) => { if (busy || ms.every((m) => sh.contains(m.target) || fab.contains(m.target) || (m.target.closest && m.target.closest('.brl-nk,.brl-msg')))) return;
    clearTimeout(tmr); tmr = setTimeout(() => { mountTab(); if (!sh.classList.contains('on')) { busy = true; refresh(); setTimeout(() => (busy = false), 50); } }, 700); })
    .observe(document.body, { childList: true, subtree: true });
  setTimeout(() => { mountTab(); refresh(); if (sessionStorage.getItem('brl_open')) { const t = sessionStorage.getItem('brl_open'); sessionStorage.removeItem('brl_open');
    let n = 0; const w = setInterval(() => { refresh(); if ((data && data.length) || ++n > 15) { clearInterval(w); open(t); } }, 600); } }, 800);
})();
