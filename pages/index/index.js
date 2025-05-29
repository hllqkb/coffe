// index.js
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    userInfo: {},
    hasUserInfo: false,
    canIUseGetUserProfile: false,
    userLevel: 1,
    waterCount: 0,
    fertilizerCount: 0,
    coinCount: 0,
    coffeeVarieties: [],
    hasSelectedVariety: false,
    myTrees: [],
    dailyTasks: [],
    recommendKnowledge: [],
    canClaimNewTree: true,
    showVarietyModal: false,
    selectedVariety: {},
    loading: true
  },

  onLoad() {
    // 获取全局数据
    this.setData({
      canIUseGetUserProfile: app.globalData.canIUseGetUserProfile
    })
    
    // 初始化页面数据
    this.initPageData()
  },

  onShow() {
    // 每次显示页面时刷新数据
    this.refreshUserData()
    this.loadMyTrees()
  },

  // 初始化页面数据
  async initPageData() {
    try {
      wx.showLoading({ title: '加载中...' })
      
      // 检查用户是否已登录
      if (!app.globalData.userInfo) {
        // 尝试获取用户信息
        await this.getUserInfo()
        
        // 如果仍然没有用户信息，跳转到登录页面
        if (!app.globalData.userInfo) {
          wx.redirectTo({
            url: '/pages/login/login'
          })
          return
        }
      }
      
      // 并行加载数据
      await Promise.all([
        this.loadUserResources(),
        this.loadMyTrees(),
        this.loadDailyTasks(),
        this.loadRecommendKnowledge(),
        this.loadCoffeeVarieties()
      ])
      
      this.setData({ loading: false })
    } catch (error) {
      console.error('初始化页面数据失败:', error)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 获取用户信息
  getUserInfo() {
    return new Promise(async (resolve) => {
      if (app.globalData.userInfo) {
        this.setData({
          userInfo: app.globalData.userInfo,
          hasUserInfo: true
        })
        resolve()
      } else {
        try {
          // 从数据库获取用户信息
          const wxContext = await wx.cloud.callFunction({
            name: 'userLogin'
          });
          
          if (wxContext.result && wxContext.result.success) {
            const userInfo = wxContext.result.data.userInfo;
            app.globalData.userInfo = {
              nickName: userInfo.nickName || '咖啡爱好者',
              avatarUrl: userInfo.avatarUrl || '/images/default-avatar.png'
            };
            this.setData({
              userInfo: app.globalData.userInfo,
              hasUserInfo: true
            });
            resolve();
          } else {
            // 如果无法获取用户信息，尝试使用 getUserProfile
            if (this.data.canIUseGetUserProfile) {
              // 可以使用 wx.getUserProfile 获取头像昵称
              resolve()
            } else {
              // 在没有 open-type=getUserInfo 版本的兼容处理
              wx.getUserInfo({
                success: (res) => {
                  app.globalData.userInfo = res.userInfo
                  this.setData({
                    userInfo: res.userInfo,
                    hasUserInfo: true
                  })
                  resolve()
                },
          
                 fail: () => resolve()
               })
             }
           }
         } catch (error) {
           console.error('获取用户信息失败:', error);
           resolve();
         }
       }
    })
  },

  // 获取用户资源数据
  async loadUserResources() {
    try {
      const openid = await app.getOpenId()
      const res = await db.collection('users').where({
        openid: openid
      }).get()
      
      if (res.data.length > 0) {
        const userData = res.data[0]
        this.setData({
          waterCount: userData.water || 0,
          fertilizerCount: userData.fertilizer || 0,
          coinCount: userData.coin || 0,
          userLevel: userData.level || 1,
          hasSelectedVariety: userData.hasSelectedVariety || false
        })
      } else {
        // 新用户，创建用户记录
        await this.createNewUser(openid)
      }
    } catch (error) {
      console.error('加载用户资源失败:', error)
    }
  },

  // 创建新用户
  async createNewUser(openid) {
    try {
      await db.collection('users').add({
        data: {
          openid: openid,
          water: 10, // 新用户赠送10个水滴
          fertilizer: 5, // 新用户赠送5个肥料
          coin: 100, // 新用户赠送100金币
          level: 1,
          hasSelectedVariety: false,
          createTime: new Date(),
          lastSignIn: null
        }
      })
      
      this.setData({
        waterCount: 10,
        fertilizerCount: 5,
        coinCount: 100,
        userLevel: 1
      })
      
      wx.showToast({ title: '欢迎新用户！', icon: 'success' })
    } catch (error) {
      console.error('创建新用户失败:', error)
    }
  },

  // 加载我的咖啡树
  async loadMyTrees() {
    try {
      const openid = await app.getOpenId()
      const res = await db.collection('coffee_trees').where({
        openid: openid
      }).orderBy('createTime', 'desc').get()
      
      const trees = res.data.map(tree => {
        const variety = app.globalData.coffeeVarieties.find(v => v.id === tree.varietyId)
        const stage = app.globalData.growthStages.find(s => s.stage === tree.currentStage)
        
        return {
          ...tree,
          varietyName: variety ? variety.name : '未知品种',
          currentStageName: stage ? stage.name : '未知阶段',
          currentStageImage: stage ? stage.image : '/images/default-tree.png',
          progress: this.calculateProgress(tree)
        }
      })
      
      this.setData({ myTrees: trees })
    } catch (error) {
      console.error('加载咖啡树失败:', error)
    }
  },

  // 计算咖啡树成长进度
  calculateProgress(tree) {
    const now = new Date()
    const plantTime = new Date(tree.plantTime)
    const daysPassed = Math.floor((now - plantTime) / (1000 * 60 * 60 * 24))
    
    const currentStage = app.globalData.growthStages.find(s => s.stage === tree.currentStage)
    if (!currentStage) return 0
    
    const stageStartDay = app.globalData.growthStages
      .filter(s => s.stage < tree.currentStage)
      .reduce((total, stage) => total + stage.duration, 0)
    
    const stageProgress = Math.min(
      ((daysPassed - stageStartDay) / currentStage.duration) * 100,
      100
    )
    
    return Math.max(stageProgress, 0)
  },

  // 加载每日任务
  loadDailyTasks() {
    const tasks = [
      {
        id: 1,
        name: '每日签到',
        reward: '水滴 x2',
        completed: false
      },
      {
        id: 2,
        name: '浇水一次',
        reward: '经验 +10',
        completed: false
      },
      {
        id: 3,
        name: '学习咖啡知识',
        reward: '金币 +20',
        completed: false
      },
      {
        id: 4,
        name: '分享给朋友',
        reward: '肥料 x1',
        completed: false
      }
    ]
    
    this.setData({ dailyTasks: tasks })
  },

  // 加载推荐知识
  loadRecommendKnowledge() {
    const knowledge = [
      {
        id: 1,
        title: '咖啡豆的成熟过程',
        summary: '了解咖啡果实从绿色到红色的成熟过程',
        image: '/images/coffee-ripening.png'
      },
      {
        id: 2,
        title: '咖啡的种植环境',
        summary: '咖啡树喜欢温暖湿润的气候环境',
        image: '/images/coffee-environment.png'
      },
      {
        id: 3,
        title: '咖啡豆可以生吃吗？',
        summary: '探索咖啡豆的食用方式和注意事项',
        image: '/images/coffee-eating.png'
      }
    ]
    
    this.setData({ recommendKnowledge: knowledge })
  },

  // 刷新用户数据
  refreshUserData() {
    this.loadUserResources()
  },

  // 选择咖啡品种
  selectVariety(e) {
    const variety = e.currentTarget.dataset.variety
    this.setData({
      selectedVariety: variety,
      showVarietyModal: true
    })
  },

  // 确认选择品种
  async confirmSelectVariety() {
    try {
      wx.showLoading({ title: '种植中...' })
      
      const openid = await app.getOpenId()
      const variety = this.data.selectedVariety
      
      // 创建咖啡树记录
      await db.collection('coffee_trees').add({
        data: {
          openid: openid,
          varietyId: variety.id,
          varietyName: variety.name,
          currentStage: 0, // 种子阶段
          plantTime: new Date(),
          lastWatered: null,
          lastFertilized: null,
          waterCount: 0,
          fertilizerCount: 0,
          isHarvested: false,
          createTime: new Date()
        }
      })
      
      // 更新用户状态
      await db.collection('users').where({
        openid: openid
      }).update({
        data: {
          hasSelectedVariety: true
        }
      })
      
      this.setData({
        showVarietyModal: false,
        hasSelectedVariety: true,
        canClaimNewTree: false
      })
      
      // 重新加载咖啡树数据
      await this.loadMyTrees()
      
      wx.showToast({ title: '种植成功！', icon: 'success' })
    } catch (error) {
      console.error('种植咖啡树失败:', error)
      wx.showToast({ title: '种植失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 取消选择品种
  cancelSelectVariety() {
    this.setData({
      showVarietyModal: false,
      selectedVariety: {}
    })
  },

  // 认领新咖啡树
  claimNewTree() {
    if (!this.data.hasSelectedVariety) {
      wx.showToast({ title: '请先选择咖啡品种', icon: 'none' })
      return
    }
    
    // 检查是否可以认领新树（例如：等级限制、已有树的数量等）
    if (this.data.myTrees.length >= 3) {
      wx.showToast({ title: '最多只能拥有3棵咖啡树', icon: 'none' })
      return
    }
    
    // 显示品种选择
    // 这里可以直接跳转到品种选择页面或显示选择模态框
  },

  // 页面跳转方法
  goToGarden() {
    wx.switchTab({ url: '/pages/garden/garden' })
  },

  goToCheckin() {
    wx.navigateTo({ url: '/pages/signin/signin' })
  },

  goToShop() {
    wx.navigateTo({ url: '/pages/shop/shop' })
  },

  goToKnowledge() {
    wx.switchTab({ url: '/pages/knowledge/knowledge' })
  },

  goToTree(e) {
    const tree = e.currentTarget.dataset.tree
    wx.navigateTo({
      url: `/pages/tree/tree?treeId=${tree._id}`
    })
  },

  goToKnowledgeDetail(e) {
    const knowledge = e.currentTarget.dataset.knowledge
    wx.navigateTo({
      url: `/pages/knowledge/knowledge?id=${knowledge.id}`
    })
  },

  // 加载咖啡品种数据
  async loadCoffeeVarieties() {
    try {
      // 首先尝试初始化数据（如果数据库为空）
      await wx.cloud.callFunction({
        name: 'coffeeVarietyManager',
        data: {
          action: 'initVarieties'
        }
      })
      
      // 获取咖啡品种数据
      const result = await wx.cloud.callFunction({
        name: 'coffeeVarietyManager',
        data: {
          action: 'getVarieties'
        }
      })
      
      if (result.result.success) {
        this.setData({
          coffeeVarieties: result.result.data
        })
      } else {
        // 如果云函数调用失败，使用本地备用数据
        console.warn('加载咖啡品种失败，使用备用数据:', result.result.message)
        this.setData({
          coffeeVarieties: app.globalData.coffeeVarieties
        })
      }
    } catch (error) {
      console.error('加载咖啡品种失败:', error)
      // 使用本地备用数据
      this.setData({
        coffeeVarieties: app.globalData.coffeeVarieties
      })
    }
  },

  // 分享应用
  shareApp() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
  },

  // 获取用户头像昵称
  getUserProfile() {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        app.globalData.userInfo = res.userInfo
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        })
      }
    })
  },

  // 分享配置
  onShareAppMessage() {
    return {
      title: '一起来种植咖啡树吧！',
      path: '/pages/index/index',
      imageUrl: '/images/share-image.png'
    }
  },

  onShareTimeline() {
    return {
      title: '咖啡小树 - 种植属于你的咖啡',
      imageUrl: '/images/share-timeline.png'
    }
  }
})