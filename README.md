# 📝 OCR Form Extraction Web App  

This project is a **web-based tool** that allows users to:  
1. 📸 Upload or capture a photo of a form.  
2. 🔍 Preprocess the image (resize, grayscale, binarize, sharpen).  
3. 🖥️ Send the image to a **Node.js backend**, which forwards it to the **OCR.Space API**.  
4. ✏️ Automatically extract structured fields (e.g., Part No, Model, Date) using regex.  
5. 👨‍💻 Review and correct the extracted data in an editable form.  
6. 📤 Submit the cleaned data to any API endpoint.  

---

## 🚀 Features
- Upload or drag-and-drop form images.  
- Image preprocessing for improved OCR accuracy.  
- Server-side OCR via [OCR.Space](https://ocr.space/ocrapi).  
- Regex-based field extraction (with manual corrections).  
- JSON payload submission to any API endpoint.  
- Modern dark UI built with **HTML, CSS, and vanilla JS**.  

---

## 🛠️ Tech Stack
- **Frontend:** HTML5, CSS3, Vanilla JavaScript  
- **Backend:** Node.js + Express + Multer + node-fetch  
- **OCR API:** [OCR.Space](https://ocr.space/ocrapi)  
- **Environment Config:** dotenv  
- **Version Control:** Git + GitHub  

---

## 📂 Project Structure
```
├── app.js           # Frontend JS (preprocessing, OCR request, field extraction)
├── index.html       # Main UI
├── style.css        # Styling
├── server.js        # Express backend (for OCR.Space API)
├── uploads/         # Temporary upload folder (gitignored)
├── .env.example     # Example environment variables
├── .gitignore       # Git ignore rules
└── README.md        # Documentation
```

---

## ⚡ How to Run

### 1. Clone this repo
```bash
git clone https://github.com/YOUR-USERNAME/ocr-form-assignment.git
cd ocr-form-assignment
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
- Copy `.env.example` → `.env`
- Add your [OCR.Space API key](https://ocr.space/ocrapi):  
```env
OCR_API_KEY=your_real_api_key_here
```

### 4. Start the backend server
```bash
node server.js
```
Server will run at `http://localhost:5000`.

### 5. Open the frontend
Open `index.html` in your browser.  

1. Upload a form image.  
2. Click **Run OCR** → review/edit extracted fields.  
3. Click **Submit** to send structured JSON to your chosen API endpoint.  

---

## 🔮 Future Improvements
- Better regex for OCR error tolerance (e.g. common misreads).  
- Auto-rotate & auto-crop support.  
- Export results as JSON/CSV/PDF.  
- Deploy backend to cloud (e.g., Render/Heroku).  

---

## 📧 Contact
👤 Lokesh  
🔗 [GitHub](https://github.com/lokeshlather)  
📩 lokeshlather5110@gmail.com  