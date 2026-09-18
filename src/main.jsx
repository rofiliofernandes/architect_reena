import React,{useEffect,useMemo,useRef,useState} from "react";
import {createRoot} from "react-dom/client";
import {ArrowUpRight,Menu,X,Plus,Trash2,Save,Eye,Monitor,Tablet,Smartphone,LogOut,LayoutDashboard,FolderOpen,FileText,HardDrive,Upload,ChevronLeft,GripVertical,Lock} from "lucide-react";
import "./styles.css";
import {api} from "./api";

const imgs=[
"https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1800&q=82",
"https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1800&q=82",
"https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1800&q=82",
"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=82",
"https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1800&q=82",
"https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1800&q=82"
];

const seedProject={
 id:"p1",title:"Casa Monsoon",location:"Assagao, Goa",category:"Residential",year:"2026",status:"Completed",
 excerpt:"A quiet tropical residence shaped around shade, breeze and the rhythm of monsoon rain.",cover:imgs[0],
 gallery:imgs.slice(1,5),videos:[],construction:{stage:"Completed",note:"Final detailing and landscape completed.",media:[]},
 reenaNote:"A home designed to feel naturally connected to its garden, with shade and airflow doing much of the work.",
 published:true
};
const seedProject2={...seedProject,id:"p2",title:"Courtyard House",location:"North Goa",category:"Residential",year:"2025",status:"Under Construction",excerpt:"A courtyard-led home that grows around light, landscape and protected outdoor space.",cover:imgs[2],gallery:[imgs[3],imgs[4]],videos:[],construction:{stage:"Structure & masonry",note:"The main structure is taking shape on site.",media:[]},reenaNote:"The courtyard became the centre of the project — both spatially and climatically.",published:true};

function App(){
 const [admin,setAdmin]=useState(location.pathname.startsWith("/admin"));
 const [authChecked,setAuthChecked]=useState(false),[authed,setAuthed]=useState(false);
 const [projects,setProjects]=useState([]),[loaded,setLoaded]=useState(false);
 const [storage,setStorage]=useState({usedBytes:0,limitBytes:7*1024*1024*1024,usedGB:0,limitGB:7});
 const skipNextSync=useRef(false);

 useEffect(()=>{api.session().then(s=>setAuthed(s.authenticated)).catch(()=>setAuthed(false)).finally(()=>setAuthChecked(true))},[]);
 useEffect(()=>{
  skipNextSync.current=true;
  (admin&&authed?api.listAdmin():api.listPublic()).then(p=>{setProjects(p);setLoaded(true)}).catch(()=>setLoaded(true));
 },[admin,authed]);
 useEffect(()=>{
  if(!loaded)return;
  if(skipNextSync.current){skipNextSync.current=false;return}
  api.sync(projects).then(()=>api.storage().then(setStorage)).catch(()=>{});
 },[projects]);

 const enter=()=>{history.pushState({},"","/admin");setAdmin(true)}, exit=()=>{history.pushState({},"","/");setAdmin(false)};
 if(admin){
  if(!authChecked)return <div className="boot-loading">Loading…</div>;
  if(!authed)return <Login onSuccess={()=>setAuthed(true)} exit={exit}/>;
  return <Admin projects={projects} setProjects={setProjects} storage={storage} setStorage={setStorage} exit={()=>{api.logout().catch(()=>{});setAuthed(false);exit()}}/>;
 }
 return <Public projects={projects} openAdmin={enter}/>;
}

function Login({onSuccess,exit}){
 const [password,setPassword]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const submit=async e=>{e.preventDefault();setBusy(true);setError("");try{await api.login(password);onSuccess()}catch(err){setError(err.message||"Login failed")}finally{setBusy(false)}};
 return <div className="login-screen"><form onSubmit={submit}><Lock size={22}/><h1>Studio access</h1><p>Enter the admin password to continue.</p><input type="password" autoFocus value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password"/>{error&&<span className="login-error">{error}</span>}<button className="primary" disabled={busy}>{busy?"Checking…":"Enter"}</button><button type="button" className="text-link" onClick={exit}>← Back to website</button></form></div>
}

