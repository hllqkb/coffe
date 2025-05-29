const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    userInfo: {},
    coinCount: 0,
    waterCount: 0,
    fertilizerCount: 0,
    
    // 签到状态
    isCheckedIn: false,
    consecutiveDays: 0,
    totalDays: 0,
    lastCheckInDate: null,
    
    // 签到奖励日历
    checkinRewards: [
      { day: 1, type: 'coin', amount: 50, icon: '/images/coin.png', name: '金币' },
      { day: 2, type: 'water', amount: 3, icon: '/images/water.png', name: '水滴' },
      { day: 3, type: 'coin', amount: 80, icon: '/images/coin.png', name: '金币' },
      { day: 4, type: 'fertilizer', amount: 2, icon: '/images/fertilizer.png', name: '肥料' },
      { day: 5, type: 'coin', amount: 120, icon: '/images/coin.png', name: '金币' },
      { day: 6, type: 'water', amount: 5, icon: '/images/water.png', name: '水滴' },
      { day: 7, type: 'special', amount: 200, icon: '/images/gift.png', name: '大礼包' }
    ],
    
    // 资源展示
    resources: [
      { name: '金币', icon: '/images/coin.png', count: 0 },
      { name: '水滴', icon: '/images/water.png', count: 0 },
      { name: '肥料', icon: '/images/fertilizer.png', count: 0 }
    ],
    
    // 弹窗状态
    showRewardModal: false,
    rewardResult: {},
    
    // 加载状态
    loading: false
  },

  onLoad() {
    this.loadUserInfo()
    this.loadCheckinStatus()
    this.loadUserResources()
  },

  onShow() {
    this.loadUserResources()
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      const userInfo = app.globalData.userInfo
      if (userInfo) {
        this.setData({ userInfo })
      }
    } catch (error) {
      console.error('加载用户信息失败:', error)
    }
  },

  // 加载签到状态
  async loadCheckinStatus() {
    try {
      const openid = await app.getOpenId()
      const today = new Date()
      const todayStr = today.toDateString()
      
      // 查询今日签到记录
      const checkinRes = await db.collection('checkins')
        .where({
          openid: openid,
          checkinDate: todayStr
        })
        .get()
      
      const isCheckedIn = checkinRes.data.length > 0
      
      // 查询签到统计
      const statsRes = await db.collection('checkin_stats')
        .where({ openid: openid })
        .get()
      
      let consecutiveDays = 0
      let totalDays = 0
      let lastCheckInDate = null
      
      if (statsRes.data.length > 0) {
        const stats = statsRes.data[0]
        consecutiveDays = stats.consecutiveDays || 0
        totalDays = stats.totalDays || 0
        lastCheckInDate = stats.lastCheckInDate
        
        // 检查连续签到是否中断
        if (lastCheckInDate) {
          const lastDate = new Date(lastCheckInDate)
          const yesterday = new Date(today)
          yesterday.setDate(yesterday.getDate() - 1)
          
          if (lastDate.toDateString() !== yesterday.toDateString() && 
              lastDate.toDateString() !== todayStr) {
            consecutiveDays = 0
          }
        }
      }
      
      this.setData({
        isCheckedIn,
        consecutiveDays,
        totalDays,
        lastCheckInDate
      })
      
    } catch (error) {
      console.error('加载签到状态失败:', error)
    }
  },

  // 加载用户资源
  async loadUserResources() {
    try {
      const openid = wx.getStorageSync('openid')
      if (!openid) return
      
      const userRes = await db.collection('users').doc(openid).get()
      if (userRes.data) {
        const userData = userRes.data
        this.setData({
          coinCount: userData.coin || 0,
          waterCount: userData.water || 0,
          fertilizerCount: userData.fertilizer || 0,
          'resources[0].count': userData.coin || 0,
          'resources[1].count': userData.water || 0,
          'resources[2].count': userData.fertilizer || 0
        })
      }
    } catch (error) {
      console.error('加载用户资源失败:', error)
    }
  },

  // 执行签到
  async performCheckin() {
    if (this.data.isCheckedIn) {
      wx.showToast({ title: '今日已签到', icon: 'none' })
      return
    }
    
    this.setData({ loading: true })
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'checkinManager',
        data: {
          action: 'checkin'
        }
      })
      
      if (result.result.success) {
        const checkinResult = result.result.data
        
        // 更新本地状态
        this.setData({
          isCheckedIn: true,
          consecutiveDays: checkinResult.consecutiveDays,
          totalDays: checkinResult.totalDays,
          showRewardModal: true,
          rewardResult: {
            icon: checkinResult.reward.icon,
            name: checkinResult.reward.name,
            amount: checkinResult.reward.amount
          }
        })
        
        // 更新资源显示
         this.loadUserResources()
        
        wx.showToast({ 
          title: '签到成功', 
          icon: 'success' 
        })
      } else {
        wx.showToast({ 
          title: result.result.message, 
          icon: 'none' 
        })
      }
    } catch (error) {
      console.error('签到失败:', error)
      wx.showToast({ title: '签到失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 关闭奖励弹窗
  closeRewardModal() {
    this.setData({ showRewardModal: false })
  },

  // 查看签到历史
  goToHistory() {
    wx.navigateTo({
      url: '/pages/checkin-history/checkin-history'
    })
  },

  // 分享应用
  shareApp() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
  },

  // 前往商店
  goToShop() {
    wx.navigateTo({
      url: '/pages/shop/shop'
    })
  },

  // 返回首页
  goToHome() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  // 分享配置
  onShareAppMessage() {
    return {
      title: '每日签到领奖励，一起种植咖啡树！',
      path: '/pages/checkin/checkin',
      imageUrl: '/images/share-checkin.png'
    }
  },

  onShareTimeline() {
    return {
      title: '每日签到领奖励，一起种植咖啡树！',
      imageUrl: '/images/share-checkin.png'
    }
  }
})