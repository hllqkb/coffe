// 订单页面
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    // 订单状态筛选
    statusTabs: [
      { id: 'all', name: '全部', count: 0 },
      { id: 'pending', name: '待付款', count: 0 },
      { id: 'paid', name: '已付款', count: 0 },
      { id: 'shipped', name: '已发货', count: 0 },
      { id: 'delivered', name: '已送达', count: 0 },
      { id: 'completed', name: '已完成', count: 0 },
      { id: 'cancelled', name: '已取消', count: 0 }
    ],
    activeStatus: 'all',
    
    // 订单列表
    orders: [],
    filteredOrders: [],
    
    // 页面状态
    loading: true,
    refreshing: false,
    hasMore: true,
    page: 1,
    pageSize: 10
  },

  onLoad(options) {
    // 如果有传入状态参数，设置默认筛选状态
    if (options.status) {
      this.setData({ activeStatus: options.status })
    }
    this.initPage()
  },

  onShow() {
    // 每次显示页面时刷新数据
    this.refreshOrders()
  },

  // 初始化页面
  async initPage() {
    try {
      wx.showLoading({ title: '加载中...' })
      await this.loadOrders()
      this.updateStatusCounts()
      this.filterOrders()
    } catch (error) {
      console.error('初始化订单页面失败:', error)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ loading: false })
    }
  },

  // 加载订单列表
  async loadOrders(isRefresh = false) {
    try {
      const openid = await app.getOpenId()
      
      // 构建查询条件
      let query = db.collection('orders').where({
        openid: openid
      })
      
      // 分页查询
      const page = isRefresh ? 1 : this.data.page
      const res = await query
        .orderBy('createTime', 'desc')
        .skip((page - 1) * this.data.pageSize)
        .limit(this.data.pageSize)
        .get()
      
      // 处理订单数据
      const processedOrders = res.data.map(order => this.processOrderData(order))
      
      if (isRefresh) {
        this.setData({
          orders: processedOrders,
          page: 1,
          hasMore: processedOrders.length >= this.data.pageSize
        })
      } else {
        this.setData({
          orders: [...this.data.orders, ...processedOrders],
          page: page + 1,
          hasMore: processedOrders.length >= this.data.pageSize
        })
      }
      
    } catch (error) {
      console.error('加载订单失败:', error)
      throw error
    }
  },

  // 处理订单数据
  processOrderData(order) {
    return {
      ...order,
      createTimeText: this.formatTime(order.createTime),
      statusText: this.getStatusText(order.status),
      statusClass: this.getStatusClass(order.status),
      totalAmountText: `¥${order.totalAmount.toFixed(2)}`,
      canCancel: order.status === 'pending',
      canPay: order.status === 'pending',
      canConfirm: order.status === 'shipped',
      canEvaluate: order.status === 'delivered' && !order.evaluated
    }
  },

  // 获取状态文本
  getStatusText(status) {
    const statusMap = {
      'pending': '待付款',
      'paid': '已付款',
      'shipped': '已发货',
      'delivered': '已送达',
      'completed': '已完成',
      'cancelled': '已取消'
    }
    return statusMap[status] || '未知状态'
  },

  // 获取状态样式类
  getStatusClass(status) {
    const classMap = {
      'pending': 'status-pending',
      'paid': 'status-paid',
      'shipped': 'status-shipped',
      'delivered': 'status-delivered',
      'completed': 'status-completed',
      'cancelled': 'status-cancelled'
    }
    return classMap[status] || 'status-default'
  },

  // 更新状态计数
  updateStatusCounts() {
    const orders = this.data.orders
    const statusTabs = this.data.statusTabs.map(tab => {
      if (tab.id === 'all') {
        tab.count = orders.length
      } else {
        tab.count = orders.filter(order => order.status === tab.id).length
      }
      return tab
    })
    this.setData({ statusTabs })
  },

  // 筛选订单
  filterOrders() {
    const { orders, activeStatus } = this.data
    let filteredOrders = orders
    
    if (activeStatus !== 'all') {
      filteredOrders = orders.filter(order => order.status === activeStatus)
    }
    
    this.setData({ filteredOrders })
  },

  // 切换状态筛选
  onStatusChange(e) {
    const status = e.currentTarget.dataset.status
    this.setData({ activeStatus: status })
    this.filterOrders()
  },

  // 刷新订单
  async refreshOrders() {
    this.setData({ refreshing: true })
    try {
      await this.loadOrders(true)
      this.updateStatusCounts()
      this.filterOrders()
    } catch (error) {
      wx.showToast({ title: '刷新失败', icon: 'none' })
    } finally {
      this.setData({ refreshing: false })
    }
  },

  // 加载更多订单
  async loadMoreOrders() {
    if (!this.data.hasMore || this.data.loading) return
    
    this.setData({ loading: true })
    try {
      await this.loadOrders()
      this.updateStatusCounts()
      this.filterOrders()
    } catch (error) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 查看订单详情
  viewOrderDetail(e) {
    const order = e.currentTarget.dataset.order
    wx.navigateTo({
      url: `/pages/order-detail/order-detail?orderId=${order._id}`
    })
  },

  // 取消订单
  async cancelOrder(e) {
    const order = e.currentTarget.dataset.order
    
    const res = await wx.showModal({
      title: '确认取消',
      content: '确定要取消这个订单吗？',
      confirmText: '确认取消',
      cancelText: '再想想'
    })
    
    if (!res.confirm) return
    
    try {
      wx.showLoading({ title: '取消中...' })
      
      await wx.cloud.callFunction({
        name: 'orderManager',
        data: {
          action: 'cancelOrder',
          orderId: order._id
        }
      })
      
      wx.showToast({ title: '订单已取消', icon: 'success' })
      this.refreshOrders()
      
    } catch (error) {
      console.error('取消订单失败:', error)
      wx.showToast({ title: '取消失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 支付订单
  async payOrder(e) {
    const order = e.currentTarget.dataset.order
    
    try {
      wx.showLoading({ title: '发起支付...' })
      
      // 调用支付接口
      const payRes = await wx.cloud.callFunction({
        name: 'orderManager',
        data: {
          action: 'createPayment',
          orderId: order._id
        }
      })
      
      if (payRes.result.success) {
        // 发起微信支付
        await wx.requestPayment(payRes.result.paymentParams)
        
        wx.showToast({ title: '支付成功', icon: 'success' })
        this.refreshOrders()
      } else {
        throw new Error(payRes.result.message)
      }
      
    } catch (error) {
      console.error('支付失败:', error)
      if (error.errMsg && error.errMsg.includes('cancel')) {
        wx.showToast({ title: '支付已取消', icon: 'none' })
      } else {
        wx.showToast({ title: '支付失败', icon: 'none' })
      }
    } finally {
      wx.hideLoading()
    }
  },

  // 确认收货
  async confirmOrder(e) {
    const order = e.currentTarget.dataset.order
    
    const res = await wx.showModal({
      title: '确认收货',
      content: '确认已收到商品吗？',
      confirmText: '确认收货'
    })
    
    if (!res.confirm) return
    
    try {
      wx.showLoading({ title: '确认中...' })
      
      await wx.cloud.callFunction({
        name: 'orderManager',
        data: {
          action: 'confirmOrder',
          orderId: order._id
        }
      })
      
      wx.showToast({ title: '确认收货成功', icon: 'success' })
      this.refreshOrders()
      
    } catch (error) {
      console.error('确认收货失败:', error)
      wx.showToast({ title: '确认失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 评价订单
  evaluateOrder(e) {
    const order = e.currentTarget.dataset.order
    wx.navigateTo({
      url: `/pages/order-evaluate/order-evaluate?orderId=${order._id}`
    })
  },

  // 联系客服
  contactService() {
    wx.makePhoneCall({
      phoneNumber: '400-123-4567'
    })
  },

  // 格式化时间
  formatTime(timestamp) {
    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    
    return `${year}-${month}-${day} ${hour}:${minute}`
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.refreshOrders().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 上拉加载更多
  onReachBottom() {
    this.loadMoreOrders()
  }
})