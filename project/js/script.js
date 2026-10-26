const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let S={students:[],records:[]};
try{S=Object.assign(S,JSON.parse(localStorage.getItem('sba')||'{}'))}catch(e){}
const store=()=>{try{localStorage.setItem('sba',JSON.stringify(S))}catch(e){}};
const today=()=>new Date().toLocaleDateString('en-CA');
const tnow=()=>new Date().toTimeString().slice(0,8);
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(tt);tt=setTimeout(()=>t.style.display='none',3200)}
function msg(m,c){const e=$('#msg');e.textContent=m;e.className=c}
function beep(){try{const a=new (window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator();o.frequency.value=880;o.connect(a.destination);o.start();setTimeout(()=>{o.stop();a.close()},120)}catch(e){}}
const csv=rows=>rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
async function dl(filename,data){
 let d=null;try{d=window.claude&&await claude.use('downloads')}catch(e){}
 if(!d){try{const u=URL.createObjectURL(data),l=document.createElement('a');l.href=u;l.download=filename;document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(u),2000)}catch(e){toast('Could not save file.')}return}
 try{await d.save({filename,data})}catch(e){if(!e||e.code!=='declined')toast('Could not save file.')}
}
const batches=()=>[...new Set(S.students.map(s=>s.year).filter(Boolean))].sort();
const inBatch=b=>s=>b==='All'||s.year===b;
const subjects=()=>[...new Set(S.records.map(r=>r.sub))].sort();
const stuName=r=>(S.students.find(s=>s.roll===r)||{name:r}).name;

/* navigation */
let cam=null;
async function stopCam(){if(cam){try{await cam.stop();cam.clear()}catch(e){}cam=null;$('#camBtn').textContent='Start camera'}}
function show(p){
 document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.p===p));
 document.querySelectorAll('section').forEach(s=>s.classList.toggle('on',s.id==='p-'+p));
 if(p!=='scan')stopCam();
 ({dash:rDash,scan:rScan,stu:rStu,bar:rBar,rep:rRep})[p]();
}
$('#nav').onclick=e=>{if(e.target.dataset.p)show(e.target.dataset.p)};

