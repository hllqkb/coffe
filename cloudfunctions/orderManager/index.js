// 订单管理云函数
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    switch (action) {
      case 'createOrder':
        return await createOrder(event, openid)
      case 'getOrders':
        return await getOrders(event, openid)
      case 'getOrderDetail':
        return await getOrderDetail(event, openid)
      case 'cancelOrder':
        return await cancelOrder(event, openid)
      case 'createPayment':
        return await createPayment(event, openid)
      case 'confirmOrder':
        return await confirmOrder(event, openid)
      case 'evaluateOrder':
        return await evaluateOrder(event, openid)
      default:
        return {
          success: false,
          message: '未知操作类型'
        }
    }
  } catch (error) {
    console.error('订单管理云函数错误:', error)
    return {
      success: false,
      message: error.message || '服务器错误'
    }
  }
}

// 创建订单
async function createOrder(event, openid) {
  const { products, address, totalAmount, remark } = event
  
  // 生成订单号
  const orderNumber = generateOrderNumber()
  
  // 验证商品库存和价格
  for (let product of products) {
    const productInfo = await getProductInfo(product.productId)
    if (!productInfo) {
      throw new Error(`商品 ${product.name} 不存在`)
    }
    
    if (productInfo.stock < product.quantity) {
      throw new Error(`商品 ${product.name} 库存不足`)
    }
    
    // 验证价格（防止前端篡改）
    if (productInfo.price !== product.price) {
      throw new Error(`商品 ${product.name} 价格已变更，请重新下单`)
    }
  }
  
  // 创建订单数据
  const orderData = {
    orderNumber,
    openid,
    products,
    address,
    totalAmount,
    remark: remark || '',
    status: 'pending', // 待付款
    createTime: Date.now(),
    updateTime: Date.now()
  }
  
  // 保存订单
  const orderRes = await db.collection('orders').add({
    data: orderData
  })
  
  // 扣减库存
  for (let product of products) {
    await db.collection('products').doc(product.productId).update({
      data: {
        stock: _.inc(-product.quantity),
        soldCount: _.inc(product.quantity)
      }
    })
  }
  
  return {
    success: true,
    data: {
      orderId: orderRes._id,
      orderNumber
    }
  }
}

// 获取订单列表
async function getOrders(event, openid) {
  const { status, page = 1, pageSize = 10 } = event
  
  let query = db.collection('orders').where({ openid })
  
  if (status && status !== 'all') {
    query = query.where({ status })
  }
  
  const res = await query
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  
  return {
    success: true,
    data: res.data
  }
}

// 获取订单详情
async function getOrderDetail(event, openid) {
  const { orderId } = event
  
  const res = await db.collection('orders').doc(orderId).get()
  
  if (!res.data || res.data.openid !== openid) {
    throw new Error('订单不存在或无权限访问')
  }
  
  return {
    success: true,
    data: res.data
  }
}

// 取消订单
async function cancelOrder(event, openid) {
  const { orderId } = event
  
  // 获取订单信息
  const orderRes = await db.collection('orders').doc(orderId).get()
  
  if (!orderRes.data || orderRes.data.openid !== openid) {
    throw new Error('订单不存在或无权限操作')
  }
  
  const order = orderRes.data
  
  if (order.status !== 'pending') {
    throw new Error('只能取消待付款订单')
  }
  
  // 更新订单状态
  await db.collection('orders').doc(orderId).update({
    data: {
      status: 'cancelled',
      cancelTime: Date.now(),
      updateTime: Date.now()
    }
  })
  
  // 恢复库存
  for (let product of order.products) {
    await db.collection('products').doc(product.productId).update({
      data: {
        stock: _.inc(product.quantity),
        soldCount: _.inc(-product.quantity)
      }
    })
  }
  
  return {
    success: true,
    message: '订单已取消'
  }
}

// 创建支付
async function createPayment(event, openid) {
  const { orderId } = event
  
  // 获取订单信息
  const orderRes = await db.collection('orders').doc(orderId).get()
  
  if (!orderRes.data || orderRes.data.openid !== openid) {
    throw new Error('订单不存在或无权限操作')
  }
  
  const order = orderRes.data
  
  if (order.status !== 'pending') {
    throw new Error('订单状态不正确')
  }
  
  // 这里应该调用微信支付API
  // 由于是演示，直接模拟支付成功
  await db.collection('orders').doc(orderId).update({
    data: {
      status: 'paid',
      payTime: Date.now(),
      updateTime: Date.now()
    }
  })
  
  // 模拟支付参数
  const paymentParams = {
    timeStamp: String(Date.now()),
    nonceStr: generateNonceStr(),
    package: `prepay_id=${generatePrepayId()}`,
    signType: 'MD5',
    paySign: 'mock_pay_sign'
  }
  
  return {
    success: true,
    paymentParams
  }
}

// 确认收货
async function confirmOrder(event, openid) {
  const { orderId } = event
  
  // 获取订单信息
  const orderRes = await db.collection('orders').doc(orderId).get()
  
  if (!orderRes.data || orderRes.data.openid !== openid) {
    throw new Error('订单不存在或无权限操作')
  }
  
  const order = orderRes.data
  
  if (order.status !== 'shipped') {
    throw new Error('只能确认已发货的订单')
  }
  
  // 更新订单状态
  await db.collection('orders').doc(orderId).update({
    data: {
      status: 'delivered',
      deliverTime: Date.now(),
      updateTime: Date.now()
    }
  })
  
  return {
    success: true,
    message: '确认收货成功'
  }
}

// 评价订单
async function evaluateOrder(event, openid) {
  const { orderId, rating, comment, images } = event
  
  // 获取订单信息
  const orderRes = await db.collection('orders').doc(orderId).get()
  
  if (!orderRes.data || orderRes.data.openid !== openid) {
    throw new Error('订单不存在或无权限操作')
  }
  
  const order = orderRes.data
  
  if (order.status !== 'delivered') {
    throw new Error('只能评价已送达的订单')
  }
  
  // 保存评价
  const evaluationData = {
    orderId,
    openid,
    rating,
    comment: comment || '',
    images: images || [],
    createTime: Date.now()
  }
  
  await db.collection('order_evaluations').add({
    data: evaluationData
  })
  
  // 更新订单状态
  await db.collection('orders').doc(orderId).update({
    data: {
      status: 'completed',
      evaluated: true,
      evaluateTime: Date.now(),
      updateTime: Date.now()
    }
  })
  
  return {
    success: true,
    message: '评价成功'
  }
}

// 获取商品信息
async function getProductInfo(productId) {
  try {
    const res = await db.collection('products').doc(productId).get()
    return res.data
  } catch (error) {
    return null
  }
}

// 生成订单号
function generateOrderNumber() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  const second = String(now.getSeconds()).padStart(2, '0')
  const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
  
  return `${year}${month}${day}${hour}${minute}${second}${random}`
}

// 生成随机字符串
function generateNonceStr() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// 生成预支付ID
function generatePrepayId() {
  return 'wx' + Date.now() + Math.floor(Math.random() * 10000)
}