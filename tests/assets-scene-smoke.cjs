const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../web'),out=path.resolve(__dirname,'../build/qa');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.LUNA_CHROMIUM,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl']});
 try{
 const page=await browser.newPage({viewport:{width:1100,height:650}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
 await page.waitForFunction(()=>window.lunaGame?.ready,null,{timeout:180000});
 const result=await page.evaluate(async()=>{
 const g=lunaGame;g.mode='inspection';const drawGame=g.renderer.render.bind(g.renderer);g.renderer.render=()=>{};
 const T=await import('./vendor/three.module.js'),{Actor}=await import('./game/actors.js');
 const scene=new T.Scene();scene.background=new T.Color(0x34454d);
 scene.add(new T.HemisphereLight(0xfff3df,0x91a1ac,2.5));const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(3,5,4);scene.add(sun);
 const floor=new T.Mesh(new T.PlaneGeometry(8,8),new T.MeshStandardMaterial({color:0x657771}));floor.rotation.x=-Math.PI/2;floor.position.y=-.002;scene.add(floor);
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(430,550);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
 const camera=new T.PerspectiveCamera(38,430/550,.05,30),images=[];
 for(const kind of ['cody','zombie','zombieShirt']){
 const zombie=kind!=='cody', a=new Actor(g.assets[kind],zombie?'zombie':kind,scene,g.assets);a.armed=false;if(a.gun)a.gun.visible=false;
 const poses=zombie?['Idle_Lurch','Idle_Sway','Walk_Shuffle','Walk_Heavy']:['Idle','Talk','Run','Aim'];
 for(const pose of poses)for(const phase of [.15,.6]){
  a.play(pose,true);const action=a.actions.get(pose);action.time=action.getClip().duration*phase;a.mixer.update(0);a.correctGround();
  if(!zombie)a.model.traverse(o=>{if(o.isMesh&&o.material.transparent)throw Error('opaque Cody material regressed');});
  const box=new T.Box3().setFromObject(a.model,true),size=box.getSize(new T.Vector3());
  if(size.y<1.3||size.y>2.1||size.z>1.8||size.x>2)throw Error(kind+' malformed bounds '+size.toArray());
  camera.position.set(2.5,1.8,3.8);camera.lookAt(0,.95,0);renderer.render(scene,camera);
  images.push({name:kind+'-'+pose+'-'+phase,data:renderer.domElement.toDataURL().split(',')[1]});
 }
 a.remove();
 }
 // A real source-model interior, not a separate box-room surrogate.
 const {freshPrologue}=await import('./game/state.js');g.start(freshPrologue(123));g.mode='inspection';g.cabin.setCutaway(true);
 g.scene.updateMatrixWorld(true);g.camera.position.set(3.3,2.7,1.2);g.camera.lookAt(1.0,1,-4.0);g.renderer.setSize(1000,700);
 // The test temporarily stopped automatic rendering before constructing actors.
 const draw=drawGame;draw(g.scene,g.camera);
 images.push({name:'cabin-interior',data:g.renderer.domElement.toDataURL().split(',')[1]});
 g.cabin.setCutaway(false);g.camera.position.set(18,13,-24);g.camera.lookAt(-1.6,4,-3.4);draw(g.scene,g.camera);
 images.push({name:'cabin-exterior',data:g.renderer.domElement.toDataURL().split(',')[1]});g.cabin.setCutaway(true);
 for(let i=0;i<10;i++)g.spawnEnemy((i%3-1)*.5,-9.5-Math.floor(i/3)*.5);
 const models=new Set(g.live().map(e=>e.choices.model));if(models.size!==2)throw Error('both provided zombies must spawn');
 const choices=g.live().map(e=>JSON.stringify(e.choices));g.cabin.breakDoor();
 g.state.flags.alarm=true;for(let i=0;i<300;i++)g.updateEnemies(1/30);
 if(!g.live().some(e=>e.actor.position.z>-7))throw Error('zombies cannot enter cabin');
 g.camera.position.set(3.3,2.7,1.2);g.camera.lookAt(0,1,-6);draw(g.scene,g.camera);images.push({name:'cabin-horde',data:g.renderer.domElement.toDataURL().split(',')[1]});
 if(g.live().some((e,i)=>JSON.stringify(e.choices)!==choices[i]))throw Error('per-instance motion changed');
 const save=g.snapshot();g.start(save);g.mode='inspection';
 if(new Set(g.live().map(e=>e.choices.model)).size!==2)throw Error('variant lost on load');
 renderer.dispose();
 // Reproduce a save / player moving directly into Cody; update must separate.
 g.may.position.set(0,0,0);g.cody.position.set(0,0,0);g.updateCody(1/60);
 return {images,separation:g.may.position.distanceTo(g.cody.position)};
 });
 for(const image of result.images)fs.writeFileSync(path.join(out,'assets-'+image.name+'.png'),Buffer.from(image.data,'base64'));
 assert(result.separation>=1.049,'characters overlap');assert.deepEqual(errors,[]);console.log(JSON.stringify({renders:result.images.length,separation:result.separation,errors}));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