/* dashboard */
function graphHTML(L,lim,tot){
 if(!tot||!L.length)return '<p class="sub">No attendance data yet. Load the demo dataset or scan some students.</p>';
 const low=L.filter(x=>x.pct<lim).length,ok=L.length-low,deg=ok/L.length*360,avg=Math.round(L.reduce((a,x)=>a+x.pct,0)/L.length*10)/10;
 const dm={};L.forEach(x=>(dm[x.s.dept||'—']=dm[x.s.dept||'—']||[]).push(x.pct));
 return `<div class="gt"><div class="donut" style="background:conic-gradient(var(--ok) 0deg ${deg}deg,var(--bad) ${deg}deg 360deg)"><span>${Math.round(ok/L.length*100)}%<small>on track</small></span></div>
 <div class="m"><b>${avg}%</b><span>Average attendance</span></div><div class="m"><b style="color:var(--ok)">${ok}</b><span>Students ≥ ${lim}%</span></div><div class="m"><b style="color:var(--bad)">${low}</b><span>Students below ${lim}%</span></div></div>
 <h2>Attendance % per student</h2><div class="sc"><div class="cols" style="--lim:${lim}%">${[...L].sort((a,b)=>a.s.roll.localeCompare(b.s.roll)).map(x=>`<div title="${esc(x.s.name)} (${esc(x.s.roll)}): ${x.pct}%"><span>${Math.round(x.pct)}</span><div class="bw"><i class="${x.pct<lim?'lo':''}" style="height:${x.pct}%"></i></div><em>${esc(x.s.roll.slice(-3))}</em></div>`).join('')}</div></div>
 <p class="sub">Dashed line = ${lim}% limit · red bars are below it · hover a bar for the name.</p>
 <h2>By department</h2>${Object.entries(dm).map(([d,a])=>{const v=Math.round(a.reduce((p,c)=>p+c,0)/a.length);return`<div style="margin:6px 0"><span style="display:inline-block;width:70px">${esc(d)}</span><span class="bar ${v<lim?'lo':''}" style="width:55%"><i style="width:${v}%"></i></span>${v}%</div>`}).join('')}`;
}
function pcts(){const tot=new Set(S.records.map(r=>r.d+'|'+r.sub)).size;return{tot,list:S.students.map(s=>{const p=S.records.filter(r=>r.sid===s.roll).length;return{s,p,pct:tot?Math.round(p/tot*1000)/10:0}})}}
function rDash(){
 const t=today(),tr=S.records.filter(r=>r.d===t),pres=new Set(tr.map(r=>r.sid)).size,n=S.students.length;
 $('#metrics').innerHTML=[['👥 Students',n],['✅ Present today',pres],['📚 Sessions today',new Set(tr.map(r=>r.sub)).size],['📈 Today\'s rate',n?Math.round(pres/n*100)+'%':'–']]
  .map(x=>`<div class="m"><b>${x[1]}</b><span>${x[0]}</span></div>`).join('');
 const days=[];for(let i=13;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push(d.toLocaleDateString('en-CA'))}
 const c=days.map(d=>S.records.filter(r=>r.d===d).length),mx=Math.max(1,...c);
 {const {tot,list}=pcts();$('#dgraph').innerHTML=graphHTML(list,75,tot);const row=x=>`<tr><td>${esc(x.s.name)}</td><td>${esc(x.s.dept)}</td><td><span class="bar ${x.pct<75?'lo':''}"><i style="width:${x.pct}%"></i></span>${x.pct}%</td></tr>`,sd=[...list].sort((a,b)=>b.pct-a.pct);
 $('#top').innerHTML=tot?sd.slice(0,5).map(row).join(''):'<tr><td class="sub">No attendance yet</td></tr>';
 const lo=sd.filter(x=>x.pct<75).reverse().slice(0,5);$('#risk').innerHTML=tot?(lo.length?lo.map(row).join(''):'<tr><td class="sub">🎉 Nobody at risk</td></tr>'):'<tr><td class="sub">No attendance yet</td></tr>';
 const dm={};list.forEach(x=>{(dm[x.s.dept||'—']=dm[x.s.dept||'—']||[]).push(x.pct)});
 $('#dept').innerHTML=tot?Object.entries(dm).map(([d,a])=>{const v=Math.round(a.reduce((p,c)=>p+c,0)/a.length);return`<div style="margin:6px 0"><span style="display:inline-block;width:70px">${esc(d)}</span><span class="bar ${v<75?'lo':''}" style="width:55%"><i style="width:${v}%"></i></span>${v}%</div>`}).join(''):'<span class="sub">No data yet. Load the demo dataset above.</span>';}
 $('#trend').innerHTML=days.map((d,i)=>`<div title="${d}: ${c[i]}"><span>${c[i]||''}</span><i style="height:${c[i]/mx*85}%"></i><span>${d.slice(8)}</span></div>`).join('');
}
$('#bkp').onclick=()=>dl('attendance-backup.json',new Blob([JSON.stringify(S)],{type:'application/json'}));
$('#rst').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const o=JSON.parse(r.result);if(!Array.isArray(o.students)||!Array.isArray(o.records))throw 0;S={students:o.students,records:o.records};store();rDash();toast('Backup restored.')}catch(x){toast('Invalid backup file.')}};r.readAsText(f)};
let clrArm=0;$('#clr').onclick=()=>{if(!clrArm){clrArm=1;$('#clr').textContent='Click again to confirm';setTimeout(()=>{clrArm=0;$('#clr').textContent='Clear all data'},4000)}else{S={students:[],records:[]};store();clrArm=0;$('#clr').textContent='Clear all data';rDash();toast('All data cleared.')}};

