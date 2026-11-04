/* Runs tools/gateway.gs in Node with stand-ins for the Apps Script services, so its rules can be tested without Google.
   makeGateway(seedJson, tokens) → { call(req), drive }   tokens: { "<token>": {email, aud?} } */
const fs = require("fs"), vm = require("vm"), path = require("path");
function makeGateway(seed, tokens, clientId){
  const CID = clientId || "605045779540-pjncsnms1af0s9al9k0de2om67fg0hce.apps.googleusercontent.com";
  const drive = { files: {}, n: 0, props: {}, cache: {}, log: [] };
  const mkFile = (name, content, folder, mime) => { const id = "F" + (++drive.n); const f = { id, name, content, folder, mime, editors: [], viewers: [], updated: new Date() }; drive.files[id] = f; return wrapFile(f); };
  const wrapFile = f => ({ getId: () => f.id, getName: () => f.name, getBlob: () => ({ getDataAsString: () => f.content }), setContent: s => { f.content = s; f.updated = new Date(); }, getLastUpdated: () => f.updated, getSize: () => f.content.length, getUrl: () => "https://drive.google.com/file/d/" + f.id + "/view", setDescription: () => {}, getEditors: () => f.editors.map(e => ({ getEmail: () => e })), getViewers: () => f.viewers.map(e => ({ getEmail: () => e })), removeEditor: u => { f.editors = f.editors.filter(e => e !== u.getEmail()); }, removeViewer: u => { f.viewers = f.viewers.filter(e => e !== u.getEmail()); }, setSharing: () => {}, addEditor: e => f.editors.push(e), addViewer: e => f.viewers.push(e), getOwner: () => ({ getEmail: () => "aemporio6@gmail.com" }), getParents: () => iter([]), moveTo: () => {}, _f: f });
  const iter = arr => { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; };
  const folders = {};
  const mkFolder = name => { if(folders[name]) return folders[name]; const fo = { name, files: [], editors: [], viewers: [] }; folders[name] = fo; fo.api = { getName: () => name, getFilesByName: n => iter(fo.files.filter(f => f._f.name === n)), getFiles: () => iter(fo.files.slice()), getFoldersByName: n => iter(folders[name + "/" + n] ? [folders[name + "/" + n].api] : []), createFolder: n => mkFolder(name + "/" + n).api, createFile: (n, content, mime) => { if(n && typeof n === "object"){ content = Buffer.from(n.bytes).toString(); mime = n.mime; n = n.name; } const f = mkFile(n, content, name, mime); fo.files.push(f); return f; }, getEditors: () => fo.editors.map(e => ({ getEmail: () => e })), getViewers: () => fo.viewers.map(e => ({ getEmail: () => e })), removeEditor: u => { fo.editors = fo.editors.filter(e => e !== u.getEmail()); }, removeViewer: u => { fo.viewers = fo.viewers.filter(e => e !== u.getEmail()); }, setSharing: () => {}, addEditor: e => fo.editors.push(e), addViewer: e => fo.viewers.push(e), getOwner: () => ({ getEmail: () => "aemporio6@gmail.com" }), getParents: () => iter([]), moveTo: () => {}, getId: () => "folder:" + name, _fo: fo }; return fo; };
  const data = mkFolder("MY TOOL – DATA"); data.editors = ["editor@x.com"]; data.viewers = ["viewer@x.com"];
  data.api.createFile("MYTOOL-DATA.json", JSON.stringify(seed), "application/json");
  const ctx = {
    DriveApp: { getFoldersByName: n => iter(Object.values(folders).filter(f => f.name === n).map(f => f.api)), getFileById: id => wrapFile(drive.files[id]), createFolder: n => mkFolder(n).api, getRootFolder: () => ({}), Access: {}, Permission: {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => drive.props[k] == null ? null : drive.props[k], setProperty: (k, v) => { drive.props[k] = v; } }) },
    CacheService: { getScriptCache: () => ({ get: k => drive.cache[k] || null, put: (k, v) => { drive.cache[k] = v; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    UrlFetchApp: { fetch: url => { const t = decodeURIComponent(url.split("access_token=")[1]); const u = tokens[t]; return { getResponseCode: () => u ? 200 : 400, getContentText: () => JSON.stringify(u ? { aud: u.aud || CID, email: u.email, email_verified: "true", expires_in: 3000 } : { error: "invalid" }) }; } },
    Utilities: { base64EncodeWebSafe: b => Buffer.from(b).toString("base64url"), computeDigest: (a, s) => [...require("crypto").createHash("sha256").update(s).digest()], DigestAlgorithm: { SHA_256: 1 }, formatDate: (d, tz, fmt) => fmt === "yyyy-MM" ? d.toISOString().slice(0, 7) : fmt === "yyyy-MM-dd" ? d.toISOString().slice(0, 10) : d.toISOString().slice(0, 16).replace(/[T:]/g, "-"), base64Decode: s => [...Buffer.from(s, "base64")], newBlob: (bytes, mime, name) => ({ bytes, mime, name }) },
    ContentService: { createTextOutput: s => ({ setMimeType: () => ({ text: s }) }), MimeType: { JSON: 1 } },
    Logger: { log: () => {} }, JSON, Number, String, Object, Array, Math, Date, Error, RegExp, encodeURIComponent, Buffer
  };
  ctx.DriveApp.createFile = undefined;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../../tools/gateway.gs"), "utf8"), ctx);
  return { call: req => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(req) } }).text), drive, folders, ctx };
}
module.exports = { makeGateway };
