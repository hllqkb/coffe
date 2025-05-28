// garden.js
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    myTrees: [],
    waterCount: 0,
    fertilizerCount: 0,
    coinCount: 0,
    harvestedCount: 0,
    totalDays: 0,
    decorations: [],
    showActionModal: false,
    showHarvestModal: false,
    actionModal: {},
    harvestResult: {},
    currentAction: null,
    currentTree: null,
    loading: true
  },

  onLoad() {
    this.initPageData()
  },

  onShow() {
    this.refreshData()
  },

  // 初始化页面数据
  async initPageData() {
    try {
      wx.showLoading({ title: '加载中...' })
      
      await Promise.all([
        this.loadUserResources(),
        this.loadMyTrees(),
        this.loadDecorations()
      ])
      
      this.calculateStats()
      this.setData({ loading: false })
    } catch (error) {
      console.error('初始化页面数据失败:', error)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 刷新数据
  refreshData() {
    this.loadUserResources()
    this.loadMyTrees()
  },

  // 加载用户资源
  async loadUserResources() {
    try {
      const openid = await app.getOpenId()
      const res = await db.collection('users').where({
        openid: openid
      }).get()
      
      if (res.data.length > 0) {
        const userData = res.data[0]
        this.setData({
          waterCount: userData.waterCount || 0,
          fertilizerCount: userData.fertilizerCount || 0,
          coinCount: userData.coinCount || 0
        })
      }
    } catch (error) {
      console.error('加载用户资源失败:', error)
    }
  },

  // 加载我的咖啡树
  async loadMyTrees() {
    try {
      const openid = await app.getOpenId()
      const res = await db.collection('coffee_trees').where({
        openid: openid
      }).orderBy('createTime', 'desc').get()
      
      // 为每棵树加载照片
      const treesWithPhotos = await Promise.all(
        res.data.map(async tree => {
          const processedTree = this.processTreeData(tree)
          // 加载该树的最新照片
          try {
            const photoRes = await db.collection('tree_photos').where({
              treeId: tree._id
            }).orderBy('uploadTime', 'desc').limit(1).get()
            
            if (photoRes.data.length > 0) {
              processedTree.latestPhoto = photoRes.data[0].photoUrl
              processedTree.hasPhoto = true
            } else {
              processedTree.hasPhoto = false
            }
          } catch (photoError) {
            console.error('加载咖啡树照片失败:', photoError)
            processedTree.hasPhoto = false
          }
          
          return processedTree
        })
      )
      
      this.setData({ myTrees: treesWithPhotos })
    } catch (error) {
      console.error('加载咖啡树失败:', error)
    }
  },

  // 处理咖啡树数据
  processTreeData(tree) {
    const variety = app.globalData.coffeeVarieties.find(v => v.id === tree.varietyId)
    const stage = app.globalData.growthStages.find(s => s.stage === tree.currentStage)
    
    const now = new Date()
    const plantTime = new Date(tree.plantTime)
    const daysPassed = Math.floor((now - plantTime) / (1000 * 60 * 60 * 24))
    
    // 计算成长进度
    const progress = this.calculateProgress(tree, daysPassed)
    
    // 计算健康状态
    const healthStatus = this.calculateHealthStatus(tree, now)
    
    // 检查是否可以收获
    const canHarvest = tree.currentStage === 5 && progress >= 100
    
    // 检查浇水和施肥限制
    const lastWatered = tree.lastWatered ? new Date(tree.lastWatered) : null
    const lastFertilized = tree.lastFertilized ? new Date(tree.lastFertilized) : null
    const cannotWater = lastWatered && (now - lastWatered) < 24 * 60 * 60 * 1000 // 24小时内不能重复浇水
    const cannotFertilize = lastFertilized && (now - lastFertilized) < 72 * 60 * 60 * 1000 // 72小时内不能重复施肥
    
    return {
      ...tree,
      varietyName: variety ? variety.name : '未知品种',
      currentStageName: stage ? stage.name : '未知阶段',
      currentStageImage: stage ? stage.image : '/images/default-tree.png',
      progress: Math.min(progress, 100),
      healthStatus: healthStatus.status,
      healthText: healthStatus.text,
      plantTimeText: app.formatTime(plantTime),
      lastWateredText: lastWatered ? app.formatTime(lastWatered) : '从未',
      lastFertilizedText: lastFertilized ? app.formatTime(lastFertilized) : '从未',
      expectedMatureText: this.calculateExpectedMatureTime(tree, variety),
      canHarvest,
      cannotWater,
      cannotFertilize,
      daysPassed,
      growthLog: this.generateGrowthLog(tree)
    }
  },

  // 计算成长进度
  calculateProgress(tree, daysPassed) {
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

  // 计算健康状态
  calculateHealthStatus(tree, now) {
    const lastWatered = tree.lastWatered ? new Date(tree.lastWatered) : null
    const lastFertilized = tree.lastFertilized ? new Date(tree.lastFertilized) : null
    
    if (!lastWatered || (now - lastWatered) > 7 * 24 * 60 * 60 * 1000) {
      return { status: 'sick', text: '缺水' }
    }
    
    if (!lastFertilized || (now - lastFertilized) > 14 * 24 * 60 * 60 * 1000) {
      return { status: 'thirsty', text: '需要施肥' }
    }
    
    if ((now - lastWatered) > 3 * 24 * 60 * 60 * 1000) {
      return { status: 'thirsty', text: '有点渴' }
    }
    
    return { status: 'healthy', text: '健康' }
  },

  // 计算预期成熟时间
  calculateExpectedMatureTime(tree, variety) {
    if (!variety) return '未知'
    
    const plantTime = new Date(tree.plantTime)
    const matureTime = new Date(plantTime.getTime() + variety.growthTime * 24 * 60 * 60 * 1000)
    
    return app.formatTime(matureTime)
  },

  // 生成成长日志
  generateGrowthLog(tree) {
    const log = []
    
    // 种植记录
    log.push({
      time: tree.plantTime,
      timeText: app.formatTime(new Date(tree.plantTime)),
      content: `种下了${tree.varietyName}种子`
    })
    
    // 浇水记录
    if (tree.lastWatered) {
      log.push({
        time: tree.lastWatered,
        timeText: app.formatTime(new Date(tree.lastWatered)),
        content: '进行了浇水'
      })
    }
    
    // 施肥记录
    if (tree.lastFertilized) {
      log.push({
        time: tree.lastFertilized,
        timeText: app.formatTime(new Date(tree.lastFertilized)),
        content: '进行了施肥'
      })
    }
    
    // 按时间倒序排列
    return log.sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 5)
  },

  // 计算统计数据
  calculateStats() {
    const trees = this.data.myTrees
    const harvestedCount = trees.filter(tree => tree.isHarvested).length
    const totalDays = trees.reduce((total, tree) => total + tree.daysPassed, 0)
    
    this.setData({
      harvestedCount,
      totalDays
    })
  },

  // 加载装饰品
  loadDecorations() {
    const decorations = [
      {
        id: 1,
        name: '小花',
        image: '/images/decoration-flower.png',
        cost: 50
      },
      {
        id: 2,
        name: '蝴蝶',
        image: '/images/decoration-butterfly.png',
        cost: 80
      },
      {
        id: 3,
        name: '小鸟',
        image: '/images/decoration-bird.png',
        cost: 100
      },
      {
        id: 4,
        name: '彩虹',
        image: '/images/decoration-rainbow.png',
        cost: 150
      }
    ]
    
    this.setData({ decorations })
  },

  // 浇水
  waterTree(e) {
    const tree = e.currentTarget.dataset.tree
    
    if (this.data.waterCount <= 0) {
      wx.showToast({ title: '水滴不足，请前往商店购买', icon: 'none' })
      return
    }
    
    if (tree.cannotWater) {
      wx.showToast({ title: '24小时内只能浇水一次', icon: 'none' })
      return
    }
    
    this.showActionConfirm({
      title: '浇水确认',
      content: `确定要给${tree.varietyName}浇水吗？`,
      cost: '水滴 x1',
      action: 'water',
      tree
    })
  },

  // 施肥
  fertilizeTree(e) {
    const tree = e.currentTarget.dataset.tree
    
    if (this.data.fertilizerCount <= 0) {
      wx.showToast({ title: '肥料不足，请前往商店购买', icon: 'none' })
      return
    }
    
    if (tree.cannotFertilize) {
      wx.showToast({ title: '72小时内只能施肥一次', icon: 'none' })
      return
    }
    
    this.showActionConfirm({
      title: '施肥确认',
      content: `确定要给${tree.varietyName}施肥吗？`,
      cost: '肥料 x1',
      action: 'fertilize',
      tree
    })
  },

  // 收获
  harvestTree(e) {
    const tree = e.currentTarget.dataset.tree
    
    if (!tree.canHarvest) {
      wx.showToast({ title: '咖啡树还未成熟', icon: 'none' })
      return
    }
    
    this.showActionConfirm({
      title: '收获确认',
      content: `确定要收获${tree.varietyName}吗？收获后咖啡树将重新开始生长。`,
      action: 'harvest',
      tree
    })
  },

  // 拍照
  takePhoto(e) {
    const tree = e.currentTarget.dataset.tree
    
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.uploadPhoto(tree, res.tempFiles[0])
      }
    })
  },

  // 上传照片
  async uploadPhoto(tree, file) {
    try {
      wx.showLoading({ title: '上传中...' })
      
      const cloudPath = `tree-photos/${tree._id}/${Date.now()}.jpg`
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: file.tempFilePath
      })
      
      // 保存照片记录到数据库
      await db.collection('tree_photos').add({
        data: {
          treeId: tree._id,
          photoUrl: uploadRes.fileID,
          stage: tree.currentStage,
          stageName: tree.currentStageName,
          uploadTime: new Date(),
          description: `${tree.varietyName} - ${tree.currentStageName}阶段`
        }
      })
      
      wx.showToast({ title: '照片上传成功', icon: 'success' })
      
      // 刷新咖啡树列表以显示新照片
      this.loadMyTrees()
    } catch (error) {
      console.error('上传照片失败:', error)
      wx.showToast({ title: '上传失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 显示操作确认
  showActionConfirm(options) {
    this.setData({
      showActionModal: true,
      actionModal: options,
      currentAction: options.action,
      currentTree: options.tree
    })
  },

  // 确认操作
  async confirmAction() {
    const action = this.data.currentAction
    const tree = this.data.currentTree
    
    try {
      wx.showLoading({ title: '处理中...' })
      
      switch (action) {
        case 'water':
          await this.performWater(tree)
          break
        case 'fertilize':
          await this.performFertilize(tree)
          break
        case 'harvest':
          await this.performHarvest(tree)
          break
      }
      
      this.setData({ showActionModal: false })
      await this.refreshData()
    } catch (error) {
      console.error('操作失败:', error)
      wx.showToast({ title: '操作失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 执行浇水
  async performWater(tree) {
    const openid = await app.getOpenId()
    
    // 更新咖啡树
    await db.collection('coffee_trees').doc(tree._id).update({
      data: {
        lastWatered: new Date(),
        waterCount: (tree.waterCount || 0) + 1
      }
    })
    
    // 扣除用户水滴
    await db.collection('users').where({
      openid: openid
    }).update({
      data: {
        waterCount: this.data.waterCount - 1
      }
    })
    
    wx.showToast({ title: '浇水成功', icon: 'success' })
  },

  // 执行施肥
  async performFertilize(tree) {
    const openid = await app.getOpenId()
    
    // 更新咖啡树
    await db.collection('coffee_trees').doc(tree._id).update({
      data: {
        lastFertilized: new Date(),
        fertilizerCount: (tree.fertilizerCount || 0) + 1
      }
    })
    
    // 扣除用户肥料
    await db.collection('users').where({
      openid: openid
    }).update({
      data: {
        fertilizerCount: this.data.fertilizerCount - 1
      }
    })
    
    wx.showToast({ title: '施肥成功', icon: 'success' })
  },

  // 执行收获
  async performHarvest(tree) {
    const openid = await app.getOpenId()
    const variety = app.globalData.coffeeVarieties.find(v => v.id === tree.varietyId)
    
    // 计算收获奖励
    const harvestResult = this.calculateHarvestReward(tree, variety)
    
    // 更新咖啡树状态
    await db.collection('coffee_trees').doc(tree._id).update({
      data: {
        isHarvested: true,
        harvestTime: new Date(),
        harvestAmount: harvestResult.amount,
        harvestQuality: harvestResult.quality
      }
    })
    
    // 添加收获记录
    await db.collection('harvests').add({
      data: {
        openid: openid,
        treeId: tree._id,
        varietyId: tree.varietyId,
        varietyName: tree.varietyName,
        amount: harvestResult.amount,
        quality: harvestResult.quality,
        rewards: harvestResult.rewards,
        harvestTime: new Date()
      }
    })
    
    // 更新用户资源
    const updateData = {}
    harvestResult.rewards.forEach(reward => {
      if (reward.type === 'coin') {
        updateData.coinCount = this.data.coinCount + reward.amount
      } else if (reward.type === 'water') {
        updateData.waterCount = this.data.waterCount + reward.amount
      } else if (reward.type === 'fertilizer') {
        updateData.fertilizerCount = this.data.fertilizerCount + reward.amount
      }
    })
    
    await db.collection('users').where({
      openid: openid
    }).update({
      data: updateData
    })
    
    // 显示收获结果
    this.setData({
      showHarvestModal: true,
      harvestResult: {
        ...harvestResult,
        varietyName: tree.varietyName
      }
    })
  },

  // 计算收获奖励
  calculateHarvestReward(tree, variety) {
    const baseAmount = 50 // 基础收获量
    const qualityBonus = (tree.waterCount || 0) * 2 + (tree.fertilizerCount || 0) * 5
    const amount = baseAmount + qualityBonus
    
    let quality = '普通'
    let rewards = [{ type: 'coin', name: '金币', amount: 100, icon: '/images/coin.png' }]
    
    if (qualityBonus > 50) {
      quality = '优秀'
      rewards.push({ type: 'water', name: '水滴', amount: 5, icon: '/images/water.png' })
    }
    
    if (qualityBonus > 100) {
      quality = '完美'
      rewards.push({ type: 'fertilizer', name: '肥料', amount: 3, icon: '/images/fertilizer.png' })
    }
    
    return { amount, quality, rewards }
  },

  // 取消操作
  cancelAction() {
    this.setData({
      showActionModal: false,
      currentAction: null,
      currentTree: null
    })
  },

  // 关闭收获模态框
  closeHarvestModal() {
    this.setData({ showHarvestModal: false })
  },

  // 查看咖啡树详情
  viewTreeDetail(e) {
    const tree = e.currentTarget.dataset.tree
    wx.navigateTo({
      url: `/pages/tree/tree?treeId=${tree._id}`
    })
  },
  
  // 购买资源
  buyResource(e) {
    const type = e.currentTarget.dataset.type
    wx.navigateTo({
      url: `/pages/shop/shop?type=${type}`
    })
  },

  // 添加装饰
  addDecoration(e) {
    const decoration = e.currentTarget.dataset.decoration
    
    if (this.data.coinCount < decoration.cost) {
      wx.showToast({ title: '金币不足', icon: 'none' })
      return
    }
    
    // 这里可以实现装饰添加逻辑
    wx.showToast({ title: '装饰添加成功', icon: 'success' })
  },

  // 添加新咖啡树
  addNewTree() {
    if (this.data.myTrees.length >= 5) {
      wx.showToast({ title: '最多只能拥有5棵咖啡树', icon: 'none' })
      return
    }
    
    wx.navigateTo({ url: '/pages/index/index' })
  },

  // 跳转到首页
  goToIndex() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.refreshData().then(() => {
      wx.stopPullDownRefresh()
    })
  }
})