/* scan */
function rScan(){fillSel($('#batch'),batches(),true);$('#sl').innerHTML=subjects().map(x=>`<option value="${esc(x)}">`).join('');if(!$('#sdate').value)$('#sdate').value=today();rSl();$('#code').focus()}
function mark(code){
 code=code.trim();if(!code)return;
 const st=S.students.find(s=>s.roll.toLowerCase()===code.toLowerCase()),sub=$('#subj').value.trim()||'General',d=$('#sdate').value||today();
 if(!st)return msg('❌ Unknown barcode: '+code,'bad');
 const bt=$('#batch').value||'All';if(bt!=='All'&&st.year!==bt)return msg('⚠️ '+st.name+' belongs to batch '+(st.year||'–')+', not '+bt,'wa');
 if(S.records.some(r=>r.sid===st.roll&&r.d===d&&r.sub===sub))return msg('⚠️ '+st.name+' ('+st.roll+') is already marked for '+sub,'wa');
 S.records.push({sid:st.roll,d,t:tnow(),sub});store();beep();msg('✅ '+st.name+' ('+st.roll+') marked PRESENT','ok');rSl();
}
function rSl(){
 const sub=$('#subj').value.trim()||'General',d=$('#sdate').value||today(),bt=$('#batch').value||'All';
 const rs=S.records.map((r,i)=>({...r,i})).filter(r=>r.d===d&&r.sub===sub&&(bt==='All'||(S.students.find(s=>s.roll===r.sid)||{}).year===bt)).reverse();
 $('#slt').textContent=`Present: ${bt==='All'?'':'Batch '+bt+' · '}${sub} · ${d} (${rs.length})`;
 $('#slist').innerHTML='<tr><th>Time</th><th>Roll No</th><th>Name</th><th></th></tr>'+rs.map(r=>`<tr><td>${r.t}</td><td>${esc(r.sid)}</td><td>${esc(stuName(r.sid))}</td><td><button class="d" data-i="${r.i}">✕</button></td></tr>`).join('');
}
$('#slist').onclick=e=>{const i=e.target.dataset.i;if(i!==undefined){S.records.splice(+i,1);store();rSl()}};
$('#batch').onchange=rSl;$('#subj').oninput=rSl;$('#sdate').onchange=rSl;
$('#f1').onsubmit=e=>{e.preventDefault();mark($('#code').value);$('#code').value='';$('#code').focus()};
let last={c:'',t:0};
$('#camBtn').onclick=async()=>{
 if(cam)return stopCam();
 if(!window.Html5Qrcode)return toast('Camera library could not load.');
 cam=new Html5Qrcode('reader');
 try{await cam.start({facingMode:'environment'},{fps:10,qrbox:{width:280,height:120}},c=>{const n=Date.now();if(c===last.c&&n-last.t<3000)return;last={c,t:n};mark(c)},()=>{});$('#camBtn').textContent='Stop camera'}
 catch(e){cam=null;toast('Camera not available here. Use a USB scanner or type the code.')}
};