function Nav({page,setPage}){
 const [open,setOpen]=useState(false);
 return <header className="nav"><button className="wordmark" onClick={()=>setPage("home")}>ARCHITECT REENA LOTLIKAR</button>
 <nav className={open?"nav-links open":"nav-links"}>{[["home","Home"],["projects","Work"],["studio","About"],["contact","Contact"]].map(([k,l])=><button className={page===k?"active":""} onClick={()=>{setPage(k);setOpen(false)}} key={k}>{l}</button>)}</nav>
 <button className="menu-btn" onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button></header>
}

function Public({projects,openAdmin}){
 const [page,setPage]=useState("home"),[project,setProject]=useState(null);
 if(project)return <ProjectPage p={project} back={()=>setProject(null)}/>;
 return <div className="site"><Nav page={page} setPage={setPage}/>
 {page==="home"&&<Home projects={projects} open={setProject}/>}
 {page==="projects"&&<Work projects={projects} open={setProject}/>}
 {page==="studio"&&<About/>}
 {page==="contact"&&<Contact/>}
 <footer><span>ARCHITECT REENA LOTLIKAR</span><span>Architecture · Interior · Goa</span><button onClick={openAdmin}>Admin</button></footer></div>
}

function Home({projects,open}){
 const visible=projects.filter(p=>p.published);
 return <main><section className="hero-v1"><div className="hero-v1-copy"><p className="eyebrow">ARCHITECT · GOA</p><h1>Spaces that<br/><em>belong.</em></h1><p className="hero-v1-lede">Residential architecture and interiors shaped by people, place, climate and the way a space is actually lived.</p><div className="hero-v1-links"><button className="text-link" onClick={()=>document.getElementById("selected-work")?.scrollIntoView({behavior:"smooth"})}>Selected work <span>↓</span></button><button className="text-link" onClick={()=>open(visible[0])}>View a project <ArrowUpRight size={15}/></button></div></div><div className="hero-v1-image"><img src={visible[0]?.cover||imgs[0]}/><span>01 / Selected work</span></div></section>
 <section id="selected-work" className="selected-section"><div className="section-head"><div><p className="eyebrow">Selected work</p><h2>Built, building,<br/><em>becoming.</em></h2></div><button className="text-link" onClick={()=>{}}></button></div><ProjectGrid projects={visible.slice(0,4)} open={open}/></section>
 <section className="about-strip"><div><p className="eyebrow">The architect</p><h2>25 years of practice.<br/><em>Still curious.</em></h2></div><div><p>Reena Lotlikar works across residential architecture and interiors, with a hands-on approach from first sketch through construction and completion.</p><span className="quiet-note">Architecture · Interiors · Goa</span></div></section>
 <section className="home-contact"><p className="eyebrow">Have a project in mind?</p><h2>Let's talk about<br/><em>your place.</em></h2><a className="outline-btn" href="mailto:hello@example.com">Get in touch <ArrowUpRight size={16}/></a></section>
 </main>
}
function ProjectGrid({projects,open}){
 return <section className="project-grid">{projects.map((p,i)=><article className="project-card" key={p.id} onClick={()=>open(p)}>
 <div className="project-image"><img src={p.cover||imgs[i%imgs.length]}/><span>{String(i+1).padStart(2,"0")}</span><b>{p.status}</b></div>
 <div className="project-meta"><div><p>{p.category} / {p.location}</p><h3>{p.title}</h3><small>{p.year}</small></div><ArrowUpRight className="card-arrow"/></div>
 </article>)}</section>
}

function Work({projects,open}){return <main className="inner"><div className="page-head"><p className="eyebrow">01 / Work</p><h1>The work<br/><em>speaks for itself.</em></h1><p className="page-intro">Completed homes, projects under construction and spaces taking shape across Goa.</p></div><ProjectGrid projects={projects.filter(p=>p.published)} open={open}/></main>}

