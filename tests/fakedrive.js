/* shared fake Google (sign-in + Drive) for tests — a richer copy of the one in t_google.js: parent listing, mime types, metadata */
let drive = { files: {}, n: 0, perms: [] };
const fakeGis = `window.google={accounts:{oauth2:{initTokenClient(o){const c={callback:o.callback,requestAccessToken(){setTimeout(()=>c.callback({access_token:"tok-"+(window.__who||"aemporio6@gmail.com"),expires_in:3600}),10)}};return c},revoke(t,cb){cb&&cb()}}}};`;
function mkRoute(ctx){
  return async route => {
    const req = route.request(); const url = new URL(req.url()); const auth = req.headers()["authorization"] || ""; const who = auth.replace("Bearer tok-", "");
    const json = (o, s) => route.fulfill({ status: s || 200, contentType: "application/json", body: JSON.stringify(o) });
    if (url.hostname === "accounts.google.com") return route.fulfill({ status: 200, contentType: "text/javascript", body: fakeGis });
    if (url.pathname === "/oauth2/v3/userinfo") return json({ email: who, name: who.split("@")[0] });
    const files = drive.files;
    const visible = f => f.owner === who || drive.perms.some(p => p.file === f.parent && p.email === who) || drive.perms.some(p => p.file === f.id && p.email === who);
    if (url.pathname === "/drive/v3/files" && req.method() === "GET") {
      const q = url.searchParams.get("q") || ""; drive.lastQ = q; const name = (q.match(/name\s*=\s*'([^']+)'/) || [])[1]; const contains = (q.match(/name contains '([^']+)'/) || [])[1]; const folder = q.includes("folder");
      const parent = (q.match(/'([^']+)' in parents/) || [])[1];
      let list;
      if(parent && !name && !contains) list = Object.values(files).filter(f => f.parent === parent && visible(f) && (!folder || f.folder));
      else list = Object.values(files).filter(f => (contains ? String(f.name).includes(contains) : f.name === name) && (folder ? f.folder : !f.folder) && visible(f));
      return json({ files: list.map(f => ({ id: f.id, name: f.name, mimeType: f.folder ? "application/vnd.google-apps.folder" : (f.mime || "application/json"), version: String(f.version), modifiedTime: f.modifiedTime || new Date().toISOString(), size: String((f.content || "").length), owners: [{ emailAddress: f.owner }], parents: [f.parent] })) });
    }
    if (url.pathname === "/drive/v3/files" && req.method() === "POST") { const b = JSON.parse(req.postData()); const id = "F" + (++drive.n); files[id] = { id, name: b.name, folder: true, owner: who, parent: (b.parents || [])[0], version: 1 }; return json({ id }); }
    let m;
    if ((m = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)\/permissions$/))) { const b = JSON.parse(req.postData()); drive.perms.push({ file: m[1], email: b.emailAddress, role: b.role }); return json({ id: "p" + drive.perms.length }); }
    if ((m = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)\/copy$/))) { const f = files[m[1]]; if (!f || !visible(f)) return json({ error: { message: "not found" } }, 404); const b = JSON.parse(req.postData()); const id = "F" + (++drive.n); files[id] = { id, name: b.name, owner: f.owner, parent: (b.parents || [f.parent])[0], version: 1, content: f.content, by: who }; return json({ id }); }
    if ((m = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/))) {
      const f = files[m[1]]; if (!f || !visible(f)) return json({ error: { message: "not found" } }, 404);
      if (url.searchParams.get("alt") === "media") return route.fulfill({ status: 200, contentType: f.mime || "application/json", body: f.content });
      return json({ id: f.id, name: f.name, mimeType: f.folder ? "application/vnd.google-apps.folder" : (f.mime || "application/json"), parents: [f.parent], version: String(f.version), modifiedTime: new Date().toISOString(), lastModifyingUser: { emailAddress: f.by || f.owner } });
    }
    if (url.pathname === "/upload/drive/v3/files" && req.method() === "POST") {
      const body = req.postData(); const parts = body.split(/--mt[a-z0-9]+/).filter(x => x.includes("Content-Type"));
      const meta = JSON.parse(parts[0].split("\r\n\r\n")[1]); const content = parts[1].split("\r\n\r\n").slice(1).join("\r\n\r\n").replace(/\r\n$/, "");
      const id = "F" + (++drive.n); files[id] = { id, name: meta.name, owner: who, parent: (meta.parents || [])[0], version: 1, content, by: who }; return json({ id, version: "1", webViewLink: "https://drive.google.com/file/d/" + id + "/view" });
    }
    if ((m = url.pathname.match(/^\/upload\/drive\/v3\/files\/([^/]+)$/))) { const f = files[m[1]]; if (!visible(f)) return json({ error: { message: "forbidden" } }, 403); f.content = req.postData(); f.version++; f.by = who; return json({ version: String(f.version) }); }
    return json({ error: { message: "unhandled " + url.pathname } }, 500);
  };
}

module.exports = { drive, mkRoute, fakeGis };
