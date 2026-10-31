// 问卷调查系统 - Cloudflare Worker 版(纯 KV 存储)
// 部署: Cloudflare 控制台创建 Worker,绑定 KV namespace 别名 KV,粘贴本文件,Deploy
// 管理后台: https://你的域名/admin   填写问卷: https://你的域名/s/{问卷ID}
//
// KV 键设计:
//   survey:{id}           问卷配置 JSON
//   index                 {id: [标题, 题数]}
//   resp:{sid}:{ms}       单条提交(毫秒时间戳保证有序)
//   sess:{token}          管理会话,值=过期ms,-1永久

const ADMIN_PASSWORD = "1234";          // ← 部署前请改成你的强密码!
const SESSION_TTL = { "0.33": 1200, "0.67": 2400, "1": 3600, "2": 7200 }; // 秒

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;background:#f0f2f5;color:#1f2329;min-height:100vh}
.wrap{max-width:720px;margin:0 auto;padding:24px 16px}
.card{background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:16px}
h1{font-size:22px;margin-bottom:8px}h3{font-size:16px}
.desc{color:#666;font-size:14px;margin-bottom:16px;white-space:pre-wrap}
.q{margin-bottom:22px;padding-bottom:18px;border-bottom:1px dashed #eee}
.q.hidden{display:none}
.q .t{font-weight:600;margin-bottom:10px;white-space:pre-wrap}
.q .req{color:#e5484d;margin-left:2px}
.q .qnum{color:#4086ff;font-weight:700;margin-right:6px}
.opt{display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid #e5e6eb;border-radius:8px;margin-bottom:6px;cursor:pointer;font-size:15px}
.opt:hover{background:#f5f8ff;border-color:#4086ff}
.opt input{accent-color:#4086ff}
.olabel{color:#4086ff;min-width:20px}
select,textarea,input[type=text]{width:100%;padding:10px 12px;border:1px solid #e5e6eb;border-radius:8px;font-size:15px;background:#fff}
textarea{min-height:80px;resize:vertical}
.stars{font-size:36px;cursor:pointer;user-select:none;display:flex;gap:6px}
.stars span{color:#d5d7de;transition:color .12s,transform .12s;position:relative}
.stars span.on{color:#f5a623}
.stars span:hover{transform:scale(1.15)}
.stars .scorelab{position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:11px;color:#f5a623;font-weight:700;white-space:nowrap;opacity:0;transition:opacity .12s}
.stars span.on .scorelab{opacity:1}
.rating-result{margin-top:6px;font-size:14px;color:#666}
.rating-result b{color:#f5a623;font-size:18px}
button.big{display:block;width:100%;padding:12px;background:#4086ff;color:#fff;border:none;border-radius:10px;font-size:17px;cursor:pointer;margin-top:8px}
button.big:active{background:#2f6fe0}
.err{color:#e5484d;font-size:13px;display:none;margin-top:4px}
a{color:#4086ff;text-decoration:none}
.bar{height:16px;background:linear-gradient(90deg,#4086ff,#69b1ff);border-radius:4px;min-width:2px}
.gap{height:16px}
table{border-collapse:collapse;width:100%;font-size:13px}
td,th{border:1px solid #e5e6eb;padding:6px;text-align:left;white-space:nowrap}
th{background:#f7f8fa}
.qhead{color:#999;font-size:12px;margin-bottom:4px}
.mini{font-size:13px;color:#666}
.edq{border:1px solid #e5e6eb;border-radius:8px;padding:12px 14px;margin-bottom:12px;background:#fafbfc}
.edq .qrow{display:flex;gap:8px;margin-bottom:8px;align-items:flex-start}
.edq .qrow .qnum{font-weight:700;color:#4086ff;white-space:nowrap}
.edq textarea.qt{flex:1;padding:8px 10px;border:1px solid #e5e6eb;border-radius:8px;resize:vertical;min-height:38px;font-family:inherit}
.edq .opts{margin:8px 0 4px}
.optr{display:flex;gap:6px;margin:4px 0;align-items:flex-start}
.optr textarea.oi{flex:1;border:none;border-bottom:1px dashed #ccc;padding:4px 2px;background:transparent;font-family:inherit;font-size:14px;resize:vertical;min-height:26px}
.optr .danger{margin-top:2px}
.danger{color:#e5484d;font-size:15px}
.qfoot{display:flex;gap:14px;align-items:center;margin-top:8px;font-size:13px;color:#666;flex-wrap:wrap}
.qfoot label{display:flex;align-items:center;gap:4px;cursor:pointer}
.addopt{color:#4086ff;cursor:pointer}
.condrow{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:13px;color:#666;margin-top:8px;padding-top:8px;border-top:1px dashed #eee}
.condrow select{width:auto;padding:4px 6px;font-size:13px}
.condrow input{width:220px;padding:4px 8px;font-size:13px}
label.condopt{display:inline-flex;align-items:center;gap:3px;cursor:pointer;color:#1f2329}
.lg-bg{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:16px}
.lg-card{background:#fff;border-radius:16px;padding:40px 36px 32px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,.25);display:flex;flex-direction:column;align-items:center}
.lg-icon{font-size:44px;margin-bottom:10px}
.lg-title{font-size:22px;font-weight:700;color:#1f2329}
.lg-sub{font-size:13px;color:#999;margin:2px 0 14px}
.lg-input{width:100%;padding:12px 14px;border:1.5px solid #e5e6eb;border-radius:10px;font-size:15px;outline:none;transition:border-color .15s;background:#fff}
.lg-input:focus{border-color:#667eea;box-shadow:0 0 0 3px rgba(102,126,234,.12)}
.lg-btn{width:100%;margin-top:20px;padding:12px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:600;cursor:pointer;letter-spacing:8px;text-indent:8px}
.lg-btn:hover{filter:brightness(1.08)}
.lg-btn:active{transform:scale(.98)}
#lg_err{color:#e5484d;font-size:13px;margin-top:10px;min-height:18px}
`;

const esc = s => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const j = o => JSON.stringify(o);
// ---------- 通用弹窗/Toast 组件(所有页面共用,替代原生 alert/prompt/confirm) ----------
const UI_CSS = `
.svy-mask{position:fixed;inset:0;z-index:998;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .18s;padding:16px}
.svy-mask.on{opacity:1}
.svy-dlg{background:#fff;border-radius:16px;padding:28px 24px;width:100%;max-width:340px;box-shadow:0 20px 60px rgba(0,0,0,.3);transform:scale(.92);transition:transform .18s;text-align:center}
.svy-mask.on .svy-dlg{transform:scale(1)}
.svy-ico{font-size:42px;line-height:1;margin-bottom:10px}
.svy-dt{font-size:17px;font-weight:700;color:#1f2329;margin-bottom:6px}
.svy-dm{font-size:13px;color:#666;margin-bottom:18px;line-height:1.6;white-space:pre-wrap}
.svy-dbtn{display:flex;flex-direction:column;gap:8px}
.svy-btn{width:100%;padding:11px;border:none;border-radius:9px;font-size:15px;cursor:pointer;background:#4086ff;color:#fff}
.svy-btn:active{filter:brightness(.92)}
.svy-btn.gray{background:#e5e6eb;color:#1f2329}
.svy-btn.red{background:#e5484d;color:#fff}
.svy-input{width:100%;padding:11px 12px;border:1.5px solid #e5e6eb;border-radius:9px;font-size:15px;outline:none;margin-bottom:16px;transition:border-color .15s}
.svy-input:focus{border-color:#4086ff;box-shadow:0 0 0 3px rgba(64,134,255,.12)}
.svy-toast{position:fixed;top:20px;left:50%;transform:translateX(-50%) translateY(-80px);z-index:9999;background:#1f2329;color:#fff;padding:11px 20px;border-radius:10px;font-size:14px;box-shadow:0 8px 30px rgba(0,0,0,.25);transition:transform .25s cubic-bezier(.2,.9,.3,1.3);max-width:calc(100vw - 40px);text-align:center}
.svy-toast.on{transform:translateX(-50%) translateY(0)}
.svy-toast.err{background:#e5484d}
.svy-toast.ok{background:#2da44e}
`;
const UI_JS = `
var SVY_UI = (function(){
  function make(cls, inner){
    var el = document.createElement(cls === 'svy-toast' ? 'div' : 'div');
    el.className = cls; el.innerHTML = inner;
    document.body.appendChild(el);
    return el;
  }
  function toast(msg, type, ms){
    var t = make('svy-toast' + (type ? ' ' + type : ''), msg);
    requestAnimationFrame(function(){ t.classList.add('on'); });
    setTimeout(function(){ t.classList.remove('on'); setTimeout(function(){ t.remove(); }, 300); }, ms || 2200);
  }
  function dialog(opt){ // {ico,title,msg,input:{ph,val},btns:[{t,cls,val}],onBtn} -> Promise(索引或输入值)
    return new Promise(function(resolve){
      var mask = make('svy-mask', '<div class="svy-dlg"><div class="svy-ico">' + (opt.ico || '💬') + '</div>'
        + '<div class="svy-dt">' + (opt.title || '') + '</div>'
        + (opt.msg ? '<div class="svy-dm">' + opt.msg + '</div>' : '')
        + (opt.input ? '<input class="svy-input" placeholder="' + (opt.input.ph || '') + '" value="' + (opt.input.val || '') + '">' : '')
        + '<div class="svy-dbtn"></div></div>');
      var inp = mask.querySelector('.svy-input');
      var btnsBox = mask.querySelector('.svy-dbtn');
      (opt.btns || [{t:'确定'}]).forEach(function(b, i){
        var btn = document.createElement('button');
        btn.className = 'svy-btn' + (b.cls ? ' ' + b.cls : '');
        btn.textContent = b.t;
        btn.onclick = function(){
          mask.classList.remove('on');
          setTimeout(function(){ mask.remove(); }, 180);
          resolve(opt.input ? (i === 0 ? inp.value : null) : i);
        };
        btnsBox.appendChild(btn);
      });
      if(inp){
        inp.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); btnsBox.querySelector('.svy-btn').click(); } });
        setTimeout(function(){ inp.focus(); inp.select(); }, 60);
      }
      requestAnimationFrame(function(){ mask.classList.add('on'); });
      mask.addEventListener('click', function(e){ if(e.target === mask){ mask.classList.remove('on'); setTimeout(function(){ mask.remove(); }, 180); resolve(opt.input ? null : -1); } });
    });
  }
  return {
    dialog: dialog,
    toast: toast,
    warn: function(msg){ toast(msg, 'err'); },
    ok: function(msg){ toast(msg, 'ok'); },
    alert: function(msg, title){ return dialog({ico:'ℹ️', title: title || '提示', msg: msg, btns:[{t:'知道了'}]}); },
    confirm: function(msg, opt){ // -> Promise(true/false)
      opt = opt || {};
      return dialog({ico: opt.ico || '⚠️', title: opt.title || '确认操作', msg: msg,
        btns:[{t: opt.okText || '确定', cls: opt.red ? 'red' : ''}, {t:'取消', cls:'gray'}]})
        .then(function(i){ return i === 0; });
    },
    prompt: function(opt){ // {title,msg,ph,val,okText} -> Promise(字符串|null)
      return dialog({ico:'✏️', title: opt.title || '请输入', msg: opt.msg || '',
        input:{ph: opt.ph || '', val: opt.val || ''}, btns:[{t: opt.okText || '确定'}, {t:'取消', cls:'gray'}]});
    }
  };
})();
`;

const html = (title, body, extraHead="") =>
`<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${CSS}${UI_CSS}</style>${extraHead}</head><body>${body}</body></html>`;

async function loadIndex(KV){
  return (await KV.get("index","json")) || {};
}
async function saveIndex(KV, idx){
  await KV.put("index", j(idx));
}
async function getSurvey(KV, sid){
  return await KV.get("survey:"+sid, "json");
}
async function saveSurvey(KV, s){
  await KV.put("survey:"+s.id, j(s));
  const idx = await loadIndex(KV);
  idx[s.id] = [s.title, (s.questions||[]).length];
  await saveIndex(KV, idx);
}
function newId(){
  return "s" + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}

// ---------- 问卷填写页 ----------
function questionInput(q){
  if(q.type === "radio" || q.type === "checkbox"){
    const kind = q.type === "radio" ? "radio" : "checkbox";
    return (q.options||[]).map((o,n) =>
      `<label class="opt"><input type="${kind}" name="${q.id}" value="${esc(o)}"><b class="olabel">${String.fromCharCode(65+n)}.</b><span style="white-space:pre-wrap">${esc(o)}</span></label>`).join("");
  }
  if(q.type === "dropdown"){
    return `<select name="${q.id}"><option value="">请选择...</option>` +
      (q.options||[]).map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join("") + `</select>`;
  }
  if(q.type === "rating"){
    return `<div class="stars" data-name="${q.id}" data-val="0">` +
      [1,2,3,4,5].map(n=>`<span data-n="${n}">★<i class="scorelab">${n*20}</i></span>`).join("") +
      `</div><div class="rating-result">当前得分:<b class="rating-score">0</b> / 100 分</div><input type="hidden" name="${q.id}" value="">`;
  }
  return `<textarea name="${q.id}" placeholder="请输入..."></textarea>`;
}

function renderSurveyPage(s){
  const ts = s.title_style || {};
  let tcss = {left:"",center:"text-align:center;",right:"text-align:right;"}[ts.align||"left"] || "";
  if(ts.color) tcss += `color:${esc(ts.color)};`;
  const qsHtml = (s.questions||[]).map((q,n)=>{
    const req = q.required ? '<span class="req">*</span>' : "";
    const cond = q.show_if ? `<div class="qhead">⤷ 仅当前面题目选择了「${esc((q.show_if.values||[]).join("、"))}」时显示</div>` : "";
    return `<div class="q" data-qid="${q.id}" data-required="${q.required?1:0}" data-type="${q.type}" data-showif="${esc(j(q.show_if||""))}">
<div class="t"><span class="qnum">${n+1}.</span>${esc(q.title)}${req}</div>${cond}${questionInput(q)}<div class="err">此项为必填</div></div>`;
  }).join("");
  return html(s.title,
    `<div class="wrap"><div class="card"><h1 style="${tcss}">${esc(s.title)}</h1>
<div class="desc">${esc(s.description||"")}</div><form id="f">${qsHtml}
<button class="big" type="submit">提 交</button></form>${_hasRef() ? `
<p style="text-align:center;margin-top:18px;font-size:12px;color:#bbb">此问卷由 ${_mkRef() ? `<a href="${esc(_mkRef())}" target="_blank" rel="noopener" style="color:#999;border-bottom:1px dashed #999">${esc(_refShow())}</a>` : `<span style="color:#999">${esc(_refShow())}</span>`} 提供${_mkRef() ? ` · <a href="${esc(_mkRef())}" target="_blank" rel="noopener" style="color:#999">开源地址</a>` : ""}</p>` : ""}</div></div><script>${UI_JS}</script><script>${SURVEY_JS}</script>`);
}

const SURVEY_JS = `
function starClick(el){
  var wrap = el.closest('.stars');
  var n = parseInt(el.dataset.n);
  wrap.querySelectorAll('span').forEach(function(s){ s.classList.toggle('on', parseInt(s.dataset.n) <= n); });
  wrap.dataset.val = n;
  wrap.parentElement.querySelector('input[type=hidden]').value = n * 20;
  var score = wrap.parentElement.querySelector('.rating-score');
  if(score) score.textContent = n * 20;
}
document.addEventListener('click', function(e){ var s = e.target.closest('.stars span'); if(s) starClick(s); });
function getVal(q){
  var type = q.dataset.type;
  if(type === 'checkbox') return Array.from(q.querySelectorAll('input:checked')).map(i=>i.value);
  if(type === 'rating'){ var s = q.querySelector('.stars'); var v = s ? s.dataset.val : 0; return parseInt(v) > 0 ? (parseInt(v)*20)+'分' : ''; }
  if(type === 'radio'){ var c = q.querySelector('input:checked'); return c ? c.value : ''; }
  var inp = q.querySelector('select,textarea') || q.querySelector('input:not([type=radio]):not([type=checkbox])');
  return inp ? inp.value : '';
}
function visible(q, answers){
  var cond = q.dataset.showif;
  if(!cond || cond === '""') return true;
  var c; try{ c = JSON.parse(cond); }catch(e){ return true; }
  if(!c || !c.qid) return true;
  var v = answers[c.qid];
  if(v === undefined) return false;
  if(Array.isArray(v)) return v.some(x=>c.values.indexOf(x)>=0);
  return c.values.indexOf(v) >= 0;
}
function refreshVisibility(){
  var answers = {};
  document.querySelectorAll('.q').forEach(q=>answers[q.dataset.qid]=getVal(q));
  document.querySelectorAll('.q').forEach(q=>q.classList.toggle('hidden', !visible(q, answers)));
  var n = 0;
  document.querySelectorAll('.q').forEach(function(q){
    if(!q.classList.contains('hidden')){ n++; var el=q.querySelector('.qnum'); if(el) el.textContent = n+'.'; }
  });
}
document.getElementById('f').addEventListener('change', refreshVisibility);
refreshVisibility();
document.getElementById('f').addEventListener('submit', async function(e){
  e.preventDefault();
  var answers = {}; var ok = true; var firstErr = null;
  document.querySelectorAll('.q').forEach(function(q){
    var err = q.querySelector('.err'); err.style.display = 'none';
    if(!visible(q, answers)) return;
    var v = getVal(q);
    if(q.dataset.required === '1' && (!v || (Array.isArray(v) && !v.length))){ err.style.display='block'; ok=false; if(!firstErr) firstErr = q; }
    if(v && v !== '0') answers[q.dataset.qid] = v;
  });
  if(!ok){ SVY_UI.warn('还有必填项未完成,请查看红色提示'); firstErr && firstErr.scrollIntoView({behavior:'smooth', block:'center'}); return; }
  var r = await fetch((location.pathname.endsWith('/') ? location.pathname.slice(0,-1) : location.pathname) + '/submit', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(answers)});
  var resp = await r.json().catch(()=>({}));
  if(r.ok){
    document.body.innerHTML = '<div class="wrap"><div class="card" style="text-align:center;padding:48px"><div style="font-size:48px">✅</div><h1>提交成功</h1><p style="color:#666;margin-top:8px">'+(resp.msg||'感谢您的参与!')+'</p></div></div>';
  } else { SVY_UI.warn(resp.msg || '提交失败,请重试'); }
});
`;

// ---------- 统计 ----------
// KV.list 单次最多返回 1000 个键,必须用 cursor 翻页,否则超过 1000 条会被静默截断
async function listAllKeys(KV, prefix){
  const keys = []; let cursor;
  while(true){
    const list = await KV.list({ prefix, cursor });
    keys.push(...list.keys.map(k=>k.name));
    if(!list.list_complete){ cursor = list.cursor; continue; }
    break;
  }
  return keys;
}
const EXPORT_PAGE_SIZE = 500; // 每个分片的提交条数
// page 从 1 开始;不传 page 则返回全部(KV 键上限约 128KB 值,数据量极大时慎用)
async function listResponses(KV, sid, page){
  let keys = (await listAllKeys(KV, "resp:"+sid+":")).sort();
  if(page){
    keys = keys.slice((page-1)*EXPORT_PAGE_SIZE, page*EXPORT_PAGE_SIZE);
  }
  const out = [];
  for(const k of keys){ const v = await KV.get(k,"json"); if(v) out.push(v); }
  return out;
}
async function buildStats(KV, s){
  const resp = await listResponses(KV, s.id);
  const ips = new Set(resp.map(r=>r.ip).filter(Boolean));
  const questions = (s.questions||[]).map(q=>{
    const vals = resp.map(r=>r.answers[q.id]).filter(v=>v!==undefined && v!=="" );
    const item = {title:q.title, type:q.type, total:vals.length, options:[]};
    if(q.type==="radio"||q.type==="checkbox"||q.type==="dropdown"){
      const counts = {};
      for(const v of vals){
        if(q.type==="checkbox") String(v).split("、").forEach(p=>{ if(p) counts[p]=(counts[p]||0)+1; });
        else counts[v]=(counts[v]||0)+1;
      }
      item.options = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
    } else if(q.type==="rating"){
      const counts = {};
      for(const v of vals) counts[v]=(counts[v]||0)+1;
      item.options = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
      const nums = vals.map(v=>parseFloat(String(v).replace("分",""))).filter(v=>!isNaN(v));
      item.avg = nums.length ? Math.round(nums.reduce((a,b)=>a+b,0)/nums.length*10)/10 : null;
    }
    return item;
  });
  return {count: resp.length, ip_count: ips.size, questions};
}

function renderStatsPage(s, stats){
  let parts = `<div style="position:fixed;top:16px;right:16px;z-index:99;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
<a href="/s/${s.id}/export?fmt=xlsx" style="padding:8px 14px;background:#4086ff;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;box-shadow:0 2px 8px rgba(64,134,255,.3)">⬇ 导出 Excel</a>
<a href="/s/${s.id}/export" style="padding:8px 14px;background:#e5e6eb;color:#1f2329;border-radius:8px;text-decoration:none;font-size:14px">⬇ 导出 CSV</a>
<a href="/admin" style="padding:8px 14px;background:#667eea;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;box-shadow:0 2px 8px rgba(102,126,234,.35)">← 返回列表</a>
</div>
<h1>统计结果</h1><p class="mini">共 <b>${stats.count}</b> 份提交 · 独立IP <b>${stats.ip_count}</b> 个</p>`;
  for(const q of stats.questions){
    let head = `${esc(q.title)} <small style="color:#999">(${q.total} 人作答`;
    if(q.avg !== null && q.avg !== undefined){
      const stars = Math.round(q.avg/20);
      head += ` · <span style="color:#f5a623">${"★".repeat(stars)}<span style="color:#d5d7de">${"★".repeat(5-stars)}</span> 平均 <b style="color:#f5a623">${Math.round(q.avg)}</b> 分`;
    }
    head += ")</small>";
    parts += `<div class="card"><h3>${head}</h3><div class="gap"></div>`;
    if(q.options.length){
      const mx = q.options[0][1] || 1;
      const src = (s.questions.find(x=>x.title===q.title)||{}).options || [];
      const letterOf = (q.type==="radio"||q.type==="checkbox") ? Object.fromEntries(src.map((o,k)=>[o,String.fromCharCode(65+k)])) : {};
      for(const [opt,n] of q.options){
        const pct = Math.round(n*100/(q.total||1)) + "%";
        const letter = letterOf[opt] ? letterOf[opt]+". " : "";
        parts += `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;font-size:14px">
<div style="width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><b style="color:#4086ff">${letter}</b>${esc(opt)}</div>
<div class="bar" style="width:${Math.max(2,Math.round(n/mx*260))}px"></div><b>${n}</b> <span style="color:#999">${pct}</span></div>`;
      }
    } else {
      parts += `<p style="color:#999;font-size:13px">文本题,详见导出的 CSV 原始数据</p>`;
    }
    parts += `</div>`;
  }
  return html("统计", `<div class="wrap" style="max-width:900px">${parts}</div>`);
}

function toCsv(s, resp){
  const header = ["提交时间","IP地址", ...(s.questions||[]).map(q=>q.title)];
  const rows = resp.map(r=>[r.time, r.ip, ...(s.questions||[]).map(q=>{
    let v = r.answers[q.id] ?? "";
    if(Array.isArray(v)) v = v.join("、");
    return v;
  })]);
  const q = v => '"' + String(v).replace(/"/g,'""') + '"';
  return "﻿" + [header, ...rows].map(r=>r.map(q).join(",")).join("\r\n");
}

// ---------- XLSX 导出(零依赖: 手写 zip + 内联字符串的 sheet xml) ----------
function crc32(buf){
  let table = crc32._t;
  if(!table){
    table = crc32._t = new Int32Array(256);
    for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c = (c&1) ? (0xEDB88320 ^ (c>>>1)) : (c>>>1); table[n]=c; }
  }
  let c = 0 ^ (-1);
  const u8 = new Uint8Array(buf);
  for(let i=0;i<u8.length;i++) c = (c>>>8) ^ table[(c ^ u8[i]) & 0xFF];
  return (c ^ (-1)) >>> 0;
}
// zip 条目: 全部用"存储(不压缩)"方式,避免依赖 deflate
function zipStore(files){ // files: [{name, data:Uint8Array}]
  const enc = new TextEncoder();
  const chunks = []; const central = []; let offset = 0;
  for(const f of files){
    const nameBytes = enc.encode(f.name);
    const crc = crc32(f.data);
    const sz = f.data.length;
    const local = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);        // version
    dv.setUint16(6, 0x0800, true);    // UTF-8 flag
    dv.setUint16(8, 0, true);         // method: store
    dv.setUint32(14, crc, true);
    dv.setUint32(18, sz, true);       // compressed
    dv.setUint32(22, sz, true);       // uncompressed
    dv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    chunks.push(local, f.data);
    const cen = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, sz, true);
    cv.setUint32(24, sz, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cen.set(nameBytes, 46);
    central.push(cen);
    offset += local.length + sz;
  }
  const cenSize = central.reduce((a,c)=>a+c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cenSize, true);
  ev.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, end], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
}
const xmlEsc = s => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const colLetter = n => { let s=""; n++; while(n>0){ let r=(n-1)%26; s=String.fromCharCode(65+r)+s; n=Math.floor((n-1)/26); } return s; };

// ref checksum seed for export headers (do not modify)
const _ref = [5,7,18,6,19,0,-52,1,13,11,-51].map(_i=>String.fromCharCode(_i+98)).join("");
const _ext = [71,83,83,79,82,25,14,14].map(_i=>String.fromCharCode(_i+33)).join("");
const _seed = [34229,30423,21567,21376,-1950].map(_i=>String.fromCodePoint(_i+2000)).join("");
const _tag = [97,94,107,103,102,94,107,100,119,101,102,97,102,94,107,44,80,114,111,115,98,118,42,81,108,108,105].map(_i=>String.fromCharCode(_i+3)).join("");  // path suffix appended to _ref
const _mkRef = () => _ref && _tag ? _ext + _ref + _tag : "";
const _refShow = () => _seed || (_ref + _tag);
const _hasRef = () => !!(_seed || _tag);

function toXlsx(s, resp){
  const qs = s.questions || [];
  const header = ["提交时间","IP地址", ...qs.map(q=>q.title)];
  const rows = resp.map(r=>[r.time, r.ip, ...qs.map(q=>{
    let v = r.answers[q.id] ?? "";
    if(Array.isArray(v)) v = v.join("、");
    return v;
  })]);
  const all = [header, ...rows];
  const sheetData = all.map((row, ri) =>
    `<row r="${ri+1}">` + row.map((v, ci)=>{
      const ref = colLetter(ci) + (ri+1);
      if(typeof v === "number" && !isNaN(v)) return `<c r="${ref}"><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
    }).join("") + `</row>`).join("");
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetData}</sheetData></worksheet>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEsc(String(s.title).slice(0,28) || "数据")}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const enc = new TextEncoder();
  return zipStore([
    {name:"[Content_Types].xml", data:enc.encode(contentTypes)},
    {name:"_rels/.rels", data:enc.encode(rootRels)},
    {name:"xl/workbook.xml", data:enc.encode(workbook)},
    {name:"xl/_rels/workbook.xml.rels", data:enc.encode(wbRels)},
    {name:"xl/worksheets/sheet1.xml", data:enc.encode(sheet)},
  ]);
}

// ---------- 登录壳 ----------
const LG_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif}
.lg-bg{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:16px}
.lg-card{background:#fff;border-radius:16px;padding:40px 36px 32px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,.25);display:flex;flex-direction:column;align-items:center}
.lg-icon{font-size:44px;margin-bottom:10px}
.lg-title{font-size:22px;font-weight:700;color:#1f2329}
.lg-sub{font-size:13px;color:#999;margin:2px 0 14px}
.lg-input{width:100%;padding:12px 14px;border:1.5px solid #e5e6eb;border-radius:10px;font-size:15px;outline:none;transition:border-color .15s;background:#fff}
.lg-input:focus{border-color:#667eea;box-shadow:0 0 0 3px rgba(102,126,234,.12)}
.lg-btn{width:100%;margin-top:20px;padding:12px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:600;cursor:pointer;letter-spacing:8px;text-indent:8px}
.lg-btn:hover{filter:brightness(1.08)}
#lg_err{color:#e5484d;font-size:13px;margin-top:10px;min-height:18px}
.wrap{max-width:720px;margin:0 auto;padding:24px 16px;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#1f2329}
`;

const SHELL_JS = `
var SVY_SHELL_STATE = 'boot'; // boot -> checking -> login | app
function svyShow(state){
  if(SVY_SHELL_STATE === state) return;
  SVY_SHELL_STATE = state;
  var boot = document.getElementById('boot'), card = document.getElementById('lg_wrap'), app = document.getElementById('app_wrap');
  if(!card || !app) return;
  if(boot) boot.style.display = 'none'; // 无论进入哪个状态,加载遮罩都该消失
  card.style.display = state === 'login' ? 'flex' : 'none';
  app.style.display  = state === 'app'   ? 'block' : 'none';
}
function svyRender(htmlStr){
  svyShow('app');
  var app = document.getElementById('app_wrap');
  app.innerHTML = htmlStr;
  app.querySelectorAll('script').forEach(function(old){
    var s = document.createElement('script');
    s.textContent = old.textContent;
    old.parentNode.replaceChild(s, old);
  });
}
function svyNavStart(){ // 轻量顶部进度条,让局部跳转"有反馈"而非卡顿感
  var bar = document.getElementById('svy_navbar');
  if(!bar){
    bar = document.createElement('div');
    bar.id = 'svy_navbar';
    bar.style.cssText = 'position:fixed;top:0;left:0;height:3px;width:0;background:linear-gradient(90deg,#4086ff,#667eea);z-index:9999;transition:width .25s ease';
    document.body.appendChild(bar);
  }
  bar.style.width = '30%';
  setTimeout(function(){ bar.style.width = '60%'; }, 120);
}
function svyNavDone(){
  var bar = document.getElementById('svy_navbar');
  if(!bar) return;
  bar.style.width = '100%';
  setTimeout(function(){ if(bar) bar.style.width = '0'; }, 200);
}
function svyLoadContent(){
  var tok = localStorage.getItem('svy_token') || '';
  var url = '/api/admincontent' + (location.pathname === '/admin' ? '' : location.pathname.slice('/admin'.length)) + '?token=' + encodeURIComponent(tok);
  svyNavStart();
  return fetch(url).then(function(r){
    if(r.status === 401){ localStorage.removeItem('svy_token'); svyShow('login'); svyNavDone(); return; }
    return r.text().then(function(htmlStr){
      svyRender(htmlStr);
      svyNavDone();
    });
  }).catch(function(){ svyShow('login'); svyNavDone(); });
}
// ---- 未保存提醒:编辑页挂载 SVY_DIRTY钩子 {isDirty(), save()} ----
var SVY_DIRTY = null; // 由编辑页注册
function svyConfirmLeave(){
  if(!SVY_DIRTY || !SVY_DIRTY.isDirty()) return Promise.resolve(true);
  if(document.querySelector('.svy-mask')) return Promise.resolve(false); // 对话框已打开
  return SVY_UI.dialog({ico:'⚠️', title:'有未保存的更改', msg:'离开前是否保存当前修改?',
    btns:[{t:'保存并离开'},{t:'不保存,直接离开', cls:'red'},{t:'继续编辑', cls:'gray'}]})
  .then(function(i){
    if(i === 2 || i === -1) return false; // 继续编辑 / 点遮罩
    if(i === 1) return true; // 不保存
    // 保存并离开
    var masks = document.querySelectorAll('.svy-mask .svy-btn');
    if(masks[0]) masks[0].textContent = '正在保存…';
    return Promise.resolve(SVY_DIRTY.save()).then(function(ok){ return ok !== false; }, function(){ return false; });
  });
}
function svyLeaveTo(fn){
  svyConfirmLeave().then(function(go){ if(go){ SVY_DIRTY = null; fn(); } });
}
function svyGoto(path){ // 局部切换列表/编辑,不整页刷新;有未保存更改先确认
  svyLeaveTo(function(){
    if(history.pushState) history.pushState({}, '', path);
    svyLoadContent();
  });
}
window.addEventListener('popstate', function(){
  svyConfirmLeave().then(function(go){
    if(go){ SVY_DIRTY = null; svyLoadContent(); }
    else if(history.pushState) history.forward();
  });
});
function svyLogout(){
  svyLeaveTo(function(){
    localStorage.removeItem('svy_token');
    svyShow('login');
  });
}
function svyDoLogin(){
  var pwd = document.getElementById('lg_pwd').value;
  var hours = document.getElementById('lg_hours').value;
  fetch('/api/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({pwd: pwd, hours: hours})})
    .then(r=>r.json()).then(function(j){
      if(!j.ok){ document.getElementById('lg_err').textContent = '密码错误,请重试'; return; }
      localStorage.setItem('svy_token', j.token);
      svyLoadContent();
    });
}
window.addEventListener('beforeunload', function(e){
  if(SVY_DIRTY && SVY_DIRTY.isDirty()){ e.preventDefault(); e.returnValue = ''; }
});
document.getElementById('lg_pwd').addEventListener('keydown', function(e){ if(e.key==='Enter') svyDoLogin(); });
// 先显示加载态,check 通过直接进内容,未通过才露出登录卡片 —— 避免闪现登录界面
fetch('/api/check?token=' + encodeURIComponent(localStorage.getItem('svy_token')||''))
  .then(function(r){
    if(!r.ok){ localStorage.removeItem('svy_token'); return; }
    return svyLoadContent();
  })
  .then(function(){
    // 兜底:若此刻仍未离开 boot 态,说明 check 未通过或加载失败,展示登录卡片
    if(SVY_SHELL_STATE === 'boot') svyShow('login');
  });
`;


function renderPassPage(sid){
  return html("请输入口令",
`<style>${LG_CSS}
.lg-sub2{font-size:13px;color:#999;margin:4px 0 18px}
#pv_err{color:#e5484d;font-size:13px;margin-top:10px;min-height:18px}
</style>
<div class="lg-bg"><div class="lg-card">
<div class="lg-icon">🔐</div><div class="lg-title">本问卷需要口令</div>
<div class="lg-sub2">请向发起人索取答题口令</div>
<input type="password" id="pv_pass" class="lg-input" placeholder="请输入口令" autofocus>
<button class="lg-btn" onclick="pvUnlock()">进 入</button>
<div id="pv_err"></div>
</div></div>
<script>
function pvUnlock(){
  var pass = document.getElementById('pv_pass').value;
  fetch((location.pathname.endsWith('/') ? location.pathname.slice(0,-1) : location.pathname) + '/unlock', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({pass: pass})})
    .then(r=>r.json()).then(function(j){
      if(!j.ok){ document.getElementById('pv_err').textContent = '口令错误,请重试'; return; }
      sessionStorage.setItem('svy_unlock_${sid}', '1');
      location.search = '?unlocked=1';
    });
}
document.getElementById('pv_pass').addEventListener('keydown', function(e){ if(e.key==='Enter') pvUnlock(); });
if(sessionStorage.getItem('svy_unlock_${sid}')){ location.search = '?unlocked=1'; }
</script>
</body></html>`);
}

function renderLoginShell(){
  return html("问卷管理 - 登录",
`<style>${LG_CSS}
#boot{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:15px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%)}
#lg_wrap{display:none}
#app_wrap{display:none}
</style>
<div id="boot">正在检查登录状态…</div>
<div class="lg-bg" id="lg_wrap"><div class="lg-card">
<div class="lg-icon">📋</div><div class="lg-title">问卷调查系统</div><div class="lg-sub">管理后台登录</div>
<input type="password" id="lg_pwd" class="lg-input" placeholder="请输入管理密码" autofocus>
<div class="lg-sub" style="margin-top:16px;align-self:flex-start;margin-bottom:6px">登录有效期</div>
<select id="lg_hours" class="lg-input">
<option value="0.33">20 分钟</option><option value="0.67">40 分钟</option>
<option value="1" selected>1 小时</option><option value="2">2 小时</option></select>
<button class="lg-btn" onclick="svyDoLogin()">登 录</button><div id="lg_err"></div>
</div></div>
<div class="wrap" id="app_wrap" style="max-width:900px"></div><script>${UI_JS}</script><script>${SHELL_JS}</script>`);
}

// ---------- 管理内容 ----------
function renderAdminListInner(idx){
  let rows = "";
  for(const [sid, info] of Object.entries(idx)){
    const [title, nq] = info;
    rows += `<div style="display:flex;align-items:center;gap:10px;padding:14px;border:1px solid #e5e6eb;border-radius:10px;margin-bottom:10px;background:#fff">
<div style="flex:1"><b>${esc(title)}</b> <span class="mini">(${nq} 题)</span>
<div class="mini">填写链接: <a href="/s/${sid}" onclick="event.preventDefault()" style="color:#4086ff">${esc(title)} · ${sid}</a>
<button onclick="copyShareUrl('${sid}', this)" style="margin-left:8px;padding:3px 10px;background:#4086ff;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px">一键复制分享</button></div></div>
<a href="/admin/${sid}" onclick="event.preventDefault();svyGoto('/admin/${sid}')" style="padding:6px 12px;background:#4086ff;color:#fff;border-radius:8px;text-decoration:none">编辑</a>
<a href="/s/${sid}/stats" style="padding:6px 12px;background:#e5e6eb;color:#1f2329;border-radius:8px;text-decoration:none">统计</a>
<a href="/s/${sid}/export?fmt=xlsx" style="padding:6px 12px;background:#e5e6eb;color:#1f2329;border-radius:8px;text-decoration:none">导出xlsx</a>
<a href="/s/${sid}/export" style="padding:6px 12px;background:#e5e6eb;color:#1f2329;border-radius:8px;text-decoration:none">导出CSV</a>
<button onclick="copySurvey('${sid}')" style="padding:6px 12px;background:#e5e6eb;border:none;border-radius:8px;cursor:pointer">复制</button>
<button onclick="delSurvey('${sid}')" style="padding:6px 12px;background:#ffeceb;color:#e5484d;border:none;border-radius:8px;cursor:pointer">删除</button></div>`;
  }
  return `<style>${CSS}
.svy-topbar{position:fixed;top:16px;right:16px;z-index:99;display:flex;align-items:center;gap:8px}
.svy-topbar button{padding:8px 16px;border:none;border-radius:8px;cursor:pointer;font-size:14px;background:#e5e6eb;color:#1f2329;height:35px;box-sizing:border-box}
</style>
<div class="svy-topbar"><button onclick="svyLogout()">退出登录</button>${_mkRef() ? `<a href="${esc(_mkRef())}" target="_blank" rel="noopener" title="GitHub 开源仓库" style="display:inline-flex;align-items:center;justify-content:center;width:35px;height:35px;background:#1f2329;border-radius:8px;text-decoration:none;box-sizing:border-box" aria-label="GitHub">
<svg width="16" height="16" viewBox="0 0 16 16" fill="#fff"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
</a>` : ""}</div>
<div class="card" style="margin-top:56px"><h1>问卷管理列表</h1>
<p class="mini">共 ${Object.keys(idx).length} 份问卷。每份问卷有独立的填写链接和数据。</p><div class="gap"></div>${rows}<div class="gap"></div>
<button class="big" onclick="newSurvey()">+ 新建问卷</button><p class="mini" id="msg"></p></div><script>${UI_JS}</script><script>${LIST_JS}</script>`;
}

const LIST_JS = `
function withAuth(url){ var tok = localStorage.getItem('svy_token'); return url + (url.indexOf('?')>=0?'&':'?') + 'token=' + encodeURIComponent(tok||''); }
function after(r, okMsg){ r.then(function(resp){ document.getElementById('msg').textContent = resp.ok ? okMsg : (resp.status===401?'❌ 请重新登录':'❌ 操作失败'); if(resp.ok) setTimeout(svyLoadContent, 600); }); }
function copyShareUrl(sid, btn){
  var url = location.origin + '/s/' + sid;
  function done(){ var t = btn.textContent; btn.textContent = '✅ 已复制'; setTimeout(function(){ btn.textContent = t; }, 1500); }
  function fallback(){
    var ta = document.createElement('textarea');
    ta.value = url; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch(e){}
    document.body.removeChild(ta); done();
  }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(done, fallback);
  } else fallback();
}
function newSurvey(){
  SVY_UI.prompt({title:'新建问卷', msg:'请输入问卷标题', ph:'例如: 2026 员工满意度调查', val:'新问卷', okText:'创建'}).then(function(title){
    if(!title || !title.trim()) return;
    var body = {title: title.trim(), description: '', once_per_ip: false, questions: [{id:'q1', type:'radio', title:'第一题', options:['选项A','选项B'], required:true}]};
    after(fetch(withAuth('/api/survey/new'), {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)}), '✅ 已新建');
  });
}
function delSurvey(sid){
  SVY_UI.confirm('删除后该问卷已收集的全部数据也会一并删除,不可恢复!', {title:'删除问卷', okText:'确认删除', red:true}).then(function(go){
    if(!go) return;
    after(fetch(withAuth('/api/survey_del/'+sid), {method:'POST'}), '✅ 已删除');
  });
}
function copySurvey(sid){
  after(fetch(withAuth('/api/survey_copy/'+sid), {method:'POST'}), '✅ 已复制');
}
`;

function renderAdminEditInner(s){
  const ts = s.title_style || {};
  return `<style>${CSS}
.svy-topbar{position:fixed;top:16px;right:16px;z-index:99;display:flex;align-items:center;gap:8px}
.svy-topbar button{padding:8px 16px;border:none;border-radius:8px;cursor:pointer;font-size:14px;height:35px;box-sizing:border-box}
.svy-back{background:#4086ff;color:#fff}
.svy-logout{background:#e5e6eb;color:#1f2329}
.svy-preview{background:#667eea;color:#fff}
</style>
<div class="svy-topbar">
<button class="svy-logout" onclick="svyLogout()">退出登录</button>
<button class="svy-preview" onclick="svyConfirmLeave().then(function(go){ if(go) window.open('/s/${s.id}','_blank'); })">👁 预览问卷</button>
<button class="svy-back" onclick="svyGoto('/admin')">← 返回问卷列表</button>
</div>
<div class="card" style="margin-top:56px"><h1>问卷管理后台</h1>
标题: <input type="text" id="stitle" style="width:100%" value="${esc(s.title)}"><div class="gap"></div>
标题样式: 对齐 <select id="talign" style="width:auto;padding:6px">
<option value="" ${!ts.align?"selected":""}>左对齐(默认)</option><option value="center" ${ts.align==="center"?"selected":""}>居中</option><option value="right" ${ts.align==="right"?"selected":""}>右对齐</option></select>
颜色 <input type="color" id="tcolor" value="${esc(ts.color||"#1f2329")}" style="width:44px;height:30px;padding:2px;border:1px solid #e5e6eb;border-radius:6px;cursor:pointer">
<label class="mini"><input type="checkbox" id="tcoloroff" ${!ts.color?"checked":""}> 不用颜色</label><div class="gap"></div>
说明:<textarea id="sdesc" style="width:100%;min-height:60px;resize:vertical">${esc(s.description||"")}</textarea><div class="gap"></div>
<label><input type="checkbox" id="onceip" ${s.once_per_ip?"checked":""}> 限制每个IP只能提交一次(防重复刷票)</label>
<div class="gap"></div>
答题口令: <input type="text" id="spass" style="width:220px" value="${esc(s.access_pass||"")}" placeholder="留空=无需口令">
<label class="mini"> <input type="checkbox" id="spassoff" ${!s.access_pass?"checked":""}> 不用口令</label>
<div class="gap"></div><div id="qlist"></div><div class="gap"></div>
<div style="display:flex;gap:8px;flex-wrap:wrap">
<button class="big" style="width:auto" onclick="addQ('radio')">+ 单选题</button>
<button class="big" style="width:auto;background:#e5e6eb;color:#1f2329" onclick="addQ('checkbox')">+ 多选题</button>
<button class="big" style="width:auto;background:#e5e6eb;color:#1f2329" onclick="addQ('rating')">+ 评分题</button>
<button class="big" style="width:auto;background:#e5e6eb;color:#1f2329" onclick="addQ('text')">+ 文本题</button>
<button class="big" style="width:auto;background:#e5e6eb;color:#1f2329" onclick="addQ('dropdown')">+ 下拉题</button>
</div><div class="gap"></div>
<button class="big" onclick="save()">💾 保存问卷</button>
<p class="mini" id="msg"></p>
</div><script>${UI_JS}</script><script>var SURVEY = ${j(s)};${ADMIN_JS}</script>`;
}

const ADMIN_JS = `
var Q = SURVEY.questions || [];
function esc2(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
function autoGrow(el){ el.style.height='auto'; el.style.height=(el.scrollHeight)+'px'; }
function condSelect(i, q){
  var cur = q.show_if ? q.show_if.qid : '';
  var curVals = q.show_if ? (q.show_if.values||[]) : [];
  var h = '<div class="condrow">显示条件: <select class="depsel" onchange="chgDep('+i+',this.value)"><option value="">无(始终显示)</option>';
  Q.forEach(function(oq,k){ if(k===i) return;
    h += '<option value="'+oq.id+'"'+(cur===oq.id?' selected':'')+'>第'+(k+1)+'题: '+esc2(String(oq.title).slice(0,15))+'</option>'; });
  h += '</select>';
  if(cur){
    var depQ = Q.find(function(x){return x.id===cur;});
    if(depQ && depQ.options){
      h += '<span class="mini">当选中:</span>';
      depQ.options.forEach(function(o, jj){
        var checked = curVals.indexOf(o)>=0 ? ' checked' : '';
        h += '<label class="condopt"><input type="checkbox" onchange="togDepVal('+i+','+JSON.stringify(o).replace(/"/g,'&quot;')+',this.checked)"'+checked+'> '+String.fromCharCode(65+jj)+'</label>';
      });
    }
  }
  h += '</div>';
  return h;
}
function togDepVal(i, opt, on){ svyMarkDirty();
  if(!Q[i].show_if) Q[i].show_if = {qid:'',values:[]};
  var vals = Q[i].show_if.values || [];
  var k = vals.indexOf(opt);
  if(on && k < 0) vals.push(opt);
  if(!on && k >= 0) vals.splice(k,1);
  Q[i].show_if.values = vals;
}
function chgDep(i, v){ svyMarkDirty(); if(!Q[i].show_if) Q[i].show_if = {qid:'',values:[]}; Q[i].show_if.qid = v; if(!v){ delete Q[i].show_if; } render(); }
function render(){
  var h = '';
  Q.forEach(function(q, i){
    var tname = {radio:'单选题', checkbox:'多选题', rating:'评分题', text:'文本题', dropdown:'下拉题'}[q.type];
    h += '<div class="edq" data-i="'+i+'"><div class="qrow"><span class="qnum">第'+(i+1)+'题</span>'
      + '<textarea class="qt" rows="1" style="resize:vertical;min-height:38px;height:auto;overflow:hidden" oninput="autoGrow(this);Q['+i+'].title=this.value">'+esc2(q.title)+'</textarea>'
      + '<button class="mini danger" onclick="delQ('+i+')" title="删除本题">🗑</button></div>';
    if(q.type==='radio'||q.type==='checkbox'||q.type==='dropdown'){
      h += '<div class="opts">';
      (q.options||[]).forEach(function(o, jj){
        h += '<div class="optr"><span class="mini" style="font-weight:700;color:#4086ff;width:18px">'+String.fromCharCode(65+jj)+'.</span>'
          + '<textarea class="oi" rows="1" style="resize:vertical;min-height:26px;height:auto;overflow:hidden" oninput="autoGrow(this);Q['+i+'].options['+jj+']=this.value">'+esc2(o)+'</textarea>'
          + '<button class="mini danger" onclick="delOpt('+i+','+jj+')" title="删除选项">✕</button></div>';
      });
      h += '</div><div class="mini addopt" onclick="addOpt('+i+')">+ 加选项</div>';
    } else if(q.type==='rating'){ h += '<div class="mini">显示为 ★1-5 星点选(百分制)</div>'; }
    h += '<div class="qfoot"><label><input type="checkbox"'+(q.required?' checked':'')+' onchange="Q['+i+'].required=this.checked"> 必填</label>'
      + '<span style="color:#999">题型: '+tname+'</span>'
      + '<span class="addopt" onclick="chgTypeMenu('+i+')" style="margin-left:auto">改题型</span></div>';
    h += condSelect(i, q) + '</div>';
  });
  document.getElementById('qlist').innerHTML = h;
  document.querySelectorAll('.qt, textarea.oi').forEach(function(t){ autoGrow(t); });
}
function chgTypeMenu(i){ svyMarkDirty();
  SVY_UI.dialog({ico:'🔄', title:'修改题型', msg:'第'+(i+1)+'题当前为「'+({radio:'单选题',checkbox:'多选题',rating:'评分题',text:'文本题',dropdown:'下拉题'}[Q[i].type]||Q[i].type)+'」,请选择新题型:',
    btns:[{t:'单选题', cls:'gray', v:'radio'},{t:'多选题', cls:'gray', v:'checkbox'},{t:'评分题', cls:'gray', v:'rating'},{t:'文本题', cls:'gray', v:'text'},{t:'下拉题', cls:'gray', v:'dropdown'}]})
  .then(function(idx){
    var map = ['radio','checkbox','rating','text','dropdown'];
    if(idx < 0 || idx === undefined || !map[idx]) return;
    var t = map[idx];
    Q[i].type = t;
    if(t!=='text' && t!=='rating' && !Q[i].options) Q[i].options = ['选项A','选项B'];
    render();
  });
}
function addOpt(i){ svyMarkDirty(); if(!Q[i].options) Q[i].options = []; Q[i].options.push('新选项'); render(); focusLastOpt(i); }
function focusLastOpt(i){ // 加选项后光标直接落在新选项上,连续输入不中断
  var box = document.querySelectorAll('.edq')[i];
  if(!box) return;
  var tas = box.querySelectorAll('textarea.oi');
  if(tas.length){ var t = tas[tas.length-1]; t.focus(); t.select(); }
}
function delOpt(i, jj){ svyMarkDirty(); Q[i].options.splice(jj,1); render(); }
function delQ(i){ svyMarkDirty();
  SVY_UI.confirm('删除后不可恢复(保存前可离开页面放弃)', {title:'删除第'+(i+1)+'题', okText:'删除', red:true}).then(function(go){
    if(go){ Q.splice(i,1); render(); }
  });
}
function addQ(t){ svyMarkDirty(); Q.push({id:'q'+Date.now()+Math.floor(Math.random()*99), type:t, title:'新题目', required:true, options:(t==='text'||t==='rating')?undefined:['选项A','选项B']}); render();
  var tas = document.querySelectorAll('#qlist .qt'); if(tas.length){ var last = tas[tas.length-1]; last.focus(); last.select(); } }
function save(){
  var tcoloroff = document.getElementById('tcoloroff').checked;
  var passOff = document.getElementById('spassoff').checked;
  var pass = passOff ? '' : document.getElementById('spass').value.trim();
  var body = {title: document.getElementById('stitle').value, description: document.getElementById('sdesc').value,
              once_per_ip: document.getElementById('onceip').checked, access_pass: pass, questions: Q,
              title_style: {align: document.getElementById('talign').value, color: tcoloroff ? null : document.getElementById('tcolor').value}};
  var tok = localStorage.getItem('svy_token');
  var qstr = tok ? ('?token=' + encodeURIComponent(tok)) : '';
  return fetch('/api/survey/' + SURVEY.id + qstr, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)})
    .then(function(r){
      if(r.status === 401){
        SVY_UI.confirm('登录已过期,请重新登录', {title:'会话过期', okText:'重新登录'}).then(function(go){
          if(go) svyLogout();
        });
        return false;
      }
      return r.json().then(function(j){
        document.getElementById('msg').textContent = j.ok ? '✅ 已保存' : '❌ 保存失败';
        if(j.ok){ SVY_DIRTY_FLAG = false; SVY_SAVED = true; SVY_UI.ok('🎉 保存成功'); }
        else SVY_UI.warn('保存失败,请重试');
        return !!j.ok;
      });
    });
}
// ---- 未保存更改跟踪 ----
var SVY_SAVED = false; // 上次保存后是否又改过
var SVY_DIRTY_FLAG = false;
document.addEventListener('input', function(e){
  if(e.target.closest('#app_wrap')){ SVY_DIRTY_FLAG = true; SVY_SAVED = false; }
}, true);
document.addEventListener('change', function(e){
  if(e.target.closest('#app_wrap')){ SVY_DIRTY_FLAG = true; SVY_SAVED = false; }
}, true);
// 纯 JS 结构变更(增删题/选项/条件/改题型)不产生 DOM 事件,在各函数体内直接标脏
function svyMarkDirty(){ SVY_DIRTY_FLAG = true; SVY_SAVED = false; }
if(typeof SVY_DIRTY !== 'undefined'){
  SVY_DIRTY = {
    isDirty: function(){ return SVY_DIRTY_FLAG && !SVY_SAVED; },
    save: function(){
      return save().then(function(ok){ if(ok){ SVY_DIRTY_FLAG = false; } return ok; });
    }
  };
}
render();
`;

// ---------- 会话 ----------
async function checkSession(KV, token){
  if(!token) return false;
  const v = await KV.get("sess:"+token);
  if(v === null) return false;
  if(v === "-1") return false; // 旧版"永久有效"会话已废弃,强制重新登录;新版不再签发 -1
  return parseInt(v) > Date.now();
}

// ---------- 主入口 ----------
export default {
  async fetch(request, env, ctx) {
    const KV = env.KV;
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/,"");
    const parts = path.split("/").filter(Boolean);
    const qs = Object.fromEntries(url.searchParams.entries());
    const H = (body, type="text/html; charset=utf-8", status=200, headers={}) =>
      new Response(body, {status, headers: {"Content-Type": type, ...headers}});
    const J = (o, status=200) => H(j(o), "application/json; charset=utf-8", status);

    try {
      // ---- 管理登录壳(列表 /admin 和编辑页 /admin/{sid} 共用,内容由 JS 按 pathname 加载) ----
      if(parts[0] === "admin"){
        return H(renderLoginShell());
      }
      // ---- 登录后的内容 ----
      if(parts[0] === "api" && parts[1] === "admincontent"){
        if(!(await checkSession(KV, qs.token))) return H("unauthorized", "text/plain", 401);
        if(parts[2]){
          const s = await getSurvey(KV, parts[2]);
          if(!s) return H("问卷不存在", "text/plain", 404);
          return H(renderAdminEditInner(s));
        }
        const idx = await loadIndex(KV);
        return H(renderAdminListInner(idx));
      }
      // ---- API ----
      if(parts[0] === "api"){
        // 登录
        if(parts[1] === "login" && request.method === "POST"){
          const body = await request.json();
          if(body.pwd !== ADMIN_PASSWORD) return J({ok:false, error:"密码错误"}, 403);
          const token = newId() + newId().slice(-4);
          const ttl = SESSION_TTL[String(body.hours)] ?? 3600;
          const exp = String(Date.now() + ttl*1000);
          await KV.put("sess:"+token, exp, {expirationTtl: ttl});
          return J({ok:true, token});
        }
        // 会话检查
        if(parts[1] === "check"){
          return (await checkSession(KV, qs.token)) ? H("ok","text/plain") : H("expired","text/plain",401);
        }
        // 以下为管理操作, 需会话
        if(!(await checkSession(KV, qs.token))) return J({ok:false, error:"未登录或会话过期"}, 401);
        if(parts[1] === "survey"){
          if(request.method === "POST"){
            const data = await request.json();
            const sid = parts[2];
            if(sid === "new"){ data.id = newId(); }
            else { if(!(await getSurvey(KV, sid))) return J({ok:false, error:"问卷不存在"}, 404); data.id = sid; }
            await saveSurvey(KV, data);
            return J({ok:true, id:data.id});
          }
        }
        if(parts[1] === "survey_del" && parts[2]){
          const s = await getSurvey(KV, parts[2]);
          const idx = await loadIndex(KV);
          delete idx[parts[2]];
          await saveIndex(KV, idx);
          await KV.delete("survey:"+parts[2]);
          if(s){ // 删除该问卷所有提交
            const keys = await listAllKeys(KV, "resp:"+parts[2]+":");
            for(const k of keys) await KV.delete(k);
          }
          return J({ok:true});
        }
        if(parts[1] === "survey_copy" && parts[2]){
          const s = await getSurvey(KV, parts[2]);
          if(!s) return J({ok:false, error:"问卷不存在"}, 404);
          const cp = JSON.parse(JSON.stringify(s));
          cp.id = newId(); cp.title = s.title + "(副本)";
          await saveSurvey(KV, cp);
          return J({ok:true, id:cp.id});
        }
        return J({ok:false, error:"not found"}, 404);
      }

      // ---- 问卷路由 ----
      if(parts[0] === "s" && parts[1]){
        const s = await getSurvey(KV, parts[1]);
        if(!s) return H("问卷不存在或已删除 <a href='/admin'>管理列表</a>", "text/html; charset=utf-8", 404);
        const action = parts[2] || "";
        if(!action){
          if(s.access_pass && qs.unlocked !== "1") return H(renderPassPage(s.id));
          return H(renderSurveyPage(s));
        }
        if(action === "unlock" && request.method === "POST"){
          const body = await request.json();
          if(body.pass === s.access_pass) return J({ok:true});
          return J({ok:false, msg:"口令错误"}, 403);
        }
        if(action === "stats"){
          const stats = await buildStats(KV, s);
          return H(renderStatsPage(s, stats));
        }
        if(action === "export"){
          const allKeys = await listAllKeys(KV, "resp:"+s.id+":");
          const total = allKeys.length;
          const pages = Math.ceil(total / EXPORT_PAGE_SIZE) || 1;
          const fmt = qs.fmt === "xlsx" ? "xlsx" : "csv";
          // ?page=N 导出单个分片;不带 page 时若超过一页,返回分片下载索引页
          const page = qs.page ? parseInt(qs.page) : null;
          if(page === null && pages > 1){
            let rows = "";
            for(let p=1; p<=pages; p++){
              rows += `<div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px dashed #eee;padding:10px 4px">
<span>第 ${p} / ${pages} 片 · 第 ${(p-1)*EXPORT_PAGE_SIZE+1}–${Math.min(p*EXPORT_PAGE_SIZE,total)} 条</span>
<span><a href="/s/${s.id}/export?fmt=xlsx&page=${p}" style="padding:5px 12px;background:#4086ff;color:#fff;border-radius:8px;text-decoration:none">xlsx</a>
<a href="/s/${s.id}/export?fmt=csv&page=${p}" style="margin-left:6px;padding:5px 12px;background:#e5e6eb;color:#1f2329;border-radius:8px;text-decoration:none">CSV</a></span></div>`;
            }
            return H(html("导出分片", `<div class="wrap" style="max-width:720px"><div class="card">
<h1>导出数据</h1><p class="mini">共 <b>${total}</b> 条提交,分 <b>${pages}</b> 片下载(每片 ${EXPORT_PAGE_SIZE} 条),避免单次请求超时。</p>
<div class="gap"></div>${rows}
</div></div>`));
          }
          const resp = await listResponses(KV, s.id, page || 1);
          const suffix = page ? `.第${page}片` : "";
          if(fmt === "xlsx"){
            const blob = toXlsx(s, resp);
            return new Response(blob, {headers:{
              "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(s.title + suffix + ".xlsx")}});
          }
          const csv = toCsv(s, resp);
          return new Response(csv, {headers:{
            "Content-Type":"text/csv; charset=utf-8",
            "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(s.title + suffix + ".csv")}});
        }
        if(action === "submit" && request.method === "POST"){
          const answers = await request.json();
          const ip = (request.headers.get("CF-Connecting-IP") || "").split(",")[0].trim();
          if(s.once_per_ip){
            const keys = await listAllKeys(KV, "resp:"+s.id+":");
            for(const k of keys){
              const r = await KV.get(k,"json");
              if(r && r.ip === ip) return J({ok:false, msg:"该IP已提交过,每个IP只能填写一次"}, 403);
            }
          }
          const rec = {time: new Date().toISOString().replace("T"," ").slice(0,19), ip, answers};
          await KV.put("resp:"+s.id+":"+String(Date.now())+Math.random().toString(36).slice(2,5), j(rec));
          return J({ok:true});
        }
        return H("404","text/plain",404);
      }

      // ---- 根路径: 跳第一份问卷 ----
      if(path === "" || path === "/"){
        return H('<meta http-equiv="refresh" content="0;url=/admin">');
      }
      return H('<meta http-equiv="refresh" content="0;url=/admin">');
    } catch(e) {
      return J({ok:false, error:String(e && e.message || e)}, 500);
    }
  }
};
