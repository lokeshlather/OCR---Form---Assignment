//Utilities
const $ = (sel) => document.querySelector(sel);

// Grab progress/status elements once so I can reuse them
const statusEl = $("#status");
const barEl = $("#bar");

// Keep track of the current image blob (after preprocessing)
let currentImageBlob = null; 
let ocrText = ""; // latest OCR result text

// Update status bar text + progress bar width
function setStatus(msg, p) {
  statusEl.textContent = msg;
  if (typeof p === "number") barEl.style.width = Math.round(p * 100) + "%";
}

// Utility: Convert base64 DataURL to Blob (Tesseract works better with blobs)
function dataURLToBlob(dataURL) {
  const parts = dataURL.split(",");
  const mime = parts[0].match(/:(.*?);/)[1];
  const bin = atob(parts[1]);
  const len = bin.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: mime });
}

// Image Preprocessing
// Resize, grayscale, binarize, sharpen – just some basic tricks to make OCR more reliable
async function preprocessImage(file) {
  const maxW = parseInt($("#maxW").value || "1600", 10);
  const toGray = $("#toGray").checked;
  const binarize = $("#binarize").checked;
  const sharpen = $("#sharpen").checked;

  const img = new Image();
  img.decoding = "async";
  img.src = URL.createObjectURL(file);
  await img.decode();

  // Scale down if image is too wide
  const scale = Math.min(1, maxW / img.naturalWidth);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  ctx.drawImage(img, 0, 0, w, h);
  let imgData = ctx.getImageData(0, 0, w, h);
  let d = imgData.data;

  // Convert to grayscale (classic luminance formula)
  if (toGray) {
    for (let i = 0; i < d.length; i += 4) {
      const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = y;
    }
  }

  // Simple binarization using Otsu-like thresholding
  if (binarize) {
    let hist = new Array(256).fill(0);

    for (let i = 0; i < d.length; i += 4) {
      hist[d[i]]++;
    }

    let total = w * h;
    let sum = 0;

    for (let t = 0; t < 256; t++){
      sum += t * hist[t];
    }

    let sumB = 0,
      wB = 0,
      max = 0,
      threshold = 127;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];

      if (!wB) continue;
      let wF = total - wB;
      
      if (!wF) break;
      
      sumB += t * hist[t];
      
      let mB = sumB / wB;
      let mF = (sum - sumB) / wF;
      let between = wB * wF * (mB - mF) * (mB - mF);
      
      if (between > max) {
        max = between;
        threshold = t;
      }
    }


    for (let i = 0; i < d.length; i += 4) {
      const v = d[i] > threshold ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  }

  // Optional sharpening (unsharp mask-ish kernel)
  if (sharpen) {
    const copy = new Uint8ClampedArray(d);
    const w4 = w * 4;
    const k = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        for (let c = 0; c < 3; c++) {
          let i = (y * w + x) * 4 + c;
          let val = 0, idx = 0;
          
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              val += copy[((y + ky) * w + (x + kx)) * 4 + c] * k[idx++];
            }
          }

          d[i] = Math.max(0, Math.min(255, val));
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Save processed image preview + blob
  const dataUrl = canvas.toDataURL("image/png");
  const blob = dataURLToBlob(dataUrl);
  $("#preview").src = dataUrl;
  return blob;
}

// OCR (Tesseract.js)
async function runOCR(blob) {
  setStatus("Starting OCR…", 0);

  const worker = await Tesseract.createWorker("eng", 1, {
    logger: (m) => {
      if (m.status && m.progress != null) {
        setStatus(`${m.status}…`, m.progress);
      }
    },
  });

  const { data } = await worker.recognize(blob, {
    tessedit_char_whitelist:
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-:/.,() ",
  });

  await worker.terminate();
  setStatus("OCR complete", 1);
  return data.text || "";
}

