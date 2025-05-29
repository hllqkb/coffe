// 咖啡树管理云函数
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    switch (action) {
      case 'plantTree':
        return await plantTree(event, openid)
      case 'getMyTrees':
        return await getMyTrees(openid)
      case 'waterTree':
        return await waterTree(event, openid)
      case 'fertilizeTree':
        return await fertilizeTree(event, openid)
      case 'harvestTree':
        return await harvestTree(event, openid)
      case 'getTreeDetail':
        return await getTreeDetail(event, openid)
      case 'updateTreeStage':
        return await updateTreeStage(event, openid)
      case 'calculateGrowth':
        return await calculateGrowth(openid)
      default:
        return {
          success: false,
          message: '未知操作类型'
        }
    }
  } catch (error) {
    console.error('咖啡树管理操作失败:', error)
    return {
      success: false,
      message: '操作失败',
      error: error.message
    }
  }
}

// 种植咖啡树
async function plantTree(event, openid) {
  const { varietyId, varietyName, position } = event
  
  // 检查用户是否有足够的种子
  const userRes = await db.collection('users').where({ openid }).get()
  if (userRes.data.length === 0) {
    return { success: false, message: '用户不存在' }
  }
  
  const user = userRes.data[0]
  if ((user.seeds || 0) < 1) {
    return { success: false, message: '种子不足' }
  }
  
  // 创建咖啡树记录
  const treeData = {
    openid,
    varietyId,
    varietyName,
    position: position || { x: 0, y: 0 },
    currentStage: 1, // 种子阶段
    plantTime: new Date(),
    lastWatered: null,
    lastFertilized: null,
    waterCount: 0,
    fertilizerCount: 0,
    isHarvested: false,
    harvestTime: null,
    harvestAmount: 0,
    harvestQuality: 'normal',
    experience: 0,
    health: 100,
    createTime: new Date()
  }
  
  const treeRes = await db.collection('coffee_trees').add({ data: treeData })
  
  // 扣除用户种子
  await db.collection('users').doc(user._id).update({
    data: {
      seeds: _.inc(-1)
    }
  })
  
  return {
    success: true,
    message: '种植成功',
    data: {
      treeId: treeRes._id,
      ...treeData
    }
  }
}

// 获取我的咖啡树
async function getMyTrees(openid) {
  const res = await db.collection('coffee_trees')
    .where({ openid })
    .orderBy('createTime', 'desc')
    .get()
  
  // 处理每棵树的数据
  const trees = res.data.map(tree => {
    const processedTree = processTreeData(tree)
    return processedTree
  })
  
  return {
    success: true,
    data: trees
  }
}

// 浇水
async function waterTree(event, openid) {
  const { treeId } = event
  
  // 检查用户水滴
  const userRes = await db.collection('users').where({ openid }).get()
  if (userRes.data.length === 0) {
    return { success: false, message: '用户不存在' }
  }
  
  const user = userRes.data[0]
  if ((user.water || 0) < 1) {
    return { success: false, message: '水滴不足' }
  }
  
  // 检查咖啡树
  const treeRes = await db.collection('coffee_trees').doc(treeId).get()
  if (!treeRes.data || treeRes.data.openid !== openid) {
    return { success: false, message: '咖啡树不存在' }
  }
  
  const tree = treeRes.data
  
  // 检查是否可以浇水（24小时限制）
  if (tree.lastWatered) {
    const lastWateredTime = new Date(tree.lastWatered)
    const now = new Date()
    const timeDiff = now - lastWateredTime
    const hoursDiff = timeDiff / (1000 * 60 * 60)
    
    if (hoursDiff < 24) {
      return { success: false, message: '24小时内只能浇水一次' }
    }
  }
  
  // 执行浇水
  await db.collection('coffee_trees').doc(treeId).update({
    data: {
      lastWatered: new Date(),
      waterCount: _.inc(1),
      experience: _.inc(10),
      health: _.inc(5)
    }
  })
  
  // 扣除用户水滴
  await db.collection('users').doc(user._id).update({
    data: {
      water: _.inc(-1)
    }
  })
  
  return {
    success: true,
    message: '浇水成功',
    data: {
      experience: 10,
      health: 5
    }
  }
}

