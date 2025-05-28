// pages/login/login.js
const app = getApp()

Page({
  data: {
    canIUseGetUserProfile: false,
    userInfo: null,
    hasUserInfo: false
  },

  onLoad() {
    if (wx.canIUse('getUserProfile')) {
      this.setData({
        canIUseGetUserProfile: true
      })
    }
  },

  // 微信登录
  async wxLogin(e) {
    try {
      wx.showLoading({ title: '登录中...' })
      
      let userInfo = null
      
      // 获取用户信息
      if (this.data.canIUseGetUserProfile) {
        userInfo = await this.getUserProfile()
      } else if (e && e.detail && e.detail.userInfo) {
        // 兼容旧版本的getUserInfo
        userInfo = e.detail.userInfo
        app.globalData.userInfo = userInfo
        this.setData({
          userInfo: userInfo,
          hasUserInfo: true
        })
      }
      
      // 调用云函数获取openid
      const openid = await app.getOpenId(userInfo)
      console.log('获取到openid:', openid)
      
      // 登录成功，跳转到首页
      wx.switchTab({
        url: '/pages/index/index'
      })
      
      wx.showToast({
        title: '登录成功',
        icon: 'success'
      })
      
    } catch (error) {
      console.error('登录失败:', error)
      wx.showToast({
        title: '登录失败: ' + (error.message || '未知错误'),
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 获取用户头像昵称
  getUserProfile() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: (res) => {
          app.globalData.userInfo = res.userInfo
          this.setData({
            userInfo: res.userInfo,
            hasUserInfo: true
          })
          resolve(res.userInfo)
        },
        fail: (err) => {
          console.error('获取用户信息失败:', err)
          reject(err)
        }
      })
    })
  },

  // 跳过登录
  skipLogin() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  }
})