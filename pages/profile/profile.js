// pages/profile/profile.js
Page({
  data: {
    // 用户信息
    userInfo: {
      avatarUrl: '',
      nickName: '',
      title: '新手庄园主',
      level: 1,
      signature: ''
    },
    joinTimeText: '',
    
    // 统计数据
    stats: {
      totalTrees: 0,
      harvestedTrees: 0,
      totalDays: 0,
      checkinDays: 0
    },
    
    // 用户资源
    userResources: {
      water: 0,
      fertilizer: 0,
      coin: 0
    },
    
    // 成就数据
    achievements: [
      {
        id: 'first_tree',
        name: '初次种植',
        description: '种植第一棵咖啡树',
        icon: '/images/achievements/first-tree.png',
        unlocked: false,
        progress: 0,
        target: 1,
        reward: [
          { type: 'water', amount: 10, icon: '/images/icons/water.png' },
          { type: 'coin', amount: 50, icon: '/images/icons/coin.png' }
        ]
      },
      {
        id: 'first_harvest',
        name: '首次收获',
        description: '收获第一棵咖啡树',
        icon: '/images/achievements/first-harvest.png',
        unlocked: false,
        progress: 0,
        target: 1,
        reward: [
          { type: 'fertilizer', amount: 5, icon: '/images/icons/fertilizer.png' },
          { type: 'coin', amount: 100, icon: '/images/icons/coin.png' }
        ]
      },
      {
        id: 'week_checkin',
        name: '坚持一周',
        description: '连续签到7天',
        icon: '/images/achievements/week-checkin.png',
        unlocked: false,
        progress: 0,
        target: 7,
        reward: [
          { type: 'water', amount: 50, icon: '/images/icons/water.png' },
          { type: 'fertilizer', amount: 20, icon: '/images/icons/fertilizer.png' }
        ]
      },
      {
        id: 'tree_master',
        name: '咖啡大师',
        description: '种植10棵咖啡树',
        icon: '/images/achievements/tree-master.png',
        unlocked: false,
        progress: 0,
        target: 10,
        reward: [
          { type: 'coin', amount: 500, icon: '/images/icons/coin.png' }
        ]
      },
      {
        id: 'knowledge_lover',
        name: '知识达人',
        description: '学习50个咖啡知识',
        icon: '/images/achievements/knowledge-lover.png',
        unlocked: false,
        progress: 0,
        target: 50,
        reward: [
          { type: 'coin', amount: 200, icon: '/images/icons/coin.png' }
        ]
      }
    ],
    

    
    // 版本信息
    version: '1.0.0',
    
    // 模态框状态
    showEditModal: false,
    showAchievementModal: false,
    selectedAchievement: null,
    
    // 编辑表单
    editForm: {
      avatarUrl: '',
      nickName: '',
      signature: ''
    },
    
    // 状态
    loading: false,
    saving: false
  },

  onLoad() {
    this.initPage();
  },

  onShow() {
    this.loadUserData();
  },

  // 初始化页面
  async initPage() {
    this.setData({ loading: true });
    
    try {
      await Promise.all([
        this.loadUserInfo(),
        this.loadUserStats(),
        this.loadUserResources(),
        this.loadAchievements(),

      ]);
    } catch (error) {
      console.error('初始化页面失败:', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      const app = getApp();
      
      // 获取微信用户信息
      if (!app.globalData.userInfo) {
        const userProfile = await this.getUserProfile();
        app.globalData.userInfo = userProfile;
      }
      
      // 从云端获取用户详细信息
      const result = await wx.cloud.callFunction({
        name: 'userLogin'
      });
      
      if (result.result.success) {
        const userData = result.result.data;
        const joinTime = new Date(userData.createTime);
        
        this.setData({
          userInfo: {
            avatarUrl: userData.avatarUrl || app.globalData.userInfo.avatarUrl,
            nickName: userData.nickName || app.globalData.userInfo.nickName,
            title: userData.title || '新手庄园主',
            level: userData.level || 1,
            signature: userData.signature || ''
          },
          joinTimeText: this.formatDate(joinTime)
        });
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
    }
  },

  // 获取用户授权信息
  async getUserProfile() {
    return new Promise((resolve) => {
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: (res) => {
          resolve(res.userInfo);
        },
        fail: () => {
          resolve({
            avatarUrl: '/images/default-avatar.png',
            nickName: '咖啡爱好者'
          });
        }
      });
    });
  },

  // 加载用户统计
  async loadUserStats() {
    try {
      const db = wx.cloud.database();
      const app = getApp();
      const openid = await app.getOpenId();
      
      // 获取用户基本信息
      const userRes = await db.collection('users').where({
        openid: openid
      }).get();
      
      if (userRes.data.length > 0) {
        const userData = userRes.data[0];
        this.setData({
          stats: {
            totalTrees: userData.totalTrees || 0,
            harvestedTrees: userData.harvestedTrees || 0,
            totalDays: userData.totalDays || 0,
            checkinDays: userData.checkinDays || 0
          }
        });
      }
    } catch (error) {
      console.error('加载用户统计失败:', error);
    }
  },

  // 加载用户资源
  async loadUserResources() {
    try {
      const db = wx.cloud.database();
      const app = getApp();
      const openid = await app.getOpenId();
      
      const userRes = await db.collection('users').where({
        openid: openid
      }).get();
      
      if (userRes.data.length > 0) {
        const userData = userRes.data[0];
        this.setData({
          userResources: {
            water: userData.water || 0,
            fertilizer: userData.fertilizer || 0,
            coin: userData.coin || 0
          }
        });
      }
    } catch (error) {
      console.error('加载用户资源失败:', error);
    }
  },

  // 加载成就数据
  async loadAchievements() {
    try {
      const db = wx.cloud.database();
      const app = getApp();
      const openid = await app.getOpenId();
      
      const achievementsRes = await db.collection('user_achievements').where({
        openid: openid
      }).get();
      
      const achievements = achievementsRes.data.map(achievement => ({
        ...achievement,
        unlockTimeText: achievement.unlocked && achievement.unlockTime ? 
          this.formatDateTime(new Date(achievement.unlockTime)) : ''
      }));
      
      this.setData({ achievements });
    } catch (error) {
      console.error('加载成就数据失败:', error);
    }
  },



  // 刷新用户数据
  async loadUserData() {
    await Promise.all([
      this.loadUserResources(),
      this.loadUserStats(),
      this.loadAchievements()
    ]);
  },

  // 编辑资料
  editProfile() {
    const { userInfo } = this.data;
    this.setData({
      editForm: {
        avatarUrl: userInfo.avatarUrl,
        nickName: userInfo.nickName,
        signature: userInfo.signature
      },
      showEditModal: true
    });
  },

  // 选择头像
  chooseAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        this.uploadAvatar(tempFilePath);
      }
    });
  },

  // 上传头像
  async uploadAvatar(filePath) {
    try {
      wx.showLoading({ title: '上传中...' });
      
      const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
      
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath,
        filePath
      });
      
      this.setData({
        'editForm.avatarUrl': uploadResult.fileID
      });
      
      wx.hideLoading();
      wx.showToast({
        title: '头像上传成功',
        icon: 'success'
      });
    } catch (error) {
      wx.hideLoading();
      console.error('上传头像失败:', error);
      wx.showToast({
        title: '上传失败，请重试',
        icon: 'none'
      });
    }
  },

  // 昵称输入
  onNickNameInput(e) {
    this.setData({
      'editForm.nickName': e.detail.value
    });
  },

  // 签名输入
  onSignatureInput(e) {
    this.setData({
      'editForm.signature': e.detail.value
    });
  },

  // 关闭编辑模态框并尝试保存
  async saveProfileOnModalClose() {
    if (this.data.saving) return; // 防止重复保存

    // 检查是否有修改
    const { avatarUrl, nickName, signature } = this.data.editForm;
    const { userInfo } = this.data;
    const hasChanged = avatarUrl !== userInfo.avatarUrl || 
                       nickName !== userInfo.nickName || 
                       signature !== userInfo.signature;

    if (hasChanged) {
      await this.saveProfile(); // 调用已有的保存方法
    }
    this.setData({ showEditModal: false });
  },

  // 关闭编辑模态框
  closeEditModal() {
    this.setData({ showEditModal: false });
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 仅用于阻止事件冒泡
    return;
  },

  // 保存资料
  async saveProfile() {
    const { editForm } = this.data;
    
    if (!editForm.nickName.trim()) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }
    
    this.setData({ saving: true });
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'updateUserProfile',
        data: {
          avatarUrl: editForm.avatarUrl,
          nickName: editForm.nickName.trim(),
          signature: editForm.signature.trim()
        }
      });
      
      if (result.result.success) {
        this.setData({
          userInfo: {
            ...this.data.userInfo,
            avatarUrl: editForm.avatarUrl,
            nickName: editForm.nickName.trim(),
            signature: editForm.signature.trim()
          },
          showEditModal: false
        });
        
        // 更新全局用户信息
        const app = getApp();
        if (app.globalData.userInfo) {
          app.globalData.userInfo.avatarUrl = editForm.avatarUrl;
          app.globalData.userInfo.nickName = editForm.nickName.trim();
        }
        
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: result.result.message || '保存失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('保存资料失败:', error);
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ saving: false });
    }
  },

  // 查看成就
  viewAchievement(e) {
    const achievement = e.currentTarget.dataset.achievement;
    this.setData({
      selectedAchievement: achievement,
      showAchievementModal: true
    });
  },

  // 查看全部成就
  viewAllAchievements() {
    wx.navigateTo({
      url: '/pages/profile/achievements/achievements'
    });
  },

  // 导航到订单页面
  navigateToOrders() {
    wx.navigateTo({
      url: '/pages/orders/orders'
    })
  },

  // 导航到地址管理
  navigateToAddress() {
    wx.navigateTo({
      url: '/pages/address/address'
    })
  },

  // 导航到不同状态的订单
  navigateToOrdersByStatus(e) {
    const status = e.currentTarget.dataset.status
    wx.navigateTo({
      url: `/pages/orders/orders?status=${status}`
    })
  },



  // 导航到反馈页面
  navigateToFeedback() {
    wx.navigateTo({
      url: '/pages/profile/feedback/feedback'
    });
  },

  // 导航到帮助页面
  navigateToHelp() {
    wx.navigateTo({
      url: '/pages/profile/help/help'
    });
  },

  // 导航到关于页面
  navigateToAbout() {
    wx.navigateTo({
      url: '/pages/profile/about/about'
    });
  },

  // 导航到设置页面
  navigateToSettings() {
    wx.navigateTo({
      url: '/pages/profile/settings/settings'
    });
  },



  // 关闭成就模态框
  closeAchievementModal() {
    this.setData({
      showAchievementModal: false,
      selectedAchievement: null
    });
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 阻止事件冒泡
  },

  // 格式化日期
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 格式化日期时间
  formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },

  // 下拉刷新
  async onPullDownRefresh() {
    await this.loadUserData();
    wx.stopPullDownRefresh();
  },

  // 页面分享
  onShareAppMessage() {
    const { userInfo } = this.data;
    return {
      title: `${userInfo.nickName}的咖啡庄园`,
      path: '/pages/index/index',
      imageUrl: '/images/share-profile.jpg'
    };
  },

  // 分享到朋友圈
  onShareTimeline() {
    const { userInfo } = this.data;
    return {
      title: `${userInfo.nickName}的咖啡庄园`,
      imageUrl: '/images/share-profile.jpg'
    };
  }
});