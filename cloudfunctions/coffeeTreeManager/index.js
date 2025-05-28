// cloudfunctions/coffeeTreeManager/index.js
const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;
  const { action } = event;
  
  try {
    switch (action) {
      case 'plant':
        return await plantCoffeeTree(OPENID, event);
      case 'water':
        return await waterCoffeeTree(OPENID, event);
      case 'fertilize':
        return await fertilizeCoffeeTree(OPENID, event);
      case 'harvest':
        return await harvestCoffeeTree(OPENID, event);
      case 'getMyTrees':
        return await getMyCoffeeTrees(OPENID);
      case 'getTreeDetail':
        return await getTreeDetail(OPENID, event.treeId);
      case 'uploadPhoto':
        return await uploadTreePhoto(OPENID, event);
      default:
        return {
          success: false,
          message: '未知操作类型'
        };
    }
  } catch (error) {
    console.error('咖啡树管理操作失败:', error);
    return {
      success: false,
      message: '操作失败，请重试',
      error: error.message
    };
  }
};

// 种植咖啡树
async function plantCoffeeTree(openid, event) {
  const { variety } = event;
  
  // 验证咖啡品种
  const validVarieties = ['arabica', 'robusta', 'liberica', 'excelsa'];
  if (!validVarieties.includes(variety)) {
    return {
      success: false,
      message: '无效的咖啡品种'
    };
  }
  
  const now = new Date();
  const treeData = {
    openid: openid,
    variety: variety,
    stage: 'seed', // seed, sprout, sapling, flowering, fruiting, mature
    progress: 0,
    health: 100,
    waterLevel: 50,
    fertilizerLevel: 50,
    
    // 时间记录
    plantTime: now,
    lastWaterTime: null,
    lastFertilizeTime: null,
    expectedMatureTime: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30天后成熟
    
    // 成长记录
    growthLog: [{
      action: 'plant',
      stage: 'seed',
      time: now,
      description: `种植了${getVarietyName(variety)}咖啡树`
    }],
    
    // 照片记录
    photos: [],
    
    // 状态
    isActive: true,
    isHarvested: false,
    
    createTime: now,
    updateTime: now
  };
  
  const result = await db.collection('coffee_trees').add({
    data: treeData
  });
  
  // 更新用户统计
  await updateUserStats(openid, 'plant');
  
  // 检查成就
  await checkAchievements(openid, 'plant', 1);
  
  return {
    success: true,
    data: {
      treeId: result._id,
      ...treeData
    },
    message: `成功种植${getVarietyName(variety)}咖啡树`
  };
}

// 浇水
async function waterCoffeeTree(openid, event) {
  const { treeId } = event;
  
  // 检查用户水滴数量
  const userResult = await db.collection('users').where({ openid }).get();
  if (userResult.data.length === 0 || userResult.data[0].water < 1) {
    return {
      success: false,
      message: '水滴不足'
    };
  }
  
  // 获取咖啡树信息
  const treeResult = await db.collection('coffee_trees').doc(treeId).get();
  if (!treeResult.data || treeResult.data.openid !== openid) {
    return {
      success: false,
      message: '咖啡树不存在或无权限'
    };
  }
  
  const tree = treeResult.data;
  if (tree.isHarvested) {
    return {
      success: false,
      message: '咖啡树已收获'
    };
  }
  
  const now = new Date();
  const waterLevel = Math.min(100, tree.waterLevel + 20);
  const newProgress = calculateProgress(tree, waterLevel, tree.fertilizerLevel);
  const newStage = calculateStage(newProgress);
  
  // 更新咖啡树
  const updateData = {
    waterLevel: waterLevel,
    progress: newProgress,
    stage: newStage,
    lastWaterTime: now,
    updateTime: now,
    growthLog: _.push([{
      action: 'water',
      stage: newStage,
      time: now,
      description: '浇水 +20'
    }])
  };
  
  await db.collection('coffee_trees').doc(treeId).update({
    data: updateData
  });
  
  // 扣除用户水滴
  await db.collection('users').where({ openid }).update({
    data: {
      water: _.inc(-1),
      updateTime: now
    }
  });
  
  return {
    success: true,
    data: {
      waterLevel: waterLevel,
      progress: newProgress,
      stage: newStage
    },
    message: '浇水成功'
  };
}