/* students */
function addStu(roll,name,dept,yr){
 roll=(roll||'').trim();name=(name||'').trim();if(!roll||!name)return false;
 if(S.students.some(s=>s.roll.toLowerCase()===roll.toLowerCase()))return false;
 S.students.push({roll,name,dept:(dept||'').trim(),year:(yr||'').trim()});return true;
}
function rStu(){
 const q=$('#q').value.toLowerCase();
 $('#stt').textContent='Students ('+S.students.length+')';
 $('#stl').innerHTML='<tr><th>Roll No</th><th>Name</th><th>Dept</th><th>Year</th><th></th></tr>'+S.students.map((s,i)=>[s,i]).filter(([s])=>!q||(s.roll+' '+s.name+' '+s.dept).toLowerCase().includes(q)).map(([s,i])=>`<tr><td>${esc(s.roll)}</td><td>${esc(s.name)}</td><td>${esc(s.dept)}</td><td>${esc(s.year)}</td><td><button class="d" data-i="${i}">Delete</button></td></tr>`).join('');
}
$('#f2').onsubmit=e=>{e.preventDefault();if(addStu($('#roll').value,$('#nm').value,$('#dp').value,$('#yr').value)){store();e.target.reset();toast('Student added.')}else toast('Roll No already exists.');rStu()};
$('#bulkBtn').onclick=()=>{let n=0;$('#bulk').value.split('\n').forEach(l=>{const p=l.split(',');if(addStu(...p))n++});store();$('#bulk').value='';toast(n+' student(s) added.');rStu()};
$('#demo').onclick=()=>{demoAll(false);return;[['21CS001','Aarav Sharma','CSE','3'],['21CS002','Ananya Reddy','CSE','3'],['21CS003','Rohan Gupta','CSE','3'],['21EC004','Sneha Patel','ECE','3'],['21EC005','Vikram Singh','ECE','3'],['21ME006','Priya Nair','MECH','3'],['21IT007','Divya Iyer','IT','3'],['21IT008','Arjun Mehta','IT','3']].forEach(x=>addStu(...x));store();rStu();toast('Demo students loaded.')};
$('#stl').onclick=e=>{const i=e.target.dataset.i;if(i!==undefined){const s=S.students[+i];S.students.splice(+i,1);S.records=S.records.filter(r=>r.sid!==s.roll);store();rStu();toast('Deleted '+s.name)}};

/* barcodes */
function cardBlob(s){return new Promise(res=>{
 const b=document.createElement('canvas');JsBarcode(b,s.roll,{height:60,fontSize:16,margin:10});
 const c=document.createElement('canvas');c.width=Math.max(b.width,360);c.height=b.height+64;
 const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#111';x.textAlign='center';
 x.font='bold 18px sans-serif';x.fillText(s.name,c.width/2,26);x.font='13px sans-serif';x.fillText([s.dept,s.year].filter(Boolean).join(' • '),c.width/2,46);
 x.drawImage(b,(c.width-b.width)/2,56);c.toBlob(res,'image/png')})}
function rBar(){
 const box=$('#bcs');box.innerHTML='';
 if(!S.students.length){box.innerHTML='<div class="card">Add students first.</div>';return}
 if(!window.JsBarcode){box.innerHTML='<div class="card">Barcode library could not load.</div>';return}
 S.students.forEach((s,i)=>{
  const d=document.createElement('div');d.className='bc';
  const cv=document.createElement('canvas');JsBarcode(cv,s.roll,{height:55,fontSize:14,margin:6});
  const n=document.createElement('div');n.innerHTML='<b></b><div class="sub"></div>';n.firstChild.textContent=s.name;n.lastChild.textContent=[s.dept,s.year].filter(Boolean).join(' • ');
  const b=document.createElement('button');b.className='g';b.textContent='Save ID card';b.style.marginTop='8px';
  b.onclick=async()=>dl(s.roll+'_idcard.png',await cardBlob(s));
  d.append(n,cv,document.createElement('br'),b);box.append(d);
 });
}

