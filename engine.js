/* HOLISCOPE SKY ENGINE v1.3
   speed readout = real-time multiplier | bigger planes | label modes
   counter-hide (N) | bold readable place labels */
(function(){
"use strict";
function mmss(v){var p=String(v).trim().split(':');return (+p[0])*60+(+p[1]);}
function fmt(s){var m=Math.floor(s/60),x=(s%60);return m+':'+(x<10?'0':'')+x.toFixed(1);}
function pad(n){return (n<10?'0':'')+n;}
var PALETTE=["#FFB020","#4DABF7","#51CF66","#CC5DE8","#FF6B6B","#38D9A9","#FFD43B","#FF922B","#845EF7","#22B8CF"];
var LABELFONT=["Open Sans Bold","Arial Unicode MS Bold"];
window.Holiscope=function(CFG){
  var C={
    style:CFG.style, token:CFG.token, length:CFG.length||"0:45",
    window:CFG.window||null, utcOffset:(CFG.utcOffset==null?-4:CFG.utcOffset),
    camera:CFG.camera||[-74.06,40.85,9], follow:CFG.follow||null,
    mode:CFG.mode||"realtime", stagger:CFG.stagger||8, draw:CFG.draw||9,
    colour:CFG.colour||"by_direction", highlight:CFG.highlight||[],
    labels:CFG.labels||"highlight", trails:CFG.trails||"highlight",
    vanish:(CFG.vanish==null?true:CFG.vanish), goneAlt:CFG.goneAlt||150,
    places:CFG.places||[], zones:CFG.zones||[], show:CFG.show||{}, title:CFG.title||"",
    flights:FLIGHTS
  };
  var S={clock:pick("clock",true),counters:pick("counters",false),
    placeLabels:pick("placeLabels",true),zones:pick("zones",true),legend:pick("legend",false)};
  function pick(k,d){return (C.show[k]==null)?d:C.show[k];}
  var VIDEO_LEN=mmss(C.length);
  var RATE=1, map, currentT=0, playing=false, lastWall=null, ready=false, roOn=false;
  var WF=0,WT=0;
  if(C.window){WF=toEpoch(C.window[0]);WT=toEpoch(C.window[1]);}
  function toEpoch(hhmm){var p=hhmm.split(':'),h=+p[0],m=+p[1];var base=CFG.dateEpoch||0;return base+(h-C.utcOffset)*3600+m*60;}
  function realAt(vt){return WF+(vt/VIDEO_LEN)*(WT-WF);}
  var LIST=[], ci=0;
  for(var id in C.flights){
    var f=C.flights[id], tk=f.track||f.t;
    if(!tk||tk.length<2)continue;
    var isDep=(f.kind==="DEP");
    var hero=C.highlight.indexOf(id)>=0 || C.highlight.indexOf(f.callsign)>=0;
    var col; if(hero)col="#1864AB";
    else if(C.colour==="per_flight")col=PALETTE[ci++%PALETTE.length];
    else if(C.colour==="by_direction")col=isDep?"#FFA94D":"#4DABF7";
    else col="#9fd0ff";
    LIST.push({id:id,tk:tk,dep:isDep,hero:hero,col:col,label:(f.label||f.n||f.callsign||id),start:0,draw:C.draw});
  }
  if(C.mode==="drawin"){for(var i=0;i<LIST.length;i++){LIST[i].start=i*C.stagger;}}
  buildDOM(); loadMap();
  function buildDOM(){
    var css=document.createElement('style');
    css.textContent=
     "body{margin:0;background:#000;font-family:'Helvetica Neue',Arial,sans-serif;}"+
     "#hmap{position:absolute;top:0;bottom:60px;width:100%;}"+
     ".hbox{position:absolute;z-index:8;background:rgba(15,18,26,.55);border:1px solid rgba(255,255,255,.12);border-radius:7px;color:#dbe4f0;}"+
     "#hclock{top:18px;right:20px;text-align:right;padding:9px 13px;}"+
     "#hclock .rt{font-size:21px;font-weight:600;font-variant-numeric:tabular-nums;}"+
     "#hclock .rd{font-size:10px;color:#aab4c5;margin-top:3px;}"+
     "#hclock .sp{display:inline-block;font-size:11px;color:#0b0e14;background:#4DABF7;padding:2px 8px;border-radius:10px;margin-top:6px;font-weight:700;}"+
     "#hcount{top:18px;left:20px;padding:11px 16px;display:flex;gap:24px;}"+
     "#hcount .cw{text-align:center;}#hcount .cn{font-size:32px;font-weight:700;line-height:1;}"+
     "#hcount .cl{font-size:9px;color:#aab4c5;letter-spacing:1.2px;margin-top:5px;text-transform:uppercase;}"+
     "#hleg{top:18px;left:20px;padding:11px 15px;font-size:13px;line-height:1.9;}"+
     "#hleg i{display:inline-block;width:22px;height:4px;margin-right:9px;vertical-align:middle;border-radius:2px;}"+
     "#htitle{bottom:78px;left:20px;font-size:12px;letter-spacing:1px;padding:6px 11px;text-transform:uppercase;}"+
     "#hread{position:absolute;bottom:112px;left:16px;z-index:9;background:rgba(0,0,0,.85);color:#0f0;font-family:monospace;font-size:13px;padding:10px;border-radius:6px;display:none;white-space:pre;}"+
     "#hbar{position:absolute;bottom:0;left:0;right:0;height:60px;background:#111;display:flex;align-items:center;padding:0 16px;gap:10px;z-index:6;}"+
     "#hbar button{background:#E63946;color:#fff;border:none;width:46px;height:36px;border-radius:6px;font-size:16px;cursor:pointer;}"+
     ".hrb{background:#2a2f3a;color:#dbe4f0;border:none;width:38px;height:28px;border-radius:5px;font-size:11px;cursor:pointer;font-weight:600;}"+
     "#hrst{background:#2a2f3a;color:#dbe4f0;border:none;height:28px;padding:0 10px;border-radius:5px;font-size:11px;cursor:pointer;}"+
     "#hscrub{flex:1;cursor:pointer;}#htl{color:#9fd0ff;font-size:14px;width:64px;text-align:right;}"+
     "#hhint{position:absolute;bottom:66px;right:16px;z-index:6;color:#666;font-size:11px;font-family:monospace;}"+
     "body.hclean #hmap{bottom:0;}body.hclean #hbar,body.hclean #hhint,body.hclean #htitle,body.hclean #hread{display:none!important;}"+
     "body.hnotime #hclock{display:none!important;}body.hnocount #hcount{display:none!important;}";
    document.head.appendChild(css);
    add('div',{id:'hmap'});
    if(S.clock)add('div',{id:'hclock',cls:'hbox',html:'<div class="rt" id="hrt">--:--</div><div class="rd" id="hrd"></div><span class="sp" id="hsp">1x</span>'});
    if(S.counters)add('div',{id:'hcount',cls:'hbox',html:'<div class="cw"><div class="cn" id="hca" style="color:#4DABF7">0</div><div class="cl">arrivals</div></div><div class="cw"><div class="cn" id="hcd" style="color:#FFA94D">0</div><div class="cl">departures</div></div>'});
    if(S.legend){var rows=LIST.filter(function(f){return C.colour==="per_flight"||f.hero;}).map(function(f){return "<i style='background:"+f.col+"'></i>"+f.label;});if(rows.length)add('div',{id:'hleg',cls:'hbox',html:rows.join('<br>')});}
    if(C.title)add('div',{id:'htitle',cls:'hbox',html:C.title});
    add('div',{id:'hread'});
    add('div',{id:'hhint',html:'scroll=zoom &nbsp; drag=pan &nbsp; R reset &nbsp; H hide UI &nbsp; T clock &nbsp; N counters'});
    var bar=add('div',{id:'hbar'});
    bar.innerHTML='<button id="hplay">&#9654;</button><div style="display:flex;gap:4px">'+[0.25,0.5,1,2,4].map(function(r){return '<button class="hrb" data-r="'+r+'">'+r+'x</button>';}).join('')+'</div><button id="hrst">reset view</button><input id="hscrub" type="range" min="0" max="100" step="0.05" value="0"><span id="htl">0:00.0</span>';
  }
  function add(tag,o){var e=document.createElement(tag);if(o.id)e.id=o.id;if(o.cls)e.className=o.cls;if(o.html)e.innerHTML=o.html;document.body.appendChild(e);return e;}
  function loadMap(){
    var host=['api','mapbox','com'].join('.'),base='https://'+host+'/mapbox-gl-js/v3.27.0/';
    var l=document.createElement('link');l.rel='stylesheet';l.href=base+'mapbox-gl.css';document.head.appendChild(l);
    var s=document.createElement('script');s.src=base+'mapbox-gl.js';s.onload=init;document.head.appendChild(s);
  }
  function fc(a){return {type:'FeatureCollection',features:a};}
  function init(){
    mapboxgl.accessToken=C.token;
    map=new mapboxgl.Map({container:'hmap',style:C.style,center:[C.camera[0],C.camera[1]],zoom:C.camera[2],projection:'mercator'});
    map.scrollZoom.enable();
    document.getElementById('hscrub').max=VIDEO_LEN;
    setRate(1);
    map.on('load',function(){
      if(S.zones){C.zones.forEach(function(z,i){
        var ring=[],R=z.radius_nm/60.0,k=Math.cos(z.center[1]*Math.PI/180);
        for(var a=0;a<=72;a++){var th=a/72*2*Math.PI;ring.push([z.center[0]+(R/k)*Math.cos(th),z.center[1]+R*Math.sin(th)]);}
        var col=z.color||"#FF3B30";
        map.addSource('z'+i,{type:'geojson',data:{type:'Feature',geometry:{type:'Polygon',coordinates:[ring]}}});
        map.addLayer({id:'zf'+i,type:'fill',source:'z'+i,paint:{'fill-color':col,'fill-opacity':0.12}});
        map.addLayer({id:'zo'+i,type:'line',source:'z'+i,paint:{'line-color':col,'line-width':2,'line-opacity':0.85,'line-dasharray':[3,2]}});
        if(z.label){map.addSource('zl'+i,{type:'geojson',data:{type:'Feature',properties:{t:z.label},geometry:{type:'Point',coordinates:[z.center[0],z.center[1]+R*1.05]}}});
          map.addLayer({id:'zt'+i,type:'symbol',source:'zl'+i,layout:{'text-field':['get','t'],'text-font':LABELFONT,'text-size':11,'text-letter-spacing':0.12,'text-allow-overlap':true,'text-ignore-placement':true},paint:{'text-color':col,'text-halo-color':'rgba(0,0,0,.85)','text-halo-width':1.2}});}
      });}
      addPlaces('airport',5,'#4DABF7','#4DABF7');
      addPlaces('gateway',6,'#1864AB','#8FC7F5');
      addPlaces('landmark',5,'#C9CDD4','#C9CDD4');
      var venues=C.places.filter(function(p){return p.style==='venue';});
      if(venues.length){
        map.addSource('venue',{type:'geojson',data:fc(venues.map(function(p){return {type:'Feature',properties:{n:p.name},geometry:{type:'Point',coordinates:p.at}};}))});
        map.addLayer({id:'vg',type:'circle',source:'venue',paint:{'circle-radius':13,'circle-color':'#FF3B30','circle-opacity':0.22,'circle-blur':0.8}});
        map.addLayer({id:'vd',type:'circle',source:'venue',paint:{'circle-radius':5,'circle-color':'#FF3B30','circle-stroke-width':2,'circle-stroke-color':'#fff'}});
        if(S.placeLabels)map.addLayer({id:'vl',type:'symbol',source:'venue',layout:{'text-field':['get','n'],'text-font':LABELFONT,'text-size':14,'text-offset':[0,1.4],'text-anchor':'top','text-allow-overlap':true,'text-ignore-placement':true},paint:{'text-color':'#FF6B6B','text-halo-color':'rgba(0,0,0,.85)','text-halo-width':1.3}});
      }
      map.addSource('tr',{type:'geojson',data:fc([])});
      map.addLayer({id:'tr',type:'line',source:'tr',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['get','c'],'line-width':['get','w'],'line-opacity':['get','o']}});
      map.addSource('pl',{type:'geojson',data:fc([])});
      map.addLayer({id:'pl',type:'symbol',source:'pl',layout:{'text-field':'\u2708','text-size':['get','s'],'text-rotate':['get','b'],'text-rotation-alignment':'map','text-allow-overlap':true},paint:{'text-color':['get','c'],'text-halo-color':'#000','text-halo-width':1.2}});
      map.addSource('lb',{type:'geojson',data:fc([])});
      map.addLayer({id:'lb',type:'symbol',source:'lb',layout:{'text-field':['get','t'],'text-size':['get','sz'],'text-offset':[0,-1.7],'text-anchor':'bottom','text-allow-overlap':true,'text-ignore-placement':true},paint:{'text-color':['get','c'],'text-halo-color':'rgba(0,0,0,.85)','text-halo-width':1.0}});
      ready=true;render(0);wire();
    });
  }
  function addPlaces(style,rad,dot,txt){
    var ps=C.places.filter(function(p){return (p.style||'airport')===style;});
    if(!ps.length)return;
    map.addSource('p_'+style,{type:'geojson',data:fc(ps.map(function(p){return {type:'Feature',properties:{n:p.name},geometry:{type:'Point',coordinates:p.at}};}))});
    var paint={'circle-radius':rad,'circle-color':dot,'circle-stroke-width':2,'circle-stroke-color':'rgba(0,0,0,.7)'};
    if(style==='landmark')paint['circle-radius']=0;
    map.addLayer({id:'pd_'+style,type:'circle',source:'p_'+style,paint:paint});
    if(style==='landmark')map.addLayer({id:'pm_'+style,type:'symbol',source:'p_'+style,layout:{'text-field':'\u25C6','text-size':13,'text-allow-overlap':true,'text-ignore-placement':true},paint:{'text-color':txt,'text-halo-color':'#000','text-halo-width':1}});
    if(S.placeLabels)map.addLayer({id:'pl_'+style,type:'symbol',source:'p_'+style,layout:{'text-field':['get','n'],'text-font':LABELFONT,'text-size':15,'text-offset':[0,1.3],'text-anchor':'top','text-letter-spacing':0.08,'text-allow-overlap':true,'text-ignore-placement':true},paint:{'text-color':txt,'text-halo-color':'rgba(0,0,0,.9)','text-halo-width':1.5}});
  }
  function posAt(tr,T){
    if(T<tr[0][0]||T>tr[tr.length-1][0])return null;
    for(var i=0;i<tr.length-1;i++){var a=tr[i],b=tr[i+1];
      if(a[0]<=T&&T<=b[0]){var u=(T-a[0])/((b[0]-a[0])||1);var h0=a[4],h1=b[4],dh=((h1-h0+540)%360)-180;
        return {lon:a[2]+(b[2]-a[2])*u,lat:a[1]+(b[1]-a[1])*u,alt:a[3]+(b[3]-a[3])*u,hdg:(h0+dh*u+360)%360};}}
    return null;}
  function wantLabel(f){
    if(f.hero)return true;
    if(C.labels==="all")return true;
    if(C.labels==="arrivals")return !f.dep;
    if(C.labels==="departures")return f.dep;
    return false;
  }
  function render(vt){
    if(!ready)return;
    var planes=[],trails=[],labels=[],na=0,nd=0,followPos=null;
    var Treal=C.window?realAt(vt):0;
    for(var i=0;i<LIST.length;i++){
      var f=LIST[i],tk=f.tk,Tf;
      if(C.mode==="drawin"){if(vt<f.start)continue;var pr=Math.min(1,(vt-f.start)/f.draw);Tf=tk[0][0]+pr*(tk[tk.length-1][0]-tk[0][0]);}else{Tf=Treal;}
     if(C.window){var mark=f.dep?tk[0][0]:tk[tk.length-1][0];if(mark>=WF&&mark<=Tf){if(f.dep)nd++;else na++;}}
      var p=posAt(tk,Tf);
      if(!p)continue;
      if(C.follow===f.id||C.follow===f.label)followPos=[p.lon,p.lat];
      var landed=C.vanish&&(p.alt<C.goneAlt);
      var showTrail=(C.trails==="all")||(C.trails==="highlight"&&f.hero)||(C.mode==="drawin");
      if(showTrail){var co=[];for(var q=0;q<tk.length;q++){if(tk[q][0]>Tf)break;co.push([tk[q][2],tk[q][1]]);}
        if(!landed)co.push([p.lon,p.lat]);
        if(co.length>1)trails.push({type:'Feature',properties:{c:f.col,w:f.hero?3.4:2.2,o:f.hero?0.95:0.75},geometry:{type:'LineString',coordinates:co}});}
      if(!landed){
        planes.push({type:'Feature',properties:{b:(p.hdg-90+360)%360,c:f.col,s:f.hero?40:32},geometry:{type:'Point',coordinates:[p.lon,p.lat]}});
        if(wantLabel(f))labels.push({type:'Feature',properties:{t:f.label,c:(f.hero?'#BBDEFB':f.col),sz:f.hero?15:12},geometry:{type:'Point',coordinates:[p.lon,p.lat]}});
      }
    }
    map.getSource('pl').setData(fc(planes));
    map.getSource('lb').setData(fc(labels));
    map.getSource('tr').setData(fc(trails));
    if(C.follow&&followPos)map.jumpTo({center:followPos,zoom:map.getZoom()});
    if(S.counters){el('hca',na);el('hcd',nd);}
    if(S.clock&&C.window){var d=new Date((Treal+C.utcOffset*3600)*1000);el('hrt',pad(d.getUTCHours())+':'+pad(d.getUTCMinutes())+' '+(C.utcOffset===-4?'EDT':'UTC'));if(CFG.dateLabel)el('hrd',CFG.dateLabel);}
    el('htl',fmt(vt));document.getElementById('hscrub').value=vt;ro();
  }
  function el(id,v){var e=document.getElementById(id);if(e)e.textContent=v;}
  function loop(){if(!playing)return;var n=performance.now(),dt=(n-lastWall)/1000;lastWall=n;currentT+=dt*RATE;
    if(currentT>=VIDEO_LEN){currentT=VIDEO_LEN;playing=false;el2('hplay','\u25B6');}
    if(currentT<0)currentT=0;render(currentT);if(playing)requestAnimationFrame(loop);}
  function el2(id,h){var e=document.getElementById(id);if(e)e.innerHTML=h;}
  function realMult(){
    if(C.window){return Math.round((WT-WF)/VIDEO_LEN*RATE);}
    var span=0;for(var i=0;i<LIST.length;i++){var t=LIST[i].tk;var dd=t[t.length-1][0]-t[0][0];if(dd>span)span=dd;}
    return Math.round(span/VIDEO_LEN*RATE);
  }
  function setRate(r){RATE=r;el('hsp',realMult()+'x real time');
    var b=document.getElementsByClassName('hrb');
    for(var i=0;i<b.length;i++){b[i].style.background=(parseFloat(b[i].getAttribute('data-r'))===r)?'#4DABF7':'#2a2f3a';}}
  function play(){playing=!playing;el2('hplay',playing?'\u2759\u2759':'\u25B6');if(playing){if(currentT>=VIDEO_LEN)currentT=0;lastWall=performance.now();requestAnimationFrame(loop);}}
  function reset(){map.easeTo({center:[C.camera[0],C.camera[1]],zoom:C.camera[2],duration:600});}
  function ro(){if(!roOn)return;var c=map.getCenter();el('hread','center:['+c.lng.toFixed(4)+','+c.lat.toFixed(4)+']  zoom:'+map.getZoom().toFixed(2));}
  function wire(){
    document.getElementById('hplay').onclick=play;
    document.getElementById('hrst').onclick=reset;
    var b=document.getElementsByClassName('hrb');
    for(var i=0;i<b.length;i++){(function(bb){bb.onclick=function(){setRate(parseFloat(bb.getAttribute('data-r')));};})(b[i]);}
    document.getElementById('hscrub').oninput=function(){playing=false;el2('hplay','\u25B6');currentT=parseFloat(this.value);render(currentT);};
    document.addEventListener('keydown',function(e){
      if(e.key===' '){e.preventDefault();play();}
      if(e.key==='h'||e.key==='H'){document.body.classList.toggle('hclean');setTimeout(function(){map.resize();},50);}
      if(e.key==='t'||e.key==='T'){document.body.classList.toggle('hnotime');}
      if(e.key==='n'||e.key==='N'){document.body.classList.toggle('hnocount');}
      if(e.key==='c'||e.key==='C'){roOn=!roOn;document.getElementById('hread').style.display=roOn?'block':'none';}
      if(e.key==='r'||e.key==='R'){reset();}
      if(e.key==='ArrowUp'){e.preventDefault();var r=[0.25,0.5,1,2,4],j=r.indexOf(RATE);setRate(r[Math.min(4,j+1)]);}
      if(e.key==='ArrowDown'){e.preventDefault();var r2=[0.25,0.5,1,2,4],k=r2.indexOf(RATE);setRate(r2[Math.max(0,k-1)]);}
      if(e.key==='ArrowRight'){e.preventDefault();currentT=Math.min(VIDEO_LEN,currentT+1);render(currentT);}
      if(e.key==='ArrowLeft'){e.preventDefault();currentT=Math.max(0,currentT-1);render(currentT);}
    });
    map.on('move',ro);
  }
};
})();
