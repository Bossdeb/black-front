const mongoose = require('mongoose')

const stockHistorySchema = new mongoose.Schema({
  stock: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stock',
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['withdraw', 'add'],
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'stockhistories'
})

stockHistorySchema.index({ user: 1, createdAt: -1 })
stockHistorySchema.index({ stock: 1, createdAt: -1 })

module.exports = mongoose.model('StockHistory', stockHistorySchema) 