// 施肥
async function fertilizeCoffeeTree(openid, event) {
  const { treeId } = event;
  
  // 检查用户肥料数量
  const userResult = await db.collection('users').where({ openid }).get();
  if (userResult.data.length === 0 || userResult.data[0].fertilizer < 1) {
    return {
      success: false,
      message: '肥料不足'
    };
  }
  
  // 获取咖啡树信息
  const treeResult = await db.collection('coffee_trees').doc(treeId).get();
  if (!treeResult.data || treeResult.data.openid !== openid) {
    return {
      success: false,
      message: '咖啡树不存在或无权限'
    };
  }
  
  const tree = treeResult.data;
  if (tree.isHarvested) {
    return {
      success: false,
      message: '咖啡树已收获'
    };
  }
  
  const now = new Date();
  const fertilizerLevel = Math.min(100, tree.fertilizerLevel + 30);
  const newProgress = calculateProgress(tree, tree.waterLevel, fertilizerLevel);
  const newStage = calculateStage(newProgress);
  
  // 更新咖啡树
  const updateData = {
    fertilizerLevel: fertilizerLevel,
    progress: newProgress,
    stage: newStage,
    lastFertilizeTime: now,
    updateTime: now,
    growthLog: _.push([{
      action: 'fertilize',
      stage: newStage,
      time: now,
      description: '施肥 +30'
    }])
  };
  
  await db.collection('coffee_trees').doc(treeId).update({
    data: updateData
  });
  
  // 扣除用户肥料
  await db.collection('users').where({ openid }).update({
    data: {
      fertilizer: _.inc(-1),
      updateTime: now
    }
  });
  
  return {
    success: true,
    data: {
      fertilizerLevel: fertilizerLevel,
      progress: newProgress,
      stage: newStage
    },
    message: '施肥成功'
  };
}

// 收获咖啡树
async function harvestCoffeeTree(openid, event) {
  const { treeId } = event;
  
  // 获取咖啡树信息
  const treeResult = await db.collection('coffee_trees').doc(treeId).get();
  if (!treeResult.data || treeResult.data.openid !== openid) {
    return {
      success: false,
      message: '咖啡树不存在或无权限'
    };
  }
  
  const tree = treeResult.data;
  if (tree.isHarvested) {
    return {
      success: false,
      message: '咖啡树已收获'
    };
  }
  
  if (tree.stage !== 'mature') {
    return {
      success: false,
      message: '咖啡树尚未成熟'
    };
  }
  
  const now = new Date();
  
  // 计算收获奖励
  const rewards = calculateHarvestRewards(tree);
  
  // 更新咖啡树状态
  await db.collection('coffee_trees').doc(treeId).update({
    data: {
      isHarvested: true,
      harvestTime: now,
      updateTime: now,
      growthLog: _.push([{
        action: 'harvest',
        stage: 'harvested',
        time: now,
        description: `收获完成，获得${rewards.coin}金币`
      }])
    }
  });
  
  // 给用户添加奖励
  await db.collection('users').where({ openid }).update({
    data: {
      coin: _.inc(rewards.coin),
      experience: _.inc(rewards.experience),
      harvestedTrees: _.inc(1),
      updateTime: now
    }
  });
  
  // 更新用户统计
  await updateUserStats(openid, 'harvest');
  
  // 检查成就
  await checkAchievements(openid, 'harvest', 1);
  
  // 创建收获记录
  await db.collection('harvest_records').add({
    data: {
      openid: openid,
      treeId: treeId,
      variety: tree.variety,
      rewards: rewards,
      harvestTime: now,
      createTime: now
    }
  });
  
  return {
    success: true,
    data: {
      rewards: rewards
    },
    message: '收获成功'
  };
}

// 获取我的咖啡树
async function getMyCoffeeTrees(openid) {
  const result = await db.collection('coffee_trees')
    .where({
      openid: openid,
      isActive: true
    })
    .orderBy('createTime', 'desc')
    .get();
  
  const trees = result.data.map(tree => {
    // 计算健康状态
    const health = calculateTreeHealth(tree);
    
    // 计算预期成熟时间
    const expectedMatureTime = calculateExpectedMatureTime(tree);
    
    return {
      ...tree,
      health: health,
      expectedMatureTime: expectedMatureTime,
      varietyName: getVarietyName(tree.variety),
      stageName: getStageName(tree.stage)
    };
  });
  
  return {
    success: true,
    data: trees
  };
}

// 获取咖啡树详情
async function getTreeDetail(openid, treeId) {
  const result = await db.collection('coffee_trees').doc(treeId).get();
  
  if (!result.data || result.data.openid !== openid) {
    return {
      success: false,
      message: '咖啡树不存在或无权限'
    };
  }
  
  const tree = result.data;
  const health = calculateTreeHealth(tree);
  const expectedMatureTime = calculateExpectedMatureTime(tree);
  
  return {
    success: true,
    data: {
      ...tree,
      health: health,
      expectedMatureTime: expectedMatureTime,
      varietyName: getVarietyName(tree.variety),
      stageName: getStageName(tree.stage)
    }
  };
}

// 上传咖啡树照片
async function uploadTreePhoto(openid, event) {
  const { treeId, photoUrl, description } = event;
  
  // 验证咖啡树权限
  const treeResult = await db.collection('coffee_trees').doc(treeId).get();
  if (!treeResult.data || treeResult.data.openid !== openid) {
    return {
      success: false,
      message: '咖啡树不存在或无权限'
    };
  }
  
  const now = new Date();
  const photo = {
    url: photoUrl,
    description: description || '',
    uploadTime: now,
    stage: treeResult.data.stage
  };
  
  await db.collection('coffee_trees').doc(treeId).update({
    data: {
      photos: _.push([photo]),
      updateTime: now
    }
  });
  
  return {
    success: true,
    data: photo,
    message: '照片上传成功'
  };
}

