// app.js
App({
  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloudbase-baas-1glxfatb05a0cf6e', // 替换为你的云开发环境ID
        traceUser: true,
      })
    }

    // 获取用户信息
    this.getUserInfo()
  },

  globalData: {
    userInfo: null,
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo'),
    canIUseGetUserProfile: false,
    canIUseOpenData: wx.canIUse('open-data.type.userAvatarUrl') && wx.canIUse('open-data.type.userNickName'),
    // 咖啡品种数据
    coffeeVarieties: [
      {
        id: 1,
        name: '阿拉比卡',
        description: '世界上最受欢迎的咖啡品种，口感温和香甜',
        growthTime: 180, // 成长时间（天）
        image: '/images/arabica.png'
      },
      {
        id: 2,
        name: '罗布斯塔',
        description: '咖啡因含量较高，口感浓郁苦涩',
        growthTime: 150,
        image: '/images/robusta.png'
      },
      {
        id: 3,
        name: '蓝山',
        description: '牙买加蓝山咖啡，被誉为咖啡中的极品',
        growthTime: 200,
        image: '/images/blue-mountain.png'
      },
      {
        id: 4,
        name: '瑰夏',
        description: '巴拿马瑰夏，花香浓郁，口感独特',
        growthTime: 220,
        image: '/images/geisha.png'
      }
    ],
    // 咖啡成长阶段
    growthStages: [
      {
        stage: 0,
        name: '种子',
        description: '咖啡种子刚刚种下',
        image: '/images/stage-seed.png',
        duration: 30
      },
      {
        stage: 1,
        name: '发芽',
        description: '咖啡种子开始发芽',
        image: '/images/stage-sprout.png',
        duration: 45
      },
      {
        stage: 2,
        name: '幼苗',
        description: '咖啡幼苗茁壮成长',
        image: '/images/stage-seedling.png',
        duration: 60
      },
      {
        stage: 3,
        name: '开花',
        description: '咖啡树开出美丽的白花',
        image: '/images/stage-flower.png',
        duration: 30
      },
      {
        stage: 4,
        name: '结果',
        description: '咖啡果实开始形成',
        image: '/images/stage-fruit.png',
        duration: 45
      },
      {
        stage: 5,
        name: '成熟',
        description: '咖啡果实完全成熟，可以收获',
        image: '/images/stage-mature.png',
        duration: 0
      }
    ]
  },

  getUserInfo() {
    if (wx.canIUse('getUserProfile')) {
      this.globalData.canIUseGetUserProfile = true
    }
  },

  // 获取用户OpenID和用户信息
  getOpenId(userInfo = null) {
    return new Promise((resolve, reject) => {
      const data = {}
      if (userInfo) {
        data.nickName = userInfo.nickName
        data.avatarUrl = userInfo.avatarUrl
      }
      
      wx.cloud.callFunction({
        name: 'userLogin',
        data: data,
        success: res => {
          console.log('[云函数] [userLogin] 调用成功: ', res.result)
          if (res.result.success) {
            // 保存用户信息到全局数据
            if (res.result.data.userInfo) {
              this.globalData.userInfo = {
                nickName: res.result.data.userInfo.nickName,
                avatarUrl: res.result.data.userInfo.avatarUrl
              }
              this.globalData.hasUserInfo = true
            }
            resolve(res.result.data.openid)
          } else {
            reject(new Error(res.result.message || '登录失败'))
          }
        },
        fail: err => {
          console.error('[云函数] [userLogin] 调用失败', err)
          reject(err)
        }
      })
    })
  },

  // 格式化时间
  formatTime(date) {
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hour = date.getHours()
    const minute = date.getMinutes()
    const second = date.getSeconds()

    return `${[year, month, day].map(this.formatNumber).join('/')} ${[hour, minute, second].map(this.formatNumber).join(':')}`
  },

  formatNumber(n) {
    n = n.toString()
    return n[1] ? n : `0${n}`
  }
})