// 施肥
async function fertilizeTree(event, openid) {
  const { treeId } = event
  
  // 检查用户肥料
  const userRes = await db.collection('users').where({ openid }).get()
  if (userRes.data.length === 0) {
    return { success: false, message: '用户不存在' }
  }
  
  const user = userRes.data[0]
  if ((user.fertilizer || 0) < 1) {
    return { success: false, message: '肥料不足' }
  }
  
  // 检查咖啡树
  const treeRes = await db.collection('coffee_trees').doc(treeId).get()
  if (!treeRes.data || treeRes.data.openid !== openid) {
    return { success: false, message: '咖啡树不存在' }
  }
  
  const tree = treeRes.data
  
  // 检查是否可以施肥（48小时限制）
  if (tree.lastFertilized) {
    const lastFertilizedTime = new Date(tree.lastFertilized)
    const now = new Date()
    const timeDiff = now - lastFertilizedTime
    const hoursDiff = timeDiff / (1000 * 60 * 60)
    
    if (hoursDiff < 48) {
      return { success: false, message: '48小时内只能施肥一次' }
    }
  }
  
  // 执行施肥
  await db.collection('coffee_trees').doc(treeId).update({
    data: {
      lastFertilized: new Date(),
      fertilizerCount: _.inc(1),
      experience: _.inc(20),
      health: _.inc(10)
    }
  })
  
  // 扣除用户肥料
  await db.collection('users').doc(user._id).update({
    data: {
      fertilizer: _.inc(-1)
    }
  })
  
  return {
    success: true,
    message: '施肥成功',
    data: {
      experience: 20,
      health: 10
    }
  }
}

// 收获咖啡树
async function harvestTree(event, openid) {
  const { treeId } = event
  
  // 检查咖啡树
  const treeRes = await db.collection('coffee_trees').doc(treeId).get()
  if (!treeRes.data || treeRes.data.openid !== openid) {
    return { success: false, message: '咖啡树不存在' }
  }
  
  const tree = treeRes.data
  
  // 检查是否可以收获
  if (tree.isHarvested) {
    return { success: false, message: '咖啡树已经收获过了' }
  }
  
  if (tree.currentStage < 5) { // 假设第5阶段是成熟期
    return { success: false, message: '咖啡树还未成熟' }
  }
  
  // 计算收获奖励
  const harvestResult = calculateHarvestReward(tree)
  
  // 更新咖啡树状态
  await db.collection('coffee_trees').doc(treeId).update({
    data: {
      isHarvested: true,
      harvestTime: new Date(),
      harvestAmount: harvestResult.amount,
      harvestQuality: harvestResult.quality
    }
  })
  
  // 给用户添加奖励
  const userRes = await db.collection('users').where({ openid }).get()
  if (userRes.data.length > 0) {
    const user = userRes.data[0]
    await db.collection('users').doc(user._id).update({
      data: {
        coin: _.inc(harvestResult.coins),
        experience: _.inc(harvestResult.experience),
        harvestedCount: _.inc(1)
      }
    })
  }
  
  return {
    success: true,
    message: '收获成功',
    data: harvestResult
  }
}

// 获取咖啡树详情
async function getTreeDetail(event, openid) {
  const { treeId } = event
  
  const treeRes = await db.collection('coffee_trees').doc(treeId).get()
  if (!treeRes.data || treeRes.data.openid !== openid) {
    return { success: false, message: '咖啡树不存在' }
  }
  
  const tree = processTreeData(treeRes.data)
  
  return {
    success: true,
    data: tree
  }
}

// 更新咖啡树成长阶段
async function updateTreeStage(event, openid) {
  const { treeId } = event
  
  const treeRes = await db.collection('coffee_trees').doc(treeId).get()
  if (!treeRes.data || treeRes.data.openid !== openid) {
    return { success: false, message: '咖啡树不存在' }
  }
  
  const tree = treeRes.data
  const newStage = calculateCurrentStage(tree)
  
  if (newStage !== tree.currentStage) {
    await db.collection('coffee_trees').doc(treeId).update({
      data: {
        currentStage: newStage
      }
    })
    
    return {
      success: true,
      message: '成长阶段已更新',
      data: {
        oldStage: tree.currentStage,
        newStage: newStage
      }
    }
  }
  
  return {
    success: true,
    message: '无需更新',
    data: {
      currentStage: tree.currentStage
    }
  }
}

// 计算所有咖啡树的成长
async function calculateGrowth(openid) {
  const treesRes = await db.collection('coffee_trees').where({ openid }).get()
  const updatedTrees = []
  
  for (const tree of treesRes.data) {
    const newStage = calculateCurrentStage(tree)
    if (newStage !== tree.currentStage) {
      await db.collection('coffee_trees').doc(tree._id).update({
        data: {
          currentStage: newStage
        }
      })
      updatedTrees.push({
        treeId: tree._id,
        varietyName: tree.varietyName,
        oldStage: tree.currentStage,
        newStage: newStage
      })
    }
  }
  
  return {
    success: true,
    message: '成长计算完成',
    data: {
      updatedCount: updatedTrees.length,
      updatedTrees: updatedTrees
    }
  }
}