function ProjectPage({p,back}){
 return <div className="site"><header className="nav"><button className="wordmark" onClick={back}>ARCHITECT REENA LOTLIKAR</button><button className="back" onClick={back}>← Back to work</button></header>
 <main className="project-page"><div className="project-title"><p className="eyebrow">{p.category} · {p.location} · {p.year}</p><h1>{p.title}</h1><p>{p.excerpt}</p></div>
 <div className="large-photo" style={{backgroundImage:`url(${p.cover})`}}/>
 <div className="facts">{[["Location",p.location],["Type",p.category],["Year",p.year],["Status",p.status]].map(x=><div key={x[0]}><small>{x[0]}</small><strong>{x[1]}</strong></div>)}</div>
 <section className="visual-story">{p.gallery?.map((image,i)=><figure key={image}><img src={image}/><figcaption>{["Light and material.","The garden edge.","A quiet transition.","Inside, outside."][i]||"Project view."}</figcaption></figure>)}</section>
 {p.videos?.length>0&&<section className="media-section"><p className="eyebrow">On video</p>{p.videos.map(v=><video key={v} src={v} controls/> )}</section>}
 {p.construction?.stage&&<section className="construction"><div><p className="eyebrow">Construction</p><h2>{p.construction.stage}</h2><p>{p.construction.note}</p></div><div className="stage-line"><span className="done">Design</span><span className={["Structure & masonry","Finishing","Completed"].includes(p.construction.stage)?"done":""}>Build</span><span className={p.construction.stage==="Completed"?"done":""}>Complete</span></div>{p.construction.media?.map(m=><img key={m} src={m}/>)}</section>}
 {p.reenaNote&&<section className="reena-note"><p className="eyebrow">Reena's note</p><blockquote>“{p.reenaNote}”</blockquote></section>}
 <section className="project-end"><button className="outline-btn" onClick={back}>← View all work</button></section></main></div>
}

function About(){return <main className="inner about"><div className="about-grid"><div><p className="eyebrow">02 / About</p><h1>Architect<br/><em>Reena Lotlikar.</em></h1></div><div><p className="big-copy">Architecture is a long conversation between a person, a place and the people who eventually live with it.</p><p>With 25 years of experience, Reena Lotlikar brings a hands-on, considered approach to residential architecture and interiors in Goa.</p><p>The website is intentionally project-led: the work, the construction and the finished spaces say more than a long list of credentials.</p></div></div></main>}

function Contact(){return <main className="inner contact"><p className="eyebrow">04 / Contact</p><h1>Start with a<br/><em>conversation.</em></h1><p>For residential architecture, interiors, renovations and projects in Goa.</p><a href="mailto:hello@example.com">hello@example.com ↗</a></main>}

function Admin({projects,setProjects,storage,setStorage,exit}){
 const [section,setSection]=useState("dashboard"),[editing,setEditing]=useState(null),[preview,setPreview]=useState(null);
 const projectNew=()=>{setEditing({type:"project",item:{...seedProject,id:"p"+Date.now(),title:"New project",location:"",category:"Residential",year:"2026",status:"Proposed",excerpt:"",cover:"",gallery:[],videos:[],construction:{stage:"Design",note:"",media:[]},reenaNote:"",published:false}})};
 if(preview)return <Preview item={preview.item} type={preview.type} close={()=>setPreview(null)}/>;
 if(editing)return <Editor data={editing} setData={setEditing} save={(item)=>{setProjects(x=>x.some(p=>p.id===item.id)?x.map(p=>p.id===item.id?item:p):[...x,item]);setEditing(null)}} preview={setPreview}/>;
 return <div className="admin"><aside><div className="admin-brand">REENA<br/><span>LOTLIKAR</span></div>{[["dashboard","Dashboard",LayoutDashboard],["projects","Projects",FolderOpen],["media","Media",Upload],["storage","Storage",HardDrive]].map(([k,l,I])=><button className={section===k?"selected":""} onClick={()=>setSection(k)} key={k}><I size={17}/>{l}</button>)}<button className="exit" onClick={exit}><LogOut size={17}/>Exit</button></aside><div className="admin-main"><header className="admin-top"><div><small>PRIVATE STUDIO</small><h1>{section==="dashboard"?"Good evening, Reena.":section[0].toUpperCase()+section.slice(1)}</h1></div><button className="view-site" onClick={exit}>View website ↗</button></header>
 {section==="dashboard"&&<Dashboard projects={projects} open={setEditing} storage={storage}/>}
 {section==="projects"&&<ProjectAdmin projects={projects} edit={x=>setEditing({type:"project",item:x})} add={projectNew} remove={id=>setProjects(x=>x.filter(p=>p.id!==id))}/>}

 {section==="media"&&<Media storage={storage} setStorage={setStorage}/>}
 {section==="storage"&&<Storage storage={storage}/>}
 </div></div>
}

function Dashboard({projects,open,storage}){return <div className="dashboard"><div className="dash-intro"><p>Your studio at a glance.</p><div><button className="primary" onClick={()=>open({type:"project",item:{...seedProject,id:"p"+Date.now(),title:"New project",location:"",category:"Residential",year:"2026",status:"Proposed",excerpt:"",cover:"",gallery:[],videos:[],construction:{stage:"Design",note:"",media:[]},reenaNote:"",published:false}})}><Plus/> Add project</button></div></div><div className="stat-grid"><div><small>Published work</small><b>{projects.filter(p=>p.published).length}</b></div><div><small>Under construction</small><b>{projects.filter(p=>p.status==="Under Construction").length}</b></div><div><small>Media used</small><b>{storage.usedGB.toFixed(2)} GB</b></div></div><h2 className="dash-heading">Recent work</h2><div className="recent">{projects.slice(0,4).map(p=><div key={p.id}><img src={p.cover||imgs[0]}/><div><b>{p.title}</b><span>{p.location} · {p.status}</span></div><button onClick={()=>open({type:"project",item:p})}>Edit</button></div>)}</div></div>}

function ProjectAdmin({projects,edit,add,remove}){return <div className="list-page"><div className="list-head"><div><small>WORK</small><h2>Projects</h2><p>Keep it visual. Add only what helps the work speak.</p></div><button className="primary" onClick={add}><Plus/> New project</button></div>{projects.map(p=><div className="list-row" key={p.id}><img src={p.cover||imgs[0]}/><div><b>{p.title}</b><span>{p.location||"Location not set"} · {p.year} · {p.status}</span></div><span className={p.published?"live":"draft"}>{p.published?"Live":"Draft"}</span><button onClick={()=>edit(p)}>Edit</button><button className="icon-danger" onClick={()=>remove(p.id)}><Trash2/></button></div>)}</div>}

function Field({label,value,onChange,area=false,placeholder=""}){return <label className="field"><span>{label}</span>{area?<textarea value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>:<input value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>}</label>}

function UploadBox({label,onFiles,accept="image/*"}){const [drag,setDrag]=useState(false);return <label className={"upload-box "+(drag?"drag":"")} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);onFiles([...e.dataTransfer.files])}}><Upload size={20}/><b>{label}</b><span>Drop here or click to choose</span><input type="file" multiple accept={accept} onChange={e=>onFiles([...e.target.files])}/></label>}