/* reports */
function fillSel(el,list,all){const v=el.value;el.innerHTML=(all?'<option>All</option>':'')+list.map(s=>`<option>${esc(s)}</option>`).join('');if(list.includes(v)||v==='All')el.value=v}
function rRep(){
 if(!$('#ddate').value)$('#ddate').value=today();
 if(!$('#sto').value)$('#sto').value=today();
 if(!$('#sfrom').value){const d=new Date();d.setDate(d.getDate()-30);$('#sfrom').value=d.toLocaleDateString('en-CA')}
 fillSel($('#ssub'),subjects(),true);fillSel($('#sbat'),batches(),true);fillSel($('#dbat'),batches(),true);rDaily();rSum();
}
let dayRows=[];
function rDaily(){
 const d=$('#ddate').value,stu=S.students.filter(inBatch($('#dbat').value||'All')),bid=new Set(stu.map(s=>s.roll)),subs=[...new Set(S.records.filter(r=>r.d===d&&bid.has(r.sid)).map(r=>r.sub))].sort();
 fillSel($('#dsub'),subs,false);const sub=$('#dsub').value;
 const pr=S.records.filter(r=>r.d===d&&r.sub===sub&&bid.has(r.sid)),ids=new Set(pr.map(r=>r.sid)),ab=stu.filter(s=>!ids.has(s.roll));
 $('#pc').textContent='✅ Present: '+pr.length;$('#ac').textContent='❌ Absent: '+(subs.length?ab.length:0);
 $('#pl').innerHTML=pr.map(r=>`<tr><td>${r.t}</td><td>${esc(r.sid)}</td><td>${esc(stuName(r.sid))}</td></tr>`).join('');
 $('#al').innerHTML=(subs.length?ab:[]).map(s=>`<tr><td>${esc(s.roll)}</td><td>${esc(s.name)}</td></tr>`).join('');
 dayRows=[['Roll No','Name','Status','Time']].concat(pr.map(r=>[r.sid,stuName(r.sid),'Present',r.t]),ab.map(s=>[s.roll,s.name,'Absent','']));
 $('#dcsv').dataset.f=`attendance_${d}_${sub}.csv`;
}
$('#ddate').onchange=rDaily;$('#dbat').onchange=rDaily;$('#dsub').onchange=rDaily;
$('#dcsv').onclick=e=>subjects().length?dl(e.target.dataset.f,new Blob([csv(dayRows)],{type:'text/csv'})):toast('No data to export.');
let sumRows=[],sview='graph';
function rSum(){
 const f=$('#sfrom').value,t=$('#sto').value,sub=$('#ssub').value||'All',bt=$('#sbat').value||'All',lim=+$('#lim').value||75;
 const stu=S.students.filter(inBatch(bt)),ids=new Set(stu.map(s=>s.roll));
 const rs=S.records.filter(r=>ids.has(r.sid)&&(!f||r.d>=f)&&(!t||r.d<=t)&&(sub==='All'||r.sub===sub));
 const tot=new Set(rs.map(r=>r.d+'|'+r.sub)).size;
 $('#sinfo').textContent=tot+' session(s) held in this range · '+stu.length+' student(s).';
 const L=stu.map(s=>{const p=rs.filter(r=>r.sid===s.roll).length;return{s,p,pct:tot?Math.round(p/tot*1000)/10:0}}).sort((a,b)=>a.pct-b.pct);
 $('#sumT').style.display=sview==='table'?'block':'none';$('#sumG').style.display=sview==='graph'?'block':'none';
 document.querySelectorAll('#vt button').forEach(b=>b.classList.toggle('on',b.dataset.v===sview));
 $('#sumG').innerHTML=graphHTML(L,lim,tot);
 $('#sum').innerHTML='<tr><th>Roll No</th><th>Name</th><th>Batch</th><th>Present</th><th>Sessions</th><th>Attendance</th><th>Status</th></tr>'+
  L.map(x=>`<tr><td>${esc(x.s.roll)}</td><td>${esc(x.s.name)}</td><td>${esc(x.s.year)}</td><td>${x.p}</td><td>${tot}</td><td><span class="bar ${x.pct<lim?'lo':''}"><i style="width:${x.pct}%"></i></span>${x.pct}%</td><td>${tot?(x.pct<lim?'⚠️ Low':'✅ OK'):'–'}</td></tr>`).join('');
 sumRows=[['Roll No','Name','Department','Batch','Present','Sessions','Attendance %']].concat(L.map(x=>[x.s.roll,x.s.name,x.s.dept,x.s.year,x.p,tot,x.pct]));
}
$('#vt').onclick=e=>{if(e.target.dataset.v){sview=e.target.dataset.v;rSum()}};
['sfrom','sto','ssub','sbat','lim'].forEach(i=>$('#'+i).onchange=rSum);$('#lim').oninput=rSum;
$('#scsv').onclick=()=>S.students.length?dl('attendance_summary.csv',new Blob([csv(sumRows)],{type:'text/csv'})):toast('No data to export.');

