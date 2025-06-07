const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Stock = require('../models/Stock');
const auth = require('../middleware/auth');
const StockHistory = require('../models/StockHistory');
const User = require('../models/User');

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5000000 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp|avif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

// Create stock item
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const stock = new Stock({
      ...req.body,
      sku: req.body.sku,
      image: req.file ? `/uploads/${req.file.filename}` : null,
      createdBy: req.userId
    });
    await stock.save();
    res.status(201).json(stock);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get stock history
router.get('/history', auth, async (req, res) => {
  console.log('=== Stock History Route Start ===');
  console.log('Request headers:', req.headers);
  console.log('User ID from auth:', req.userId);
  console.log('Request path:', req.path);
  console.log('Request method:', req.method);

  try {
    if (!req.userId) {
      console.error('No user ID found in request');
      return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบ' });
    }

    console.log('Fetching all history records');

    // Then fetch the history
    const history = await StockHistory.find()
      .populate({
        path: 'stock',
        select: 'sku category quantity unit price image',
        model: 'Stock'
      })
      .populate({
        path: 'user',
        select: 'username name email',
        model: 'User'
      })
      .sort({ createdAt: -1 });

    console.log('Found history records:', history.length);
    console.log('Sample history record:', history[0] ? {
      id: history[0]._id,
      user: history[0].user,
      stock: history[0].stock,
      quantity: history[0].quantity,
      reason: history[0].reason
    } : 'No records');
    console.log('=== Stock History Route End ===');

    // Return empty array if no records found
    res.json(history || []);
  } catch (error) {
    console.error('=== Stock History Error ===');
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      userId: req.userId
    });
    console.error('=== End Error Log ===');
    
    // Check for specific error types
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'รหัสผู้ใช้ไม่ถูกต้อง',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'ข้อมูลไม่ถูกต้อง',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    res.status(500).json({ 
      message: 'เกิดข้อผิดพลาดในการดึงประวัติ',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get all stock items
router.get('/', auth, async (req, res) => {
  try {
    const stock = await Stock.find();
    res.json(stock);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single stock item
router.get('/:id', auth, async (req, res) => {
  console.log('here');
  console.log(req.params);
  
  try {
    const stock = await Stock.findOne({ _id: req.params.id});
    if (!stock) {
      
      return res.status(404).json({ message: 'Stock item not found' });
    }
    console.log('Fetched stock item:', {
      id: stock._id,
      sku: stock.sku,
      category: stock.category,
      quantity: stock.quantity,
      price: stock.price,
      image: stock.image
    });
    res.json(stock);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update stock item
router.put('/:id', auth, upload.single('image'), async (req, res) => {
  try {
    const stock = await Stock.findOne({ _id: req.params.id});
    if (!stock) {
      return res.status(404).json({ message: 'Stock item not found' });
    }

    // Create updates object with proper type conversion
    const updates = {
      productCode: req.body.productCode,
      sku: req.body.sku,
      description: req.body.description,
      category: req.body.category,
      quantity: Number(req.body.quantity),
      price: Number(req.body.price)
    };

    // Only update image if a new one was uploaded
    if (req.file) {
      updates.image = `/uploads/${req.file.filename}`;
    }

    // Update the stock document
    Object.assign(stock, updates);
    await stock.save();

    // Send back the updated stock
    res.json(stock);
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(400).json({ 
      message: 'Error updating stock',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete stock item
router.delete('/:id', auth, async (req, res) => {
  try {
    const stock = await Stock.findOneAndDelete({ _id: req.params.id});
    if (!stock) {
      return res.status(404).json({ message: 'Stock item not found' });
    }
    res.json({ message: 'Stock item deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Withdraw stock
router.post('/withdraw/:id', auth, async (req, res) => {
  try {
    console.log('Withdraw request:', {
      stockId: req.params.id,
      quantity: req.body.quantity,
      reason: req.body.reason,
      userId: req.userId
    });

    // Validate stock ID
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'รหัสสินค้าไม่ถูกต้อง' });
    }

    const stock = await Stock.findById(req.params.id);
    if (!stock) {
      return res.status(404).json({ message: 'ไม่พบสินค้า' });
    }

    const { quantity, reason } = req.body;

    // Validate request body
    if (!quantity || !reason) {
      return res.status(400).json({ 
        message: 'กรุณาระบุจำนวนและเหตุผล',
        details: {
          quantity: !quantity ? 'กรุณาระบุจำนวน' : null,
          reason: !reason ? 'กรุณาระบุเหตุผล' : null
        }
      });
    }

    if (isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ message: 'จำนวนต้องเป็นตัวเลขและมากกว่า 0' });
    }

    if (stock.quantity < quantity) {
      return res.status(400).json({ 
        message: 'จำนวนสินค้าไม่เพียงพอ',
        available: stock.quantity,
        requested: quantity
      });
    }

    try {
      // Update stock quantity
      stock.quantity -= quantity;
      await stock.save();

      // Create withdrawal history
      const history = new StockHistory({
        stock: stock._id,
        quantity,
        reason,
        type: 'withdraw',
        user: req.userId
      });
      await history.save();

      console.log('Withdrawal successful:', {
        stockId: stock._id,
        newQuantity: stock.quantity,
        historyId: history._id
      });

      res.json(stock);
    } catch (error) {
      // If there's an error, try to revert the stock quantity
      if (stock) {
        stock.quantity += quantity;
        await stock.save();
      }
      throw error;
    }
  } catch (error) {
    console.error('Error withdrawing stock:', error);
    res.status(500).json({ 
      message: 'เกิดข้อผิดพลาดในการเบิกสินค้า',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get all stock history records
router.get('/history/all', auth, async (req, res) => {
  try {
    console.log('Fetching all stock history records');
    const history = await StockHistory.find()
      .populate('stock', 'sku category')
      .populate('user', 'username')
      .sort({ createdAt: -1 });
    
    console.log('Found history records:', history.length);
    console.log('Sample record:', history[0]);
    
    res.json(history);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 