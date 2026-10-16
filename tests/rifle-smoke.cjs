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
 const g=lunaGame;g.mode='inspection';g.renderer.render=()=>{};
 const T=await import('./vendor/three.module.js'),{Actor}=await import('./game/actors.js');
 const scene=new T.Scene();scene.background=new T.Color(0x34454d);
 scene.add(new T.HemisphereLight(0xfff3df,0x91a1ac,2.5));const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(3,5,4);scene.add(sun);
 const floor=new T.Mesh(new T.PlaneGeometry(8,8),new T.MeshStandardMaterial({color:0x657771}));floor.rotation.x=-Math.PI/2;floor.position.y=-.002;scene.add(floor);
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(430,550);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
 const camera=new T.PerspectiveCamera(38,430/550,.05,30),images=[];
 for(const kind of ['cody','may']){
 const a=new Actor(g.assets[kind],kind,scene,g.assets);a.armed=true;a.setWeapon('colt723');
 for(const moving of [false,true])for(const phase of [.15,.6]){
  for(let i=0;i<30;i++){a.animate(1/30,{moving,speed:3.1});a.updateGun();}
  const action=a.actions.get(moving?'RifleRun':'RifleIdle');action.time=action.getClip().duration*phase;a.mixer.update(0);a.correctGround();a.updateGun();
  if(a.current!==(moving?'RifleRun':'RifleIdle'))throw Error('wrong pose');
  camera.position.set(2.5,1.8,3.8);camera.lookAt(0,.95,0);renderer.render(scene,camera);
  images.push({name:kind+'-'+(moving?'run':'idle')+'-'+phase,data:renderer.domElement.toDataURL().split(',')[1]});
 }
 a.remove();
 }
 renderer.dispose();
 // Reproduce a save / player moving directly into Cody; update must separate.
 g.may.position.set(0,0,0);g.cody.position.set(0,0,0);g.updateCody(1/60);
 return {images,separation:g.may.position.distanceTo(g.cody.position)};
 });
 for(const image of result.images)fs.writeFileSync(path.join(out,'rifle-'+image.name+'.png'),Buffer.from(image.data,'base64'));
 assert(result.separation>=1.049,'characters overlap');assert.deepEqual(errors,[]);console.log(JSON.stringify({poses:result.images.length,separation:result.separation,errors}));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