const FN=['Aarav','Ananya','Rohan','Sneha','Vikram','Priya','Divya','Arjun','Kavya','Rahul','Meera','Karthik','Ishita','Siddharth','Neha','Aditya','Pooja','Varun','Sanya','Manish'],LN=['Sharma','Reddy','Gupta','Patel','Singh','Nair','Iyer','Mehta'],DP=[['CSE','CS'],['ECE','EC'],['IT','IT'],['MECH','ME'],['CIVIL','CE']],SUBS=['Mathematics','Physics','Programming'];
function demoAll(withRec){
 let x=42;const rnd=()=>(x=(x*1664525+1013904223)%4294967296)/4294967296;
 for(let i=0;i<40;i++){const d=DP[i%5];addStu('22'+d[1]+String(i+1).padStart(3,'0'),FN[i%20]+' '+LN[(i*3+(i>19?1:0))%8],d[0],['2022-26','2023-27','2024-28'][i%3])}
 if(withRec){const have=new Set(S.records.map(r=>r.sid+r.d+r.sub)),pr={};S.students.forEach(s=>pr[s.roll]=rnd()<.2?.4+rnd()*.3:.8+rnd()*.2);
  for(let o=21;o>=0;o--){const dt=new Date();dt.setDate(dt.getDate()-o);if(dt.getDay()===0)continue;const d=dt.toLocaleDateString('en-CA');
   SUBS.forEach((sub,j)=>{if(o===0&&j>0)return;S.students.forEach(s=>{const k=s.roll+d+sub;if(!have.has(k)&&rnd()<pr[s.roll]){have.add(k);S.records.push({sid:s.roll,d,t:['09','11','14'][j]+':'+String(Math.floor(rnd()*20)).padStart(2,'0')+':'+String(Math.floor(rnd()*60)).padStart(2,'0'),sub})}})})}}
 store();rDash();rStu();toast(withRec?'Demo dataset loaded: 40 students, 3 weeks of attendance.':'Demo students loaded.');
}
$('#demoAll').onclick=()=>demoAll(true);
$('#q').oninput=rStu;
$('#sim').onclick=()=>{const sub=$('#subj').value.trim()||'General',d=$('#sdate').value||today();
 const left=S.students.filter(inBatch($('#batch').value||'All')).filter(s=>!S.records.some(r=>r.sid===s.roll&&r.d===d&&r.sub===sub));
 if(!S.students.length)return msg('Add students first (Dashboard has a demo dataset).','bad');
 if(!left.length)return msg('Everyone is already marked present.','wa');
 mark(left[Math.floor(Math.random()*left.length)].roll)};
$('#theme').onclick=()=>{const r=document.documentElement,dk=r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme: dark)').matches;r.dataset.theme=dk?'light':'dark'};
$('#rst').onclick=e=>{e.target.value=''};
(async()=>{let sm=null;try{sm=window.claude&&await claude.use('sample')}catch(e){}
 if(!sm){$('#ai').style.display='none';return}
 $('#ai').onclick=async()=>{const {tot,list}=pcts();if(!tot)return toast('Load some attendance first.');
  const dm={};list.forEach(x=>{(dm[x.s.dept]=dm[x.s.dept]||[]).push(x.pct)});
  const data={sessions:tot,students:list.length,lowest:[...list].sort((a,b)=>a.pct-b.pct).slice(0,6).map(x=>[x.s.name,x.s.dept,x.pct]),deptAvg:Object.fromEntries(Object.entries(dm).map(([d,a])=>[d,Math.round(a.reduce((p,c)=>p+c,0)/a.length)]))};
  $('#aiout').textContent='Thinking…';
  try{const r=await sm('You are an academic attendance analyst. From this data, give 4 short bullet insights and 2 concrete actions for the teacher. Plain text, under 120 words.\n'+JSON.stringify(data),{onText:({text})=>{$('#aiout').textContent=text}});$('#aiout').textContent=r.text}
  catch(e){$('#aiout').textContent='AI insights are not available right now.'}}})();
rDash();
