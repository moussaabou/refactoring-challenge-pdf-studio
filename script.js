// PDF Studio v2 -- TODO: clean this up later!!
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
var G = { n: 0, busy: false, last: null, t: null }, LOG = [], tmp, d, i, j, r;
window.cnt = 0;

function init() { document.getElementById("cnt").innerText = "0 عملية"; G.t = null; }

// show file names
function sh(el, id) {
  var s = document.getElementById(id), l = el.files.length;
  if (l == 0) { s.innerText = "لم يتم الاختيار"; s.parentNode.className = "drop"; return; }
  s.innerText = l == 1 ? el.files[0].name : l + " ملفات محددة";
  s.parentNode.className = "drop has";
}

// toast
function tst(m, t) {
  var e = document.getElementById("toast");
  e.innerText = m; e.className = "show";
  setTimeout(function () { e.className = ""; }, 2500);
}

// download
function dl(data, name, type) {
  var u = URL.createObjectURL(new Blob([data], { type: type }));
  var a = document.createElement("a"); a.href = u; a.download = name; a.click();
}
// download (another one)
function dl2(blob, name) {
  var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}

// parse pages
function pp(t) {
  var o = [], p = t.split(",");
  for (i = 0; i < p.length; i++) {
    var q = p[i].split("-");
    var a = parseInt(q[0]), b = q[1] ? parseInt(q[1]) : a;
    for (j = a; j <= b; j++) o.push(j - 1);
  }
  return o;
}
// parse pages 2 (with max)
function pp2(t, m) {
  var o = [];
  t.split(",").forEach(function (x) {
    var q = x.trim().split("-"), a = Number(q[0]), b = q.length > 1 ? Number(q[1]) : a;
    for (var k = a; k <= b && k <= m; k++) if (k > 0 && o.indexOf(k - 1) < 0) o.push(k - 1);
  });
  return o.sort(function (a, b) { return a - b; });
}

function rd(f) { return f.arrayBuffer(); }
function dead(x) { return x * 2 + 1; }  // not used anywhere

// history
function hs(name, ok) {
  LOG.unshift({ name: name, ok: ok, time: new Date().toLocaleTimeString() });
  var h = "";
  for (var z = 0; z < LOG.length; z++) {
    h += "<li><span>" + LOG[z].name + "</span><span class='" + (LOG[z].ok ? "ok" : "bad") + "'>" + (LOG[z].ok ? "نجاح" : "فشل") + " · " + LOG[z].time + "</span></li>";
  }
  document.getElementById("hist").innerHTML = h;
  window.cnt++;
  document.getElementById("cnt").innerText = window.cnt + " عملية";
}

