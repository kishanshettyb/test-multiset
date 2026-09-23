<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Three.js Navigation Arrow Test</title>
<style>
html,body,#app{margin:0;width:100%;height:100%;overflow:hidden;background:#101216}
#info{position:fixed;top:16px;left:16px;right:16px;z-index:5;color:#fff;background:#000b;padding:14px;border-radius:14px;font:14px Arial}
#info b{font-size:18px}
#buttons{position:fixed;bottom:18px;left:0;right:0;z-index:5;text-align:center}
button{padding:13px 18px;border:0;border-radius:14px;margin:4px;font-weight:700}
</style>
</head>
<body>
<div id="app"></div>
<div id="info"><b>Indoor Navigation — Three.js Test</b><div id="status">Navigating → Lift</div></div>
<div id="buttons"><button id="reset">Reset</button></div>

<script type="module">
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js";
import {OrbitControls} from "https://cdn.jsdelivr.net/npm/three@0.179.1/examples/jsm/controls/OrbitControls.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101216);

const camera = new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.01,1000);
camera.position.set(7,8,10);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
document.getElementById("app").appendChild(renderer.domElement);

const controls = new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;

scene.add(new THREE.HemisphereLight(0xffffff,0x444444,2));

const light=new THREE.DirectionalLight(0xffffff,2);
light.position.set(5,10,5);
scene.add(light);

const floor=new THREE.Mesh(
 new THREE.PlaneGeometry(18,14),
 new THREE.MeshStandardMaterial({color:0x242830})
);
floor.rotation.x=-Math.PI/2;
scene.add(floor);

scene.add(new THREE.GridHelper(18,36,0x555b66,0x30343b));

/*
 TEST ROUTE

 Replace these points with your real MultiSet coordinates later.
*/
const route=[
 new THREE.Vector3(-4,.08,4),
 new THREE.Vector3(-2.8,.08,3.5),
 new THREE.Vector3(-1.6,.08,3),
 new THREE.Vector3(-.4,.08,2.7),
 new THREE.Vector3(.8,.08,2.1),
 new THREE.Vector3(1.7,.08,1.2),
 new THREE.Vector3(2.5,.08,.3)
];

const line=new THREE.Line(
 new THREE.BufferGeometry().setFromPoints(route),
 new THREE.LineBasicMaterial({color:0x4da3ff,transparent:true,opacity:.35})
);
scene.add(line);

/* ---------------- ARROWS ---------------- */

const arrowGroup=new THREE.Group();
scene.add(arrowGroup);

const arrows=[];

function createArrow(){
 const g=new THREE.Group();

 const shaft=new THREE.Mesh(
  new THREE.BoxGeometry(.18,.035,.48),
  new THREE.MeshStandardMaterial({
   color:0x55c7ff,
   emissive:0x147ba8,
   emissiveIntensity:1.2
  })
 );

 const head=new THREE.Mesh(
  new THREE.ConeGeometry(.20,.34,3),
  new THREE.MeshStandardMaterial({
   color:0x55c7ff,
   emissive:0x147ba8,
   emissiveIntensity:1.4
  })
 );

 head.rotation.x=Math.PI/2;
 head.position.z=-.35;

 g.add(shaft,head);
 g.userData.phase=Math.random()*Math.PI*2;
 return g;
}

for(let i=0;i<route.length-1;i++){
 const a=route[i],b=route[i+1];
 const direction=new THREE.Vector3().subVectors(b,a);
 const distance=direction.length();
 const count=Math.max(1,Math.floor(distance/.65));

 for(let j=0;j<count;j++){
  const t=(j+.5)/count;
  const arrow=createArrow();
  arrow.position.lerpVectors(a,b,t);
  arrow.rotation.y=Math.atan2(direction.x,direction.z);
  arrowGroup.add(arrow);
  arrows.push(arrow);
 }
}

/* ---------------- DESTINATION MARKER ---------------- */

