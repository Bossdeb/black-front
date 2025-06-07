const express = require('express')
const router = express.Router()
const auth = require('../middleware/auth')
const Stock = require('../models/Stock')
const StockHistory = require('../models/StockHistory')

// ... existing routes ...

// Withdraw stock
router.post('/withdraw/:id', auth, async (req, res) => {
  try {
    console.log('Withdraw request:', {
      stockId: req.params.id,
      quantity: req.body.quantity,
      reason: req.body.reason,
      userId: req.user._id
    })

    // Validate stock ID
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'รหัสสินค้าไม่ถูกต้อง' })
    }

    const stock = await Stock.findById(req.params.id)
    if (!stock) {
      return res.status(404).json({ message: 'ไม่พบสินค้า' })
    }

    const { quantity, reason } = req.body

    // Validate request body
    if (!quantity || !reason) {
      return res.status(400).json({ 
        message: 'กรุณาระบุจำนวนและเหตุผล',
        details: {
          quantity: !quantity ? 'กรุณาระบุจำนวน' : null,
          reason: !reason ? 'กรุณาระบุเหตุผล' : null
        }
      })
    }

    if (isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ message: 'จำนวนต้องเป็นตัวเลขและมากกว่า 0' })
    }

    if (stock.quantity < quantity) {
      return res.status(400).json({ 
        message: 'จำนวนสินค้าไม่เพียงพอ',
        available: stock.quantity,
        requested: quantity
      })
    }

    // Start a session for transaction
    const session = await Stock.startSession()
    session.startTransaction()

    try {
      // Update stock quantity
      stock.quantity -= quantity
      await stock.save({ session })

      // Create withdrawal history
      const history = new StockHistory({
        stock: stock._id,
        quantity,
        reason,
        type: 'withdraw',
        user: req.user._id
      })
      await history.save({ session })

      // Commit the transaction
      await session.commitTransaction()
      session.endSession()

      console.log('Withdrawal successful:', {
        stockId: stock._id,
        newQuantity: stock.quantity,
        historyId: history._id
      })

      res.json(stock)
    } catch (error) {
      // If an error occurred, abort the transaction
      await session.abortTransaction()
      session.endSession()
      throw error
    }
  } catch (error) {
    console.error('Error withdrawing stock:', error)
    res.status(500).json({ 
      message: 'เกิดข้อผิดพลาดในการเบิกสินค้า',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Get stock history
router.get('/history', auth, async (req, res) => {
  try {
    const history = await StockHistory.find()
      .populate('stock')
      .populate('user', 'name')
      .sort({ createdAt: -1 })
    res.json(history)
  } catch (error) {
    console.error('Error fetching stock history:', error)
    res.status(500).json({ 
      message: 'เกิดข้อผิดพลาดในการดึงประวัติ',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

module.exports = router 