// 辅助函数
function getVarietyName(variety) {
  const names = {
    'arabica': '阿拉比卡',
    'robusta': '罗布斯塔',
    'liberica': '利比里卡',
    'excelsa': '埃克塞尔萨'
  };
  return names[variety] || variety;
}

function getStageName(stage) {
  const names = {
    'seed': '种子期',
    'sprout': '发芽期',
    'sapling': '幼苗期',
    'flowering': '开花期',
    'fruiting': '结果期',
    'mature': '成熟期'
  };
  return names[stage] || stage;
}

function calculateProgress(tree, waterLevel, fertilizerLevel) {
  const baseProgress = tree.progress;
  const daysSincePlant = Math.floor((new Date() - new Date(tree.plantTime)) / (1000 * 60 * 60 * 24));
  
  // 基础成长速度
  let growthRate = 1;
  
  // 水分和肥料影响成长速度
  if (waterLevel > 80 && fertilizerLevel > 80) {
    growthRate = 1.5;
  } else if (waterLevel > 50 && fertilizerLevel > 50) {
    growthRate = 1.2;
  } else if (waterLevel < 20 || fertilizerLevel < 20) {
    growthRate = 0.5;
  }
  
  const newProgress = Math.min(100, baseProgress + (daysSincePlant * growthRate));
  return Math.floor(newProgress);
}

function calculateStage(progress) {
  if (progress < 10) return 'seed';
  if (progress < 25) return 'sprout';
  if (progress < 50) return 'sapling';
  if (progress < 75) return 'flowering';
  if (progress < 100) return 'fruiting';
  return 'mature';
}

function calculateTreeHealth(tree) {
  const now = new Date();
  const daysSinceWater = tree.lastWaterTime ? 
    Math.floor((now - new Date(tree.lastWaterTime)) / (1000 * 60 * 60 * 24)) : 999;
  const daysSinceFertilize = tree.lastFertilizeTime ? 
    Math.floor((now - new Date(tree.lastFertilizeTime)) / (1000 * 60 * 60 * 24)) : 999;
  
  let health = tree.health || 100;
  
  // 长时间不浇水影响健康
  if (daysSinceWater > 3) {
    health -= (daysSinceWater - 3) * 5;
  }
  
  // 长时间不施肥影响健康
  if (daysSinceFertilize > 7) {
    health -= (daysSinceFertilize - 7) * 3;
  }
  
  return Math.max(0, Math.min(100, health));
}

function calculateExpectedMatureTime(tree) {
  const baseTime = 30; // 基础30天成熟
  const health = calculateTreeHealth(tree);
  const waterLevel = tree.waterLevel || 50;
  const fertilizerLevel = tree.fertilizerLevel || 50;
  
  let modifier = 1;
  if (health > 80 && waterLevel > 80 && fertilizerLevel > 80) {
    modifier = 0.8; // 加速20%
  } else if (health < 50 || waterLevel < 30 || fertilizerLevel < 30) {
    modifier = 1.3; // 延迟30%
  }
  
  const adjustedDays = Math.floor(baseTime * modifier);
  const plantTime = new Date(tree.plantTime);
  return new Date(plantTime.getTime() + adjustedDays * 24 * 60 * 60 * 1000);
}

function calculateHarvestRewards(tree) {
  const baseReward = 100;
  const health = calculateTreeHealth(tree);
  const variety = tree.variety;
  
  let multiplier = 1;
  
  // 健康状态影响奖励
  if (health > 90) multiplier += 0.5;
  else if (health > 70) multiplier += 0.2;
  else if (health < 50) multiplier -= 0.3;
  
  // 品种影响奖励
  const varietyMultipliers = {
    'arabica': 1.2,
    'robusta': 1.0,
    'liberica': 1.3,
    'excelsa': 1.4
  };
  
  multiplier *= (varietyMultipliers[variety] || 1);
  
  const coin = Math.floor(baseReward * multiplier);
  const experience = Math.floor(coin * 0.5);
  
  return {
    coin: coin,
    experience: experience
  };
}

// 更新用户统计
async function updateUserStats(openid, action) {
  const updateData = {
    updateTime: new Date()
  };
  
  if (action === 'plant') {
    updateData.totalTrees = _.inc(1);
  }
  
  await db.collection('users').where({ openid }).update({
    data: updateData
  });
}

// 检查成就
async function checkAchievements(openid, action, amount) {
  let achievementId;
  
  if (action === 'plant') {
    achievementId = 'first_tree';
  } else if (action === 'harvest') {
    achievementId = 'first_harvest';
  }
  
  if (achievementId) {
    await db.collection('user_achievements')
      .where({
        openid: openid,
        achievementId: achievementId,
        unlocked: false
      })
      .update({
        data: {
          progress: _.inc(amount),
          updateTime: new Date()
        }
      });
  }
}