function Editor({data,setData,save,preview}){
 const [item,setItem]=useState(data.item);
 const set=(k,v)=>setItem(x=>({...x,[k]:v}));
 const addImages=async(files,key)=>{const uploaded=[];for(const f of files){try{const res=await api.upload(f);uploaded.push(res.url)}catch(err){alert(err.message||"Upload failed")}}setItem(x=>({...x,[key]:[...(x[key]||[]),...uploaded]}))};
 return <div className="editor"><header className="editor-top"><button onClick={()=>setData(null)}><ChevronLeft/> Back</button><div><small>PROJECT</small><h1>{item.title}</h1></div><div className="editor-actions"><button onClick={()=>preview({type:"project",item})}><Eye/> Preview</button><button className="primary" onClick={()=>save(item)}><Save/> Save</button></div></header>
 <div className="editor-body"><div className="editor-form">
 <section className="form-card"><div className="card-title"><small>01 / BASICS</small><h2>Just the essentials</h2><p>No architectural essay required.</p></div><Field label="Project name" value={item.title} onChange={v=>set("title",v)}/><div className="two"><Field label="Location" value={item.location} onChange={v=>set("location",v)}/><Field label="Project type" value={item.category} onChange={v=>set("category",v)}/></div><div className="three"><Field label="Year" value={item.year} onChange={v=>set("year",v)}/><label className="field"><span>Status</span><select value={item.status} onChange={e=>set("status",e.target.value)}><option>Completed</option><option>Under Construction</option><option>Proposed</option></select></label><Field label="One-line description" value={item.excerpt} onChange={v=>set("excerpt",v)}/></div></section>
 <section className="form-card"><div className="card-title"><small>02 / COVER</small><h2>Choose the image that represents it.</h2></div>{item.cover&&<img className="cover-preview" src={item.cover}/>}<Field label="Cover image URL" value={item.cover} onChange={v=>set("cover",v)}/><UploadBox label="Or upload a cover image" onFiles={f=>{if(f[0])api.upload(f[0]).then(res=>set("cover",res.url)).catch(err=>alert(err.message||"Upload failed"))}}/></section>
 <section className="form-card"><div className="card-title"><small>03 / GALLERY</small><h2>Show the work.</h2><p>Drag in as many images as you need. Captions are intentionally omitted.</p></div><div className="thumb-grid">{item.gallery?.map((x,i)=><div key={x}><img src={x}/><button onClick={()=>{api.deleteMedia(x).catch(()=>{});set("gallery",item.gallery.filter((_,j)=>j!==i))}}><Trash2/></button></div>)}</div><UploadBox label="Add project photos" onFiles={f=>addImages(f,"gallery")}/></section>
 <section className="form-card"><div className="card-title"><small>04 / VIDEO</small><h2>Moving images, when useful.</h2></div><Field label="Video URL" value="" onChange={v=>{if(v)set("videos",[...(item.videos||[]),v])}} placeholder="https://…"/><UploadBox label="Or upload video" accept="video/*" onFiles={f=>addImages(f,"videos")}/>{item.videos?.map((v,i)=><div className="simple-line" key={v}>Video {i+1}<button onClick={()=>{api.deleteMedia(v).catch(()=>{});set("videos",item.videos.filter((_,j)=>j!==i))}}><Trash2/></button></div>)}</section>
 <section className="form-card"><div className="card-title"><small>05 / CONSTRUCTION</small><h2>What is happening on site?</h2><p>Optional. Use it when the project is being built.</p></div><label className="field"><span>Current stage</span><select value={item.construction?.stage||"Design"} onChange={e=>set("construction",{...item.construction,stage:e.target.value})}><option>Design</option><option>Structure & masonry</option><option>Finishing</option><option>Completed</option></select></label><Field label="Short site note (optional)" value={item.construction?.note||""} onChange={v=>set("construction",{...item.construction,note:v})}/><UploadBox label="Add construction photos" onFiles={f=>{(async()=>{const uploaded=[];for(const file of f){try{const res=await api.upload(file);uploaded.push(res.url)}catch(err){alert(err.message||"Upload failed")}}set("construction",{...item.construction,media:[...(item.construction?.media||[]),...uploaded]})})()}}/></section>
 <section className="form-card"><div className="card-title"><small>06 / REENA'S NOTE</small><h2>One thought, if you want it.</h2></div><Field label="Short note" value={item.reenaNote} area onChange={v=>set("reenaNote",v)} placeholder="What matters about this project to you?"/><label className="switchline"><input type="checkbox" checked={item.published} onChange={e=>set("published",e.target.checked)}/> Publish on website</label></section>
 </div><aside className="editor-side"><div className="side-sticky"><small>LIVE SUMMARY</small><h3>{item.title||"Untitled"}</h3><span>{item.location||"Location"} · {item.status}</span><img src={item.cover||imgs[0]}/><p>{item.excerpt||"Add a short description when useful."}</p><button className="outline-btn" onClick={()=>preview({type:"project",item})}><Eye size={16}/> Preview page</button></div></aside></div></div>
}
function Preview({item,type,close}){const [device,setDevice]=useState("desktop");return <div className="preview-screen"><header><button onClick={close}>← Back to editor</button><div className="device-pills"><button className={device==="desktop"?"on":""} onClick={()=>setDevice("desktop")}><Monitor/> Desktop</button><button className={device==="tablet"?"on":""} onClick={()=>setDevice("tablet")}><Tablet/> Tablet</button><button className={device==="mobile"?"on":""} onClick={()=>setDevice("mobile")}><Smartphone/> Mobile</button></div><span>Preview only</span></header><div className="preview-stage"><div className={"device "+device}><MiniProject p={item}/></div></div></div>}
function MiniProject({p}){return <div className="mini-site"><div className="mini-nav">ARCHITECT REENA LOTLIKAR <span>WORK · ABOUT · CONTACT</span></div><div className="mini-title"><small>{p.category} · {p.location}</small><h1>{p.title}</h1><p>{p.excerpt}</p></div><img className="mini-cover" src={p.cover||imgs[0]}/><div className="mini-facts">{[["Location",p.location],["Type",p.category],["Year",p.year],["Status",p.status]].map(x=><div key={x[0]}><small>{x[0]}</small><b>{x[1]}</b></div>)}</div>{p.gallery?.slice(0,3).map(x=><img className="mini-image" src={x} key={x}/>)}{p.construction?.stage&&<div className="mini-construction"><small>CONSTRUCTION</small><h2>{p.construction.stage}</h2><p>{p.construction.note}</p></div>}{p.reenaNote&&<blockquote>“{p.reenaNote}”</blockquote>}</div>}