// 处理咖啡树数据
function processTreeData(tree) {
  const growthStages = [
    { stage: 1, name: '种子', duration: 1, image: '/images/stage-seed.png' },
    { stage: 2, name: '发芽', duration: 2, image: '/images/stage-sprout.png' },
    { stage: 3, name: '幼苗', duration: 3, image: '/images/stage-seedling.png' },
    { stage: 4, name: '成长', duration: 4, image: '/images/stage-growing.png' },
    { stage: 5, name: '开花', duration: 3, image: '/images/stage-flowering.png' },
    { stage: 6, name: '结果', duration: 2, image: '/images/stage-fruiting.png' },
    { stage: 7, name: '成熟', duration: 1, image: '/images/stage-mature.png' }
  ]
  
  const currentStage = calculateCurrentStage(tree)
  const stageInfo = growthStages.find(s => s.stage === currentStage) || growthStages[0]
  
  const plantTime = new Date(tree.plantTime)
  const now = new Date()
  const daysPassed = Math.floor((now - plantTime) / (1000 * 60 * 60 * 24))
  
  // 计算进度
  const progress = calculateProgress(tree, growthStages)
  
  // 检查操作限制
  const canWater = checkCanWater(tree)
  const canFertilize = checkCanFertilize(tree)
  const canHarvest = currentStage >= 7 && !tree.isHarvested
  
  return {
    ...tree,
    currentStage,
    currentStageName: stageInfo.name,
    currentStageImage: stageInfo.image,
    daysPassed,
    progress,
    canWater,
    canFertilize,
    canHarvest,
    cannotWater: !canWater,
    cannotFertilize: !canFertilize
  }
}

// 计算当前成长阶段
function calculateCurrentStage(tree) {
  const plantTime = new Date(tree.plantTime)
  const now = new Date()
  const daysPassed = Math.floor((now - plantTime) / (1000 * 60 * 60 * 24))
  
  const growthStages = [
    { stage: 1, duration: 1 },
    { stage: 2, duration: 2 },
    { stage: 3, duration: 3 },
    { stage: 4, duration: 4 },
    { stage: 5, duration: 3 },
    { stage: 6, duration: 2 },
    { stage: 7, duration: 1 }
  ]
  
  let totalDays = 0
  for (const stage of growthStages) {
    totalDays += stage.duration
    if (daysPassed < totalDays) {
      return stage.stage
    }
  }
  
  return 7 // 最终阶段
}

// 计算成长进度
function calculateProgress(tree, growthStages) {
  const plantTime = new Date(tree.plantTime)
  const now = new Date()
  const daysPassed = Math.floor((now - plantTime) / (1000 * 60 * 60 * 24))
  
  const currentStage = calculateCurrentStage(tree)
  const stageInfo = growthStages.find(s => s.stage === currentStage)
  
  if (!stageInfo) return 100
  
  // 计算当前阶段已过天数
  let stageStartDay = 0
  for (let i = 0; i < currentStage - 1; i++) {
    stageStartDay += growthStages[i].duration
  }
  
  const stageDaysPassed = daysPassed - stageStartDay
  const stageProgress = Math.min((stageDaysPassed / stageInfo.duration) * 100, 100)
  
  return Math.max(stageProgress, 0)
}

// 检查是否可以浇水
function checkCanWater(tree) {
  if (!tree.lastWatered) return true
  
  const lastWateredTime = new Date(tree.lastWatered)
  const now = new Date()
  const timeDiff = now - lastWateredTime
  const hoursDiff = timeDiff / (1000 * 60 * 60)
  
  return hoursDiff >= 24
}

// 检查是否可以施肥
function checkCanFertilize(tree) {
  if (!tree.lastFertilized) return true
  
  const lastFertilizedTime = new Date(tree.lastFertilized)
  const now = new Date()
  const timeDiff = now - lastFertilizedTime
  const hoursDiff = timeDiff / (1000 * 60 * 60)
  
  return hoursDiff >= 48
}

// 计算收获奖励
function calculateHarvestReward(tree) {
  const baseAmount = 10
  const baseCoins = 50
  const baseExperience = 100
  
  // 根据照料情况计算奖励倍数
  let multiplier = 1
  
  // 浇水次数加成
  if (tree.waterCount >= 5) multiplier += 0.2
  if (tree.waterCount >= 10) multiplier += 0.3
  
  // 施肥次数加成
  if (tree.fertilizerCount >= 3) multiplier += 0.3
  if (tree.fertilizerCount >= 5) multiplier += 0.5
  
  // 健康度加成
  if (tree.health >= 80) multiplier += 0.2
  if (tree.health >= 100) multiplier += 0.3
  
  const amount = Math.floor(baseAmount * multiplier)
  const coins = Math.floor(baseCoins * multiplier)
  const experience = Math.floor(baseExperience * multiplier)
  
  // 确定品质
  let quality = 'normal'
  if (multiplier >= 1.5) quality = 'excellent'
  else if (multiplier >= 1.2) quality = 'good'
  
  return {
    amount,
    coins,
    experience,
    quality,
    multiplier: Math.round(multiplier * 100) / 100
  }
}