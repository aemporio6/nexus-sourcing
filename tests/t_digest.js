/* Morning email (17 Nov 2026): tools/daily-backup.gs morningDigest – one email per person, only their things. node tests/t_digest.js */
const vm=require("vm"),fs=require("fs");const ctx={Utilities:{formatDate:d=>d.toISOString().slice(0,10)},MailApp:{sendEmail(){}},Logger:{log(){}},DriveApp:{},JSON,Date,Object,Math,String,encodeURIComponent};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname+"/../tools/daily-backup.gs","utf8"),ctx);
let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};const day="2026-11-18";
const j={data:{setup:{main:{roles:{finance:{approve:true,bank:true},va:{create:true}},users:[{uid:"fin@x.com",name:"Fin",role:"finance"},{uid:"va@x.com",name:"VA",role:"va"},{uid:"quiet@x.com",name:"Q",role:"va"},{uid:"off@x.com",name:"Off",role:"finance",digest:false}],
 digestFeed:{day:"2026-11-18",items:[{t:"PO-26-0065 · 50% overdue",sev:3,col:"purchases",id:"PO-26-0065"},{t:"small thing",sev:1}]}}},
 tasks:{"TA-1":{no:"TA-1",title:"Call Joyce",who:"va@x.com",due:"2026-11-17",status:"todo",ref:"PO-26-0065"},"TA-2":{no:"TA-2",title:"Done one",who:"va@x.com",due:"2026-11-17",status:"done"},"TA-3":{no:"TA-3",title:"Later",who:"va@x.com",due:"2026-12-30",status:"todo"}},
 payments:{"PAY-1":{no:"PAY-1",amount:30000,cur:"RMB",gbp:3363,needsApproval:true,approved:false,status:"pending",requestedBy:"fin@x.com"},"PAY-2":{no:"PAY-2",amount:20000,cur:"RMB",gbp:2242,needsApproval:true,approved:false,status:"pending",requestedBy:"va@x.com"}},
 parties:{"SUP-1":{code:"SUP-1",name:"Joyce",beneficiaryPending:{text:"enc:v1:x",by:"fin@x.com"}}},shipments:{"SH-1":{no:"SH-1",eta:"2026-11-19",status:"in_transit",ctn:98}},receipts:{"RC-1":{no:"RC-1",landedPending:{lines:[]}}}}};
const m=ctx.morningDigest(j,day,true);const by=e=>m.find(x=>x.to===e);
ok(by("va@x.com")&&/Call Joyce/.test(by("va@x.com").body)&&/LATE/.test(by("va@x.com").body)&&!/Done one|Later/.test(by("va@x.com").body),"VA: only their late / due task");
ok(!/approval/i.test(by("va@x.com").body.split("To stop")[0]),"VA: no approvals, no money alerts");
ok(by("fin@x.com")&&/PAY-2/.test(by("fin@x.com").body)&&!/PAY-1/.test(by("fin@x.com").body),"Finance: approvals waiting, but not their own request");
ok(!/Joyce — call/.test(by("fin@x.com").body),"Finance: not their own bank-detail change");
ok(/SH-1/.test(by("fin@x.com").body)&&/RC-1/.test(by("fin@x.com").body)&&/50% overdue/.test(by("fin@x.com").body)&&!/small thing/.test(by("fin@x.com").body),"Finance: arriving, landed changed, serious alerts only");
ok(by("aemporio6@gmail.com")&&/PAY-1/.test(by("aemporio6@gmail.com").body)&&/Joyce — call/.test(by("aemporio6@gmail.com").body),"Owner: everything waiting");
ok(!by("quiet@x.com"),"nothing waiting → no email");ok(!by("maashiq@gmail.com")&&!by("maashiq123@gmail.com"),"owner gets ONE email (not one per admin account)");ok(!by("off@x.com"),"morning email off → none");
ok(/#\/doc\/payments\/PAY-2/.test(by("fin@x.com").body),"each line links to the record");
console.log(by("fin@x.com").subject);process.exit(fails?1:0);
