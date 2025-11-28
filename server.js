const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Load environment variables if available (simulated for this environment)
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ddr_db';

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// --- MONGODB CONNECTION ---
// Note: Ensure you have a running MongoDB instance and MONGODB_URI is set.
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// --- CLOUDINARY CONFIG ---
// Note: Ensure CLOUDINARY_CLOUD_NAME, API_KEY, API_SECRET are set.
if (process.env.CLOUDINARY_CLOUD_NAME) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
}

// Multer Storage for Cloudinary
const storage = process.env.CLOUDINARY_CLOUD_NAME ? new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'ddr_uploads',
        allowed_formats: ['jpg', 'png', 'jpeg', 'mp4'],
    },
}) : multer.diskStorage({}); // Fallback if no cloudinary

const upload = multer({ storage: storage });

// --- SCHEMAS ---
const transformOptions = {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) { delete ret._id; }
};

const SettingsSchema = new mongoose.Schema({
    maintenanceMode: { type: Boolean, default: false },
    flashMessage: { type: String, default: 'Bienvenue sur le site officiel de la DDR.' },
    flashActive: { type: Boolean, default: false }
}, { toJSON: transformOptions });
const Settings = mongoose.model('Settings', SettingsSchema);

const CampaignSchema = new mongoose.Schema({
    title: { type: String, default: 'Projet École' },
    description: String,
    targetAmount: { type: Number, default: 50000000 },
    currentAmount: { type: Number, default: 0 },
    imageUrl: String,
    trustIndicators: [{ icon: String, title: String, text: String }]
}, { toJSON: transformOptions });
const Campaign = mongoose.model('Campaign', CampaignSchema);

const NewsSchema = new mongoose.Schema({
    title: String,
    content: String,
    imageUrl: String,
    category: String,
    createdAt: String,
    author: String,
    tags: [String]
}, { toJSON: transformOptions });
const News = mongoose.model('News', NewsSchema);

const DebateSchema = new mongoose.Schema({
    title: String,
    description: String,
    videoUrl: String,
    date: String,
    speaker: String,
    location: String,
    thumbnailUrl: String
}, { toJSON: transformOptions });
const Debate = mongoose.model('Debate', DebateSchema);

const ConversionSchema = new mongoose.Schema({
    name: String,
    story: String,
    date: String,
    mediaUrl: String
}, { toJSON: transformOptions });
const Conversion = mongoose.model('Conversion', ConversionSchema);

const AppointmentSchema = new mongoose.Schema({
    type: { type: String, default: 'contact' },
    name: String,
    phone: String,
    subject: String,
    opponentName: String,
    topic: String,
    requestedDate: String,
    message: String,
    status: { type: String, default: 'pending' },
    createdAt: String
}, { toJSON: transformOptions });
const Appointment = mongoose.model('Appointment', AppointmentSchema);

const DonationSchema = new mongoose.Schema({
    amount: Number,
    donorName: String,
    donorPhone: String,
    isAnonymous: Boolean,
    method: String,
    status: String,
    transactionId: String,
    createdAt: String
}, { toJSON: transformOptions });
const Donation = mongoose.model('Donation', DonationSchema);

// --- API ROUTES ---

// Upload Route
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (req.file) {
        // If Cloudinary is used, path is the secure url
        res.json({ url: req.file.path || req.file.secure_url });
    } else {
        res.status(400).json({ error: 'No file uploaded' });
    }
});

// Settings (Singleton)
app.get('/api/settings', async (req, res) => {
    try {
        let s = await Settings.findOne();
        if (!s) { s = new Settings(); await s.save(); }
        res.json(s);
    } catch(e) { res.status(500).json(e); }
});
app.put('/api/settings', async (req, res) => {
    try {
        const s = await Settings.findOneAndUpdate({}, req.body, { new: true, upsert: true });
        res.json(s);
    } catch(e) { res.status(500).json(e); }
});

// Campaign (Singleton)
app.get('/api/campaign', async (req, res) => {
    try {
        let c = await Campaign.findOne();
        if (!c) {
            c = new Campaign({ 
                title: 'Grande Mosquée & École "Science & Foi"', 
                currentAmount: 12450000, 
                targetAmount: 50000000,
                imageUrl: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b',
                trustIndicators: [
                    { icon: '🧱', title: 'Matériaux', text: 'Ciment et briques' },
                    { icon: '👷', title: 'Ouvriers', text: 'Salaire des maçons' },
                    { icon: '📚', title: 'Futur', text: 'Investissement Sadaqa' }
                ]
            }); 
            await c.save(); 
        }
        res.json(c);
    } catch(e) { res.status(500).json(e); }
});
app.put('/api/campaign', async (req, res) => {
    try {
        const c = await Campaign.findOneAndUpdate({}, req.body, { new: true, upsert: true });
        res.json(c);
    } catch(e) { res.status(500).json(e); }
});

// Generic CRUD
const createCrud = (Model, route) => {
    app.get(route, async (req, res) => {
        try { const items = await Model.find().sort({ _id: -1 }); res.json(items); } catch(e) { res.status(500).json(e); }
    });
    app.post(route, async (req, res) => {
        try { const item = new Model(req.body); await item.save(); res.json(item); } catch(e) { res.status(500).json(e); }
    });
    app.put(`${route}/:id`, async (req, res) => {
        try { const item = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true }); res.json(item); } catch(e) { res.status(500).json(e); }
    });
    app.delete(`${route}/:id`, async (req, res) => {
        try { await Model.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch(e) { res.status(500).json(e); }
    });
};

createCrud(News, '/api/news');
createCrud(Debate, '/api/debates');
createCrud(Conversion, '/api/conversions');
createCrud(Appointment, '/api/appointments');
createCrud(Donation, '/api/donations');

// --- SPA FALLBACK ---
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  
  fs.readFile(indexPath, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error loading index.html');
    }
    const apiKey = process.env.API_KEY || '';
    const result = data.replace("API_KEY: ''", `API_KEY: '${apiKey}'`);
    res.send(result);
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