// ---------- Field Extraction ----------
// Config for known doc types. Can add more patterns later.
const FIELD_CONFIG = {
  die_repair_request: [
    {
      key: "part_name",
      label: "Part Name",
      pattern: /part\s*name\s*[:\-]?\s*(.+)/i,
    },
    {
      key: "part_no",
      label: "Part No",
      pattern: /part\s*no\.?\s*[:\-]?\s*([A-Za-z0-9\-\/]+)/i,
    },
    { key: "model", label: "Model", pattern: /model\s*[:\-]?\s*(.+)/i },
    {
      key: "issued_by",
      label: "Issued By",
      pattern: /(issued\s*by|issued\s*by\.)\s*[:\-]?\s*(.+)/i,
      group: 2,
    },
    {
      key: "date",
      label: "Date",
      pattern:
        /\bdate\b\s*[:\-]?\s*([0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{2,4})/i,
    },
    {
      key: "time",
      label: "Time",
      pattern:
        /\btime\b\s*[:\-]?\s*([0-9]{1,2}[:.][0-9]{2}\s*(?:am|pm|AM|PM|hrs|HRS)?)/,
    },
    {
      key: "completed_date",
      label: "Completed Date",
      pattern:
        /(completed\s*date)\s*[:\-]?\s*([0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{2,4})/i,
      group: 2,
    },
    {
      key: "verified_by",
      label: "Verified By",
      pattern: /(verified\s*by)\s*[:\-]?\s*(.+)/i,
      group: 2,
    },
    {
      key: "stage",
      label: "Stage",
      pattern: /\bstage\b\s*[:\-]?\s*([A-Za-z0-9]+)/i,
    },
    {
      key: "point",
      label: "Point",
      pattern: /\bpoint\b\s*[:\-]?\s*(.+)/i,
    },
    {
      key: "problem_reported",
      label: "Problem Reported",
      pattern: /(problem\s*reported)\s*[:\-]?\s*(.+)/i,
      group: 2,
    },
  ],
  generic: [{ key: "text", label: "All Text", pattern: /(.*)/s }],
};

// Extract fields using regex above
function extractFields(text, docType) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const raw = lines.join("\n");

  const config = FIELD_CONFIG[docType] || FIELD_CONFIG.generic;
  const out = {};

  config.forEach((def) => {
    const src = raw; // search all text (multi-line)
    const m = src.match(def.pattern);
    if (m) {
      out[def.key] = (def.group ? m[def.group] : m[1] || m[0]).trim();
    }
  });

  // Cleanup a bit
  if (out.part_name) out.part_name = out.part_name.replace(/\s{2,}/g, " ");
  if (out.time) out.time = out.time.replace(/\s+/g, "");

  return out;
}

// Render extracted fields into editable inputs
function renderFields(fields) {
  const container = $("#fields");
  container.innerHTML = "";

  const detected = Object.keys(fields);
  const defaults = FIELD_CONFIG[$("#docType").value];

  const makeField = (key, label, val = "") => {
    const wrapper = document.createElement("div");
    wrapper.className = "kv";
    const lab = document.createElement("label");
    lab.textContent = label;
    lab.htmlFor = key;
    const input = document.createElement("input");
    input.type = "text";
    input.id = key;
    input.value = val || "";
    wrapper.appendChild(lab);
    wrapper.appendChild(input);
    container.appendChild(wrapper);
  };

  // Render expected fields
  defaults.forEach((def) => {
    if (def.key === "text") return;
    makeField(def.key, def.label, fields[def.key] || "");
  });

  // Fallback: show raw OCR if doc type is generic
  if ($("#docType").value === "generic" || !detected.length) {
    const wrap = document.createElement("div");
    wrap.className = "grid-1";
    const lab = document.createElement("label");
    lab.textContent = "Raw OCR Text";
    const ta = document.createElement("textarea");
    ta.id = "rawText";
    ta.rows = 10;
    ta.value = ocrText;
    wrap.appendChild(lab);
    wrap.appendChild(ta);
    container.appendChild(wrap);
  }

  $("#submitBtn").disabled = false;
}

// Collect payload for API submission
function collectPayload() {
  const docType = $("#docType").value;
  const config = FIELD_CONFIG[docType];
  const payload = { docType, fields: {} };
  config.forEach((def) => {
    if (def.key === "text") return;
    const el = document.getElementById(def.key);
    if (el) payload.fields[def.key] = el.value.trim();
  });

  payload.raw_ocr_text = ocrText;
  return payload;
}

// Submit structured OCR result to API
async function submitToApi() {
  const url = $("#apiUrl").value.trim();
  const payload = collectPayload();
  try {
    setStatus("Submitting…");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res
      .json()
      .catch(() => ({ ok: res.ok, status: res.status }));
    if (res.ok) {
      alert("✅ Submitted successfully!");
      console.log("Full API response:", json);
    } else {
      alert("❌ Error submitting: " + res.status);
      console.error("Full API response:", json);
    }
  } catch (err) {
    console.error(err);
    setStatus("Network/Fetch error");
    alert("Failed to submit to API. Check console for details.");
  }
}

// Events
// File pickers & drag/drop setup
const fileInput = $("#fileInput");
const pickBtn = $("#pickBtn");
const drop = $("#drop");

pickBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async (e) => {
  if (!e.target.files || !e.target.files[0]) return;
  setStatus("Loaded file");
  currentImageBlob = await preprocessImage(e.target.files[0]);
  $("#ocrBtn").disabled = false;
});

["dragenter", "dragover"].forEach((ev) =>
  drop.addEventListener(ev, (e) => {
    e.preventDefault();
    drop.classList.add("dragover");
  })
);
["dragleave", "drop"].forEach((ev) =>
  drop.addEventListener(ev, (e) => {
    e.preventDefault();
    drop.classList.remove("dragover");
  })
);
drop.addEventListener("drop", async (e) => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) {
    setStatus("Loaded file");
    currentImageBlob = await preprocessImage(file);
    $("#ocrBtn").disabled = false;
  }
});

// Buttons for preprocess, OCR, submit, reset
$("#preprocessBtn").addEventListener("click", async () => {
  if (!fileInput.files || !fileInput.files[0]) {
    alert("Choose or drop an image first.");
    return;
  }
  currentImageBlob = await preprocessImage(fileInput.files[0]);
});

$("#ocrBtn").addEventListener("click", async () => {
  if (!currentImageBlob) {
    alert("Load and preprocess an image first.");
    return;
  }
  $("#ocrBtn").disabled = true;
  ocrText = await runOCR(currentImageBlob);
  const docType = $("#docType").value;
  const fields = extractFields(ocrText, docType);
  renderFields(fields);
});

$("#submitBtn").addEventListener("click", submitToApi);
$("#resetBtn").addEventListener("click", () => {
  window.location.reload();
});

(async function tryLoadSample() {
  try {
    const res = await fetch("sample.jpg");
    if (res.ok) {
      const blob = await res.blob();
      setStatus("Loaded sample image");
      currentImageBlob = await preprocessImage(blob);
      $("#ocrBtn").disabled = false;
    }
  } catch (e) {
    //ignore if sample not avalaible
  }
})();