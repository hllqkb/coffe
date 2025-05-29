// pages/profile/invite/invite.js
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    userInfo: null,
    inviteCode: '',
    inviteCount: 0,
    inviteReward: 0,
    inviteList: [],
    loading: false
  },

  onLoad() {
    this.loadUserInfo()
    this.generateInviteCode()
    this.loadInviteData()
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

  // 生成邀请码
  generateInviteCode() {
    const openid = app.globalData.openid
    if (openid) {
      // 使用openid的后6位作为邀请码
      const inviteCode = openid.slice(-6).toUpperCase()
      this.setData({ inviteCode })
    }
  },

  // 加载邀请数据
  async loadInviteData() {
    try {
      this.setData({ loading: true })
      
      const openid = app.globalData.openid
      if (!openid) return

      // 获取邀请统计
      const statsRes = await db.collection('user_invites')
        .where({ inviter: openid })
        .count()
      
      const inviteCount = statsRes.total
      const inviteReward = inviteCount * 10 // 每邀请一人奖励10金币

      // 获取邀请列表
      const listRes = await db.collection('user_invites')
        .where({ inviter: openid })
        .orderBy('createTime', 'desc')
        .limit(20)
        .get()

      this.setData({
        inviteCount,
        inviteReward,
        inviteList: listRes.data
      })
    } catch (error) {
      console.error('加载邀请数据失败:', error)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 复制邀请码
  copyInviteCode() {
    const { inviteCode } = this.data
    wx.setClipboardData({
      data: inviteCode,
      success: () => {
        wx.showToast({
          title: '邀请码已复制',
          icon: 'success'
        })
      }
    })
  },

  // 分享给好友
  shareToFriend() {
    const { userInfo, inviteCode } = this.data
    const title = `${userInfo?.nickName || '我'}邀请你一起种植咖啡树！`
    const content = `使用邀请码：${inviteCode}，一起在咖啡庄园种植属于我们的咖啡树吧！`
    
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
    
    wx.showToast({
      title: '请点击右上角分享',
      icon: 'none'
    })
  },

  // 查看邀请规则
  showInviteRules() {
    wx.showModal({
      title: '邀请规则',
      content: '1. 分享邀请码给好友\n2. 好友使用邀请码注册\n3. 每成功邀请1人获得10金币\n4. 被邀请用户也将获得5金币奖励',
      showCancel: false,
      confirmText: '我知道了'
    })
  },

  // 页面分享
  onShareAppMessage() {
    const { userInfo, inviteCode } = this.data
    return {
      title: `${userInfo?.nickName || '我'}邀请你一起种植咖啡树！`,
      path: `/pages/index/index?inviteCode=${inviteCode}`,
      imageUrl: '/images/share-invite.jpg'
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    const { userInfo, inviteCode } = this.data
    return {
      title: `${userInfo?.nickName || '我'}邀请你一起种植咖啡树！邀请码：${inviteCode}`,
      imageUrl: '/images/share-invite.jpg'
    }
  }
})