function Media({storage,setStorage}){const [files,setFiles]=useState([]);const upload=async fs=>{for(const f of fs){try{await api.upload(f);setFiles(x=>[...x,{name:f.name,size:f.size/1048576}])}catch(err){alert(err.message||"Upload failed");continue}}try{setStorage(await api.storage())}catch{}};return <div className="storage-page"><div className="storage-hero"><small>MEDIA LIBRARY</small><h2>Project media</h2><p>Uploads are stored in this project's dedicated R2 bucket.</p><UploadBox label="Add images or video" accept="image/*,video/*" onFiles={upload}/></div>{files.map((f,i)=><div className="file-line" key={i}><span>{f.name}</span><b>{f.size.toFixed(2)} MB</b></div>)}</div>}
function Storage({storage}){const pct=Math.min(100,storage.usedBytes/storage.limitBytes*100);return <div className="storage-page"><div className="storage-card"><div><small>ISOLATED CURRENT-STORAGE QUOTA</small><h2>{storage.usedGB.toFixed(2)} <span>/ {storage.limitGB} GB</span></h2><p>{Math.max(0,storage.limitGB-storage.usedGB).toFixed(2)} GB remaining</p></div><div className="quota-bar"><i style={{width:`${pct}%`}}/></div></div><div className="form-card"><small>POLICY</small><h2>7 GB hard limit</h2><ul><li>Quota is for current stored media, not lifetime uploads.</li><li>Deleted media returns its space.</li><li>Project content is separate from media storage.</li><li>Production resources are isolated to this application's own R2 bucket and D1 database.</li><li>Enforced server-side on every upload.</li></ul></div></div>}

createRoot(document.getElementById("root")).render(<App/>);
