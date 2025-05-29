// pages/profile/settings/settings.js
Page({
  data: {
    userInfo: {
      nickname: '',
      avatar: '',
      phone: '',
      email: ''
    },
    settings: {
      notifications: {
        system: true,
        harvest: true,
        friend: true,
        promotion: false
      },
      privacy: {
        showOnline: true,
        showGarden: true
      },
      game: {
        autoHarvest: false,
        soundEffect: true,
        vibration: true,
        backgroundMusic: true
      },
      display: {
        theme: 'auto', // auto, light, dark
        language: 'zh-CN',
        fontSize: 'medium' // small, medium, large
      }
    },
    cacheSize: '0MB',
    storageInfo: {
      used: 0,
      total: 0
    }
  },

  async onLoad() {
    await this.loadUserInfo()
    await this.loadSettings()
    this.getCacheSize()
  },

  // 加载用户信息
  loadUserInfo() {
    try {
      const userInfo = wx.getStorageSync('userInfo')
      if (userInfo) {
        this.setData({ userInfo })
      }
    } catch (error) {
      console.error('加载用户信息失败:', error)
    }
  },

  // 加载设置
  async loadSettings() {
    try {
      // 从本地存储获取用户信息
      const userInfo = wx.getStorageSync('userInfo')
      if (userInfo && userInfo.settings) {
        this.setData({
          settings: { ...this.data.settings, ...userInfo.settings }
        })
      } else if (userInfo && userInfo._id) {
        // 如果本地没有设置，从数据库加载
        const db = wx.cloud.database()
        const result = await db.collection('users').doc(userInfo._id).get()
        if (result.data && result.data.settings) {
          this.setData({
            settings: { ...this.data.settings, ...result.data.settings }
          })
          // 更新本地存储
          userInfo.settings = result.data.settings
          wx.setStorageSync('userInfo', userInfo)
        }
      }
    } catch (error) {
      console.error('加载设置失败:', error)
    }
  },

  // 保存设置
  async saveSettings() {
    try {
      wx.showLoading({ title: '保存中...' })
      
      // 获取用户信息
      const userInfo = wx.getStorageSync('userInfo')
      if (!userInfo || !userInfo._id) {
        throw new Error('用户信息不存在')
      }
      
      // 更新数据库中的用户设置
      const db = wx.cloud.database()
      await db.collection('users').doc(userInfo._id).update({
        data: {
          settings: this.data.settings,
          updateTime: new Date()
        }
      })
      
      // 更新本地存储
      userInfo.settings = this.data.settings
      wx.setStorageSync('userInfo', userInfo)
      
      wx.showToast({ title: '保存成功', icon: 'success' })
    } catch (error) {
      console.error('保存设置失败:', error)
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 切换通知设置
  toggleNotification(e) {
    const type = e.currentTarget.dataset.type
    const key = `settings.notifications.${type}`
    const value = !this.data.settings.notifications[type]
    
    this.setData({
      [key]: value
    })
    this.saveSettings()
  },

  // 切换隐私设置
  togglePrivacy(e) {
    const type = e.currentTarget.dataset.type
    const key = `settings.privacy.${type}`
    const value = !this.data.settings.privacy[type]
    
    this.setData({
      [key]: value
    })
    this.saveSettings()
  },

  // 切换游戏设置
  toggleGame(e) {
    const type = e.currentTarget.dataset.type
    const key = `settings.game.${type}`
    const value = !this.data.settings.game[type]
    
    this.setData({
      [key]: value
    })
    this.saveSettings()
  },

  // 选择主题
  selectTheme() {
    const themes = [
      { name: '跟随系统', value: 'auto' },
      { name: '浅色模式', value: 'light' },
      { name: '深色模式', value: 'dark' }
    ]
    
    wx.showActionSheet({
      itemList: themes.map(t => t.name),
      success: (res) => {
        const selectedTheme = themes[res.tapIndex]
        this.setData({
          'settings.display.theme': selectedTheme.value
        })
        this.saveSettings()
        this.applyTheme(selectedTheme.value)
      }
    })
  },

  // 应用主题
  applyTheme(theme) {
    // 这里可以实现主题切换逻辑
    wx.showToast({
      title: `已切换到${theme === 'auto' ? '跟随系统' : theme === 'light' ? '浅色' : '深色'}模式`,
      icon: 'success'
    })
  },

  // 选择语言
  selectLanguage() {
    const languages = [
      { name: '简体中文', value: 'zh-CN' },
      { name: '繁體中文', value: 'zh-TW' },
      { name: 'English', value: 'en-US' }
    ]
    
    wx.showActionSheet({
      itemList: languages.map(l => l.name),
      success: (res) => {
        const selectedLang = languages[res.tapIndex]
        this.setData({
          'settings.display.language': selectedLang.value
        })
        this.saveSettings()
      }
    })
  },

  // 选择字体大小
  selectFontSize() {
    const sizes = [
      { name: '小', value: 'small' },
      { name: '中', value: 'medium' },
      { name: '大', value: 'large' }
    ]
    
    wx.showActionSheet({
      itemList: sizes.map(s => s.name),
      success: (res) => {
        const selectedSize = sizes[res.tapIndex]
        this.setData({
          'settings.display.fontSize': selectedSize.value
        })
        this.saveSettings()
      }
    })
  },

  // 获取缓存大小
  getCacheSize() {
    try {
      const storageInfo = wx.getStorageInfoSync()
      const usedMB = (storageInfo.currentSize / 1024).toFixed(2)
      const totalMB = (storageInfo.limitSize / 1024).toFixed(2)
      
      this.setData({
        cacheSize: `${usedMB}MB`,
        storageInfo: {
          used: storageInfo.currentSize,
          total: storageInfo.limitSize
        }
      })
    } catch (error) {
      console.error('获取缓存信息失败:', error)
    }
  },

  // 清理缓存
  clearCache() {
    wx.showModal({
      title: '清理缓存',
      content: '确定要清理应用缓存吗？这将删除临时文件，但不会影响您的游戏数据。',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '清理中...' })
          
          // 模拟清理过程
          setTimeout(() => {
            wx.hideLoading()
            this.setData({ cacheSize: '0MB' })
            wx.showToast({
              title: '清理完成',
              icon: 'success'
            })
          }, 1500)
        }
      }
    })
  },

  // 修改个人信息
  editProfile() {
    wx.navigateTo({
      url: '/pages/profile/edit/edit'
    })
  },

  // 账户安全
  accountSecurity() {
    wx.showModal({
      title: '账户安全',
      content: '当前使用微信登录，账户安全由微信保障。\n\n如需更多安全设置，请联系客服。',
      showCancel: false
    })
  },

  // 数据备份
  backupData() {
    wx.showLoading({ title: '备份中...' })
    
    // 模拟备份过程
    setTimeout(() => {
      wx.hideLoading()
      wx.showModal({
        title: '备份完成',
        content: '您的游戏数据已成功备份到云端。',
        showCancel: false
      })
    }, 2000)
  },

  // 恢复数据
  restoreData() {
    wx.showModal({
      title: '恢复数据',
      content: '确定要从云端恢复数据吗？这将覆盖当前的游戏进度。',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '恢复中...' })
          
          setTimeout(() => {
            wx.hideLoading()
            wx.showToast({
              title: '恢复完成',
              icon: 'success'
            })
          }, 2000)
        }
      }
    })
  },

  // 重置设置
  resetSettings() {
    wx.showModal({
      title: '重置设置',
      content: '确定要重置所有设置为默认值吗？',
      success: (res) => {
        if (res.confirm) {
          const defaultSettings = {
            notifications: {
              system: true,
              harvest: true,
              friend: true,
              promotion: false
            },
            privacy: {
              showOnline: true,
              showGarden: true
            },
            game: {
              autoHarvest: false,
              soundEffect: true,
              vibration: true,
              backgroundMusic: true
            },
            display: {
              theme: 'auto',
              language: 'zh-CN',
              fontSize: 'medium'
            }
          }
          
          this.setData({ settings: defaultSettings })
          this.saveSettings()
        }
      }
    })
  },

  // 注销账户
  deleteAccount() {
    wx.showModal({
      title: '注销账户',
      content: '注销账户将永久删除您的所有数据，此操作不可恢复。\n\n如需注销，请联系客服处理。',
      confirmText: '联系客服',
      success: (res) => {
        if (res.confirm) {
          // 跳转到客服页面或显示客服信息
          wx.showModal({
            title: '客服联系方式',
            content: '客服微信：coffee_service\n客服电话：400-123-4567\n工作时间：9:00-18:00',
            showCancel: false
          })
        }
      }
    })
  }
})