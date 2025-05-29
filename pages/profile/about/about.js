// pages/profile/about/about.js
Page({
  data: {
    appInfo: {
      name: '咖啡种植园',
      version: '1.0.0',
      description: '一款专注于咖啡种植体验的休闲游戏',
      logo: '/images/logo/app-logo.png'
    },
    companyInfo: {
      name: '咖啡科技有限公司',
      address: '北京市朝阳区咖啡大厦',
      phone: '400-123-4567',
      email: 'contact@coffee.com',
      website: 'www.coffee.com'
    },
    features: [
      {
        icon: '/images/icons/plant.png',
        title: '真实种植体验',
        desc: '模拟真实的咖啡种植过程，从播种到收获'
      },
      {
        icon: '/images/icons/social.png',
        title: '社交互动',
        desc: '与好友一起种植，分享收获的喜悦'
      },
      {
        icon: '/images/icons/shop.png',
        title: '丰富商城',
        desc: '各种咖啡品种和道具，打造专属花园'
      },
      {
        icon: '/images/icons/reward.png',
        title: '每日奖励',
        desc: '签到打卡，完成任务获得丰厚奖励'
      }
    ],
    teamMembers: [
      {
        name: '张三',
        position: '产品经理',
        avatar: '/images/avatars/pm.png',
        desc: '负责产品规划和用户体验设计'
      },
      {
        name: '李四',
        position: '技术总监',
        avatar: '/images/avatars/tech.png',
        desc: '负责技术架构和开发管理'
      },
      {
        name: '王五',
        position: '设计师',
        avatar: '/images/avatars/design.png',
        desc: '负责UI设计和视觉效果'
      }
    ],
    updates: [
      {
        version: '1.0.0',
        date: '2024-01-15',
        features: [
          '全新的咖啡种植体验',
          '丰富的商城系统',
          '好友互动功能',
          '每日签到奖励'
        ]
      },
      {
        version: '0.9.0',
        date: '2023-12-20',
        features: [
          '优化种植界面',
          '新增咖啡品种',
          '修复已知问题'
        ]
      }
    ],
    showTeam: false,
    showUpdates: false
  },

  onLoad() {
    this.getAppVersion()
  },

  // 获取应用版本信息
  getAppVersion() {
    try {
      const systemInfo = wx.getSystemInfoSync()
      this.setData({
        'appInfo.platform': systemInfo.platform,
        'appInfo.system': systemInfo.system
      })
    } catch (error) {
      console.error('获取系统信息失败:', error)
    }
  },

  // 复制联系方式
  copyContact(e) {
    const type = e.currentTarget.dataset.type
    const { companyInfo } = this.data
    let content = ''
    let title = ''
    
    switch (type) {
      case 'phone':
        content = companyInfo.phone
        title = '电话号码已复制'
        break
      case 'email':
        content = companyInfo.email
        title = '邮箱地址已复制'
        break
      case 'website':
        content = companyInfo.website
        title = '网站地址已复制'
        break
      case 'address':
        content = companyInfo.address
        title = '公司地址已复制'
        break
    }
    
    if (content) {
      wx.setClipboardData({
        data: content,
        success: () => {
          wx.showToast({
            title: title,
            icon: 'success'
          })
        }
      })
    }
  },

  // 拨打电话
  makePhoneCall() {
    wx.makePhoneCall({
      phoneNumber: this.data.companyInfo.phone
    })
  },

  // 切换团队展示
  toggleTeam() {
    this.setData({
      showTeam: !this.data.showTeam
    })
  },

  // 切换更新日志展示
  toggleUpdates() {
    this.setData({
      showUpdates: !this.data.showUpdates
    })
  },

  // 分享应用
  shareApp() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
  },

  // 意见反馈
  goToFeedback() {
    wx.navigateTo({
      url: '/pages/profile/feedback/feedback'
    })
  },

  // 帮助中心
  goToHelp() {
    wx.navigateTo({
      url: '/pages/profile/help/help'
    })
  },

  // 用户协议
  showUserAgreement() {
    wx.showModal({
      title: '用户协议',
      content: '感谢您使用咖啡种植园！\n\n我们致力于保护您的隐私和数据安全，请仔细阅读我们的用户协议和隐私政策。\n\n如有疑问，请联系客服。',
      showCancel: false,
      confirmText: '我知道了'
    })
  },

  // 隐私政策
  showPrivacyPolicy() {
    wx.showModal({
      title: '隐私政策',
      content: '我们重视您的隐私保护：\n\n1. 仅收集必要的用户信息\n2. 不会泄露您的个人数据\n3. 使用加密技术保护数据安全\n4. 您可以随时删除个人数据\n\n详细内容请访问我们的官网查看。',
      showCancel: false,
      confirmText: '我知道了'
    })
  },

  // 检查更新
  checkUpdate() {
    wx.showLoading({
      title: '检查中...'
    })
    
    // 模拟检查更新
    setTimeout(() => {
      wx.hideLoading()
      wx.showToast({
        title: '已是最新版本',
        icon: 'success'
      })
    }, 1500)
  },

  // 页面分享
  onShareAppMessage() {
    return {
      title: '咖啡种植园 - 体验真实的咖啡种植乐趣',
      path: '/pages/index/index',
      imageUrl: '/images/share/about-share.png'
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '咖啡种植园 - 体验真实的咖啡种植乐趣',
      imageUrl: '/images/share/about-share.png'
    }
  }
})