const destination=route[route.length-1];
const marker=new THREE.Group();
marker.position.copy(destination);
scene.add(marker);

const base=new THREE.Mesh(
 new THREE.CylinderGeometry(.48,.48,.08,48),
 new THREE.MeshStandardMaterial({
  color:0x42d392,
  emissive:0x176b4b,
  emissiveIntensity:1
 })
);
base.position.y=.12;
marker.add(base);

const ring=new THREE.Mesh(
 new THREE.RingGeometry(.55,.65,48),
 new THREE.MeshBasicMaterial({
  color:0x6fffb2,
  transparent:true,
  opacity:.8,
  side:THREE.DoubleSide
 })
);
ring.rotation.x=-Math.PI/2;
ring.position.y=.18;
marker.add(ring);

/* ---------------- DESTINATION BOARD ---------------- */

const board=new THREE.Group();
board.position.set(destination.x,destination.y+1.15,destination.z);
scene.add(board);

const canvas=document.createElement("canvas");
canvas.width=1024;
canvas.height=256;
const ctx=canvas.getContext("2d");

ctx.fillStyle="#11151c";
ctx.fillRect(0,0,1024,256);
ctx.fillStyle="#55c7ff";
ctx.font="bold 90px Arial";
ctx.textAlign="center";
ctx.textBaseline="middle";
ctx.fillText("LIFT",512,128);

const texture=new THREE.CanvasTexture(canvas);

const text=new THREE.Mesh(
 new THREE.PlaneGeometry(1.55,.39),
 new THREE.MeshBasicMaterial({map:texture,transparent:true})
);
text.position.z=.04;

const panel=new THREE.Mesh(
 new THREE.BoxGeometry(1.7,.55,.06),
 new THREE.MeshStandardMaterial({color:0x11151c})
);

board.add(panel,text);

/* ---------------- USER ---------------- */

const user=new THREE.Mesh(
 new THREE.SphereGeometry(.18,24,24),
 new THREE.MeshStandardMaterial({
  color:0xffcc55,
  emissive:0x8a5b00,
  emissiveIntensity:1.3
 })
);
user.position.copy(route[0]);
user.position.y=.3;
scene.add(user);

let progress=0;
let reached=false;

function updateUser(delta){
 if(reached)return;

 progress+=delta*.045;

 if(progress>=1){
  progress=1;
  reached=true;
  document.getElementById("status").textContent="✓ Destination reached — Lift";
 }else{
  document.getElementById("status").textContent="Navigating → Lift";
 }

 const scaled=progress*(route.length-1);
 const index=Math.min(Math.floor(scaled),route.length-2);
 const t=scaled-index;

 user.position.lerpVectors(route[index],route[index+1],t);
 user.position.y=.3;
}

function animate(time){
 requestAnimationFrame(animate);

 arrows.forEach((a,i)=>{
  const phase=time*.004+i*.65+a.userData.phase;
  const pulse=.85+Math.sin(phase)*.15;
  a.scale.set(pulse,pulse,pulse);
  a.position.y=.08+Math.max(0,Math.sin(phase))*.035;
 });

 if(reached){
  const p=1+Math.sin(time*.005)*.22;
  ring.scale.set(p,p,p);
  ring.material.opacity=.45+(Math.sin(time*.005)+1)*.2;
 }

 updateUser(clock.getDelta());

 board.quaternion.copy(camera.quaternion);
 controls.update();
 renderer.render(scene,camera);
}

const clock=new THREE.Clock();
requestAnimationFrame(animate);

document.getElementById("reset").onclick=()=>{
 progress=0;
 reached=false;
 user.position.copy(route[0]);
 user.position.y=.3;
 document.getElementById("status").textContent="Navigating → Lift";
};

addEventListener("resize",()=>{
 camera.aspect=innerWidth/innerHeight;
 camera.updateProjectionMatrix();
 renderer.setSize(innerWidth,innerHeight);
});
</script>
</body>
</html>