async function go(n) {
  if (G.busy) { tst("انتظر"); return; }
  G.busy = true;
  var b = document.getElementById("b" + n);
  b.disabled = true; b.innerText = "...";
  var nm = "";
  try {
    if (n == 1) {
      nm = "صور إلى PDF";
      var f = document.getElementById("f1").files;
      if (f.length == 0) throw new Error("اختر صور");
      d = await PDFLib.PDFDocument.create();
      for (i = 0; i < f.length; i++) {
        var by = new Uint8Array(await rd(f[i])), im;
        if (f[i].type == "image/jpeg") im = await d.embedJpg(by);
        else if (f[i].type == "image/png") im = await d.embedPng(by);
        else {
          var bm = await createImageBitmap(f[i]), c = document.createElement("canvas");
          c.width = bm.width; c.height = bm.height; c.getContext("2d").drawImage(bm, 0, 0);
          var bl = await new Promise(function (x) { c.toBlob(x, "image/png"); });
          im = await d.embedPng(new Uint8Array(await rd(bl)));
        }
        d.addPage([im.width, im.height]).drawImage(im, { x: 0, y: 0, width: im.width, height: im.height });
      }
      dl(await d.save(), "images.pdf", "application/pdf");
    } else if (n == 2) {
      nm = "PDF إلى صور";
      var f = document.getElementById("f2").files[0];
      if (!f) throw new Error("اختر ملف");
      var sc = document.getElementById("q2").value == "1" ? 1 : document.getElementById("q2").value == "2" ? 2 : 3.5;
      var doc = await pdfjsLib.getDocument({ data: await rd(f) }).promise, z = new JSZip();
      for (i = 1; i <= doc.numPages; i++) {
        var pg = await doc.getPage(i), vp = pg.getViewport({ scale: sc });
        var c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height;
        await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
        var bl = await new Promise(function (x) { c.toBlob(x, "image/png"); });
        z.file("page-" + i + ".png", bl);
        b.innerText = i + "/" + doc.numPages;
      }
      dl2(await z.generateAsync({ type: "blob" }), "pages.zip");
    } else if (n == 3) {
      nm = "حذف صفحات";
      var f = document.getElementById("f3").files[0], t = document.getElementById("t3").value;
      if (!f) throw new Error("اختر ملف");
      d = await PDFLib.PDFDocument.load(await rd(f));
      var l = pp(t);
      l.sort(function (a, b) { return b - a; });
      for (i = 0; i < l.length; i++) if (l[i] >= 0 && l[i] < d.getPageCount()) d.removePage(l[i]);
      dl(await d.save(), "edited.pdf", "application/pdf");
    } else if (n == 4) {
      nm = "إضافة صفحة";
      var f = document.getElementById("f4").files[0], f2 = document.getElementById("f5").files[0];
      if (!f) throw new Error("اختر ملف");
      d = await PDFLib.PDFDocument.load(await rd(f));
      var pos = parseInt(document.getElementById("t4").value);
      if (isNaN(pos) || pos < 0) pos = 0; if (pos > d.getPageCount()) pos = d.getPageCount();
      if (f2) {
        var s = await PDFLib.PDFDocument.load(await rd(f2)), cp = await d.copyPages(s, s.getPageIndices());
        cp.forEach(function (p, k) { d.insertPage(pos + k, p); });
      } else {
        var sz = d.getPage(0).getSize(); d.insertPage(pos, [sz.width, sz.height]);
      }
      dl(await d.save(), "edited.pdf", "application/pdf");
    } else if (n == 5) {
      nm = "دمج ملفات";
      var f = document.getElementById("f6").files;
      if (f.length < 2) throw new Error("اختر ملفين على الأقل");
      d = await PDFLib.PDFDocument.create();
      for (i = 0; i < f.length; i++) {
        var s = await PDFLib.PDFDocument.load(await rd(f[i]));
        var cp = await d.copyPages(s, s.getPageIndices());
        for (j = 0; j < cp.length; j++) d.addPage(cp[j]);
      }
      dl(await d.save(), "merged.pdf", "application/pdf");
    } else if (n == 6) {
      var f = document.getElementById("f7").files[0], a = document.getElementById("s7").value, t = document.getElementById("t7").value;
      if (!f) throw new Error("اختر ملف");
      d = await PDFLib.PDFDocument.load(await rd(f));
      var l = t == "" ? d.getPageIndices() : pp2(t, d.getPageCount());
      if (a == "x") {
        nm = "استخراج صفحات";
        var o = await PDFLib.PDFDocument.create(), cp = await o.copyPages(d, l);
        cp.forEach(function (p) { o.addPage(p); });
        dl(await o.save(), "extracted.pdf", "application/pdf");
      } else {
        nm = "تدوير صفحات";
        l.forEach(function (k) {
          var p = d.getPage(k); p.setRotation(PDFLib.degrees((p.getRotation().angle + Number(a)) % 360));
        });
        dl(await d.save(), "rotated.pdf", "application/pdf");
      }
    }
    hs(nm, true); tst("تم بنجاح ✔");
  } catch (e) {
    hs(nm || "عملية", false); tst("خطأ: " + e.message);
  }
  G.busy = false; b.disabled = false;
  b.innerText = ["", "تحويل", "تحويل", "حذف", "إضافة", "دمج", "تنفيذ"][n];
}
