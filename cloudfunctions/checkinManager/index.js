// cloudfunctions/checkinManager/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action } = event
  const { OPENID } = cloud.getWXContext()
  
  try {
    switch (action) {
      case 'checkin':
        return await performCheckin(OPENID)
      case 'getCheckinStatus':
        return await getCheckinStatus(OPENID)
      case 'getCheckinHistory':
        return await getCheckinHistory(OPENID, event.page, event.limit)
      default:
        return {
          success: false,
          message: '未知操作'
        }
    }
  } catch (error) {
    console.error('签到管理云函数错误:', error)
    return {
      success: false,
      message: '服务器错误',
      error: error.message
    }
  }
}

// 执行签到
async function performCheckin(openid) {
  const today = new Date()
  const todayStr = today.toDateString()
  
  // 检查今日是否已签到
  const todayCheckin = await db.collection('checkins')
    .where({
      openid: openid,
      checkinDate: todayStr
    })
    .get()
  
  if (todayCheckin.data.length > 0) {
    return {
      success: false,
      message: '今日已签到'
    }
  }
  
  // 获取签到统计
  let stats = await db.collection('checkin_stats')
    .where({ openid: openid })
    .get()
  
  let consecutiveDays = 1
  let totalDays = 1
  let lastCheckInDate = todayStr
  
  if (stats.data.length > 0) {
    const currentStats = stats.data[0]
    totalDays = (currentStats.totalDays || 0) + 1
    
    // 检查是否连续签到
    if (currentStats.lastCheckInDate) {
      const lastDate = new Date(currentStats.lastCheckInDate)
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      
      if (lastDate.toDateString() === yesterday.toDateString()) {
        // 连续签到
        consecutiveDays = (currentStats.consecutiveDays || 0) + 1
      } else {
        // 不连续，重新开始
        consecutiveDays = 1
      }
    }
    
    // 更新统计
    await db.collection('checkin_stats')
      .doc(currentStats._id)
      .update({
        data: {
          consecutiveDays: consecutiveDays,
          totalDays: totalDays,
          lastCheckInDate: todayStr,
          updateTime: db.serverDate()
        }
      })
  } else {
    // 创建新的统计记录
    await db.collection('checkin_stats')
      .add({
        data: {
          openid: openid,
          consecutiveDays: consecutiveDays,
          totalDays: totalDays,
          lastCheckInDate: todayStr,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })
  }
  
  // 计算奖励
  const reward = calculateCheckinReward(consecutiveDays)
  
  // 添加签到记录
  await db.collection('checkins')
    .add({
      data: {
        openid: openid,
        checkinDate: todayStr,
        consecutiveDays: consecutiveDays,
        totalDays: totalDays,
        reward: reward,
        checkinTime: db.serverDate()
      }
    })
  
  // 更新用户资源
  const userRes = await db.collection('users')
    .where({ openid: openid })
    .get()
  
  if (userRes.data.length > 0) {
    const user = userRes.data[0]
    const updateData = {}
    
    if (reward.type === 'coin') {
      updateData.coinCount = (user.coinCount || 0) + reward.amount
    } else if (reward.type === 'water') {
      updateData.waterCount = (user.waterCount || 0) + reward.amount
    } else if (reward.type === 'fertilizer') {
      updateData.fertilizerCount = (user.fertilizerCount || 0) + reward.amount
    } else if (reward.type === 'special') {
      // 特殊奖励包含多种资源
      updateData.coinCount = (user.coinCount || 0) + 200
      updateData.waterCount = (user.waterCount || 0) + 10
      updateData.fertilizerCount = (user.fertilizerCount || 0) + 5
    }
    
    await db.collection('users')
      .doc(user._id)
      .update({
        data: updateData
      })
  }
  
  return {
    success: true,
    message: '签到成功',
    data: {
      consecutiveDays: consecutiveDays,
      totalDays: totalDays,
      reward: reward
    }
  }
}

// 获取每日任务
async function getDailyTasks(openid) {
  try {
    const today = getDateString(new Date());
    
    // 查询今日任务进度
    const taskResult = await db.collection('daily_tasks')
      .where({
        openid,
        date: today
      })
      .get();
    
    // 查询用户信息以判断任务解锁状态
    const userResult = await db.collection('users')
      .where({ openid })
      .get();
    
    const userInfo = userResult.data[0] || {};
    const taskData = taskResult.data[0] || { tasks: {} };
    
    // 定义任务配置
    const taskConfigs = [
      {
        id: 'daily_checkin',
        unlocked: true
      },
      {
        id: 'water_tree',
        unlocked: true
      },
      {
        id: 'read_knowledge',
        unlocked: true
      },
      {
        id: 'community_interact',
        unlocked: true
      },
      {
        id: 'harvest_coffee',
        unlocked: (userInfo.trees && userInfo.trees.some(tree => tree.stage === 'mature'))
      }
    ];
    
    // 构建任务列表
    const tasks = taskConfigs.map(config => {
      const taskProgress = taskData.tasks[config.id] || { progress: 0, completed: false };
      return {
        id: config.id,
        progress: taskProgress.progress,
        completed: taskProgress.completed,
        unlocked: config.unlocked
      };
    });
    
    return {
      success: true,
      data: tasks
    };
  } catch (error) {
    console.error('获取每日任务失败:', error);
    return {
      success: false,
      message: '获取每日任务失败'
    };
  }
}

// 更新任务进度
async function updateTaskProgress(openid, taskId, progress) {
  try {
    const today = getDateString(new Date());
    
    // 获取任务配置
    const taskConfigs = {
      'daily_checkin': { target: 1, reward: { type: 'coin', amount: 10 } },
      'water_tree': { target: 3, reward: { type: 'fertilizer', amount: 5 } },
      'read_knowledge': { target: 2, reward: { type: 'water', amount: 15 } },
      'community_interact': { target: 5, reward: { type: 'coin', amount: 20 } },
      'harvest_coffee': { target: 1, reward: { type: 'coin', amount: 50 } }
    };
    
    const taskConfig = taskConfigs[taskId];
    if (!taskConfig) {
      return {
        success: false,
        message: '无效的任务ID'
      };
    }
    
    // 检查任务是否完成
    const completed = progress >= taskConfig.target;
    
    // 更新任务进度
    await db.collection('daily_tasks')
      .where({ openid, date: today })
      .update({
        data: {
          [`tasks.${taskId}`]: {
            progress,
            completed,
            updatedAt: new Date()
          }
        }
      });
    
    let completedTask = null;
    
    // 如果任务完成，发放奖励
    if (completed) {
      await giveTaskReward(openid, taskId, taskConfig.reward);
      completedTask = {
        id: taskId,
        title: getTaskTitle(taskId),
        reward: taskConfig.reward
      };
    }
    
    return {
      success: true,
      data: {
        taskId,
        progress,
        completed,
        completedTask
      }
    };
  } catch (error) {
    console.error('更新任务进度失败:', error);
    return {
      success: false,
      message: '更新任务进度失败'
    };
  }
}

// 领取任务奖励
async function claimTaskReward(openid, taskId) {
  try {
    const today = getDateString(new Date());
    
    // 查询任务状态
    const taskResult = await db.collection('daily_tasks')
      .where({ openid, date: today })
      .get();
    
    const taskData = taskResult.data[0];
    if (!taskData || !taskData.tasks[taskId] || !taskData.tasks[taskId].completed) {
      return {
        success: false,
        message: '任务未完成或不存在'
      };
    }
    
    if (taskData.tasks[taskId].claimed) {
      return {
        success: false,
        message: '奖励已领取'
      };
    }
    
    // 标记奖励已领取
    await db.collection('daily_tasks')
      .where({ openid, date: today })
      .update({
        data: {
          [`tasks.${taskId}.claimed`]: true,
          [`tasks.${taskId}.claimedAt`]: new Date()
        }
      });
    
    return {
      success: true,
      message: '奖励领取成功'
    };
  } catch (error) {
    console.error('领取任务奖励失败:', error);
    return {
      success: false,
      message: '领取任务奖励失败'
    };
  }
}

// 发放任务奖励
async function giveTaskReward(openid, taskId, reward) {
  try {
    // 更新用户资源
    const updateData = {};
    if (reward.type === 'water') {
      updateData['resources.water'] = _.inc(reward.amount);
    } else if (reward.type === 'fertilizer') {
      updateData['resources.fertilizer'] = _.inc(reward.amount);
    } else if (reward.type === 'coin') {
      updateData['resources.coin'] = _.inc(reward.amount);
    }
    
    await db.collection('users')
      .where({ openid })
      .update({
        data: updateData
      });
    
    // 记录奖励历史
    await db.collection('reward_history').add({
      data: {
        openid,
        type: 'task',
        taskId,
        reward,
        timestamp: new Date(),
        date: getDateString(new Date())
      }
    });
  } catch (error) {
    console.error('发放任务奖励失败:', error);
  }
}

// 获取任务标题
function getTaskTitle(taskId) {
  const titles = {
    'daily_checkin': '每日签到',
    'water_tree': '浇水植物',
    'read_knowledge': '学习知识',
    'community_interact': '社区互动',
    'harvest_coffee': '收获咖啡'
  };
  return titles[taskId] || '未知任务';
}

// 执行签到
async function performCheckin(openid) {
  const now = new Date();
  const today = getDateString(now);
  
  // 检查今天是否已经签到
  const todayCheckinResult = await db.collection('checkin_records')
    .where({
      openid: openid,
      date: today
    })
    .get();
  
  if (todayCheckinResult.data.length > 0) {
    return {
      success: false,
      message: '今天已经签到过了'
    };
  }
  
  // 获取用户信息
  const userResult = await db.collection('users')
    .where({ openid: openid })
    .get();
  
  if (userResult.data.length === 0) {
    return {
      success: false,
      message: '用户不存在'
    };
  }
  
  const user = userResult.data[0];
  const yesterday = getDateString(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  
  // 检查昨天是否签到（判断连续签到）
  const yesterdayCheckinResult = await db.collection('checkin_records')
    .where({
      openid: openid,
      date: yesterday
    })
    .get();
  
  let consecutiveDays = 1;
  if (yesterdayCheckinResult.data.length > 0) {
    consecutiveDays = (user.consecutiveCheckin || 0) + 1;
  }
  
  // 计算签到奖励
  const rewards = calculateCheckinRewards(consecutiveDays);
  
  // 检查连续签到奖励
  const bonusRewards = calculateConsecutiveRewards(consecutiveDays);
  
  // 创建签到记录
  const checkinRecord = {
    openid: openid,
    date: today,
    consecutiveDays: consecutiveDays,
    rewards: rewards,
    bonusRewards: bonusRewards,
    checkinTime: now,
    createTime: now
  };
  
  await db.collection('checkin_records').add({
    data: checkinRecord
  });
  
  // 更新用户资源和统计
  const updateData = {
    water: _.inc(rewards.water),
    fertilizer: _.inc(rewards.fertilizer),
    coin: _.inc(rewards.coin),
    experience: _.inc(rewards.experience),
    checkinDays: _.inc(1),
    consecutiveCheckin: consecutiveDays,
    lastCheckinDate: today,
    updateTime: now
  };
  
  // 添加连续签到奖励
  if (bonusRewards) {
    updateData.water = _.inc(rewards.water + bonusRewards.water);
    updateData.fertilizer = _.inc(rewards.fertilizer + bonusRewards.fertilizer);
    updateData.coin = _.inc(rewards.coin + bonusRewards.coin);
    updateData.experience = _.inc(rewards.experience + bonusRewards.experience);
  }
  
  await db.collection('users').doc(user._id).update({
    data: updateData
  });
  
  // 检查签到相关成就
  await checkCheckinAchievements(openid, consecutiveDays);
  
  return {
    success: true,
    data: {
      consecutiveDays: consecutiveDays,
      rewards: rewards,
      bonusRewards: bonusRewards,
      totalRewards: {
        water: rewards.water + (bonusRewards ? bonusRewards.water : 0),
        fertilizer: rewards.fertilizer + (bonusRewards ? bonusRewards.fertilizer : 0),
        coin: rewards.coin + (bonusRewards ? bonusRewards.coin : 0),
        experience: rewards.experience + (bonusRewards ? bonusRewards.experience : 0)
      }
    },
    message: `签到成功！连续签到${consecutiveDays}天`
  };
}

// 获取签到状态
async function getCheckinStatus(openid) {
  const now = new Date();
  const today = getDateString(now);
  
  // 检查今天是否已签到
  const todayCheckinResult = await db.collection('checkin_records')
    .where({
      openid: openid,
      date: today
    })
    .get();
  
  const hasCheckedIn = todayCheckinResult.data.length > 0;
  
  // 获取用户连续签到天数
  const userResult = await db.collection('users').where({ openid }).get();
  const consecutiveDays = userResult.data.length > 0 ? 
    (userResult.data[0].consecutiveCheckin || 0) : 0;
  
  // 计算今日奖励
  const todayRewards = calculateCheckinRewards(consecutiveDays + (hasCheckedIn ? 0 : 1));
  
  // 计算连续签到奖励
  const consecutiveRewards = getConsecutiveRewardsList();
  
  return {
    success: true,
    data: {
      hasCheckedIn: hasCheckedIn,
      consecutiveDays: consecutiveDays,
      todayRewards: todayRewards,
      consecutiveRewards: consecutiveRewards,
      checkinRecord: hasCheckedIn ? todayCheckinResult.data[0] : null
    }
  };
}

// 获取签到历史
async function getCheckinHistory(openid, limit = 10) {
  const result = await db.collection('checkin_records')
    .where({ openid: openid })
    .orderBy('checkinTime', 'desc')
    .limit(limit)
    .get();
  
  const history = result.data.map(record => ({
    ...record,
    dateText: formatDateText(record.date),
    timeText: formatTimeText(new Date(record.checkinTime))
  }));
  
  return {
    success: true,
    data: history
  };
}

// 获取签到日历
async function getCheckinCalendar(openid, year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
  
  const result = await db.collection('checkin_records')
    .where({
      openid: openid,
      date: _.gte(startDate).and(_.lte(endDate))
    })
    .get();
  
  // 生成日历数据
  const calendar = generateCalendar(year, month, result.data);
  
  return {
    success: true,
    data: {
      year: year,
      month: month,
      calendar: calendar,
      checkinCount: result.data.length
    }
  };
}

// 计算签到奖励
function calculateCheckinRewards(consecutiveDays) {
  let baseRewards = {
    water: 10,
    fertilizer: 5,
    coin: 20,
    experience: 10
  };
  
  // 连续签到天数越多，基础奖励越高
  let multiplier = 1;
  if (consecutiveDays >= 30) {
    multiplier = 2.0;
  } else if (consecutiveDays >= 14) {
    multiplier = 1.5;
  } else if (consecutiveDays >= 7) {
    multiplier = 1.2;
  }
  
  return {
    water: Math.floor(baseRewards.water * multiplier),
    fertilizer: Math.floor(baseRewards.fertilizer * multiplier),
    coin: Math.floor(baseRewards.coin * multiplier),
    experience: Math.floor(baseRewards.experience * multiplier)
  };
}

// 计算连续签到奖励
function calculateConsecutiveRewards(consecutiveDays) {
  const rewardMap = {
    7: { water: 50, fertilizer: 20, coin: 100, experience: 50 },
    14: { water: 100, fertilizer: 50, coin: 200, experience: 100 },
    30: { water: 200, fertilizer: 100, coin: 500, experience: 200 },
    60: { water: 500, fertilizer: 200, coin: 1000, experience: 500 },
    100: { water: 1000, fertilizer: 500, coin: 2000, experience: 1000 }
  };
  
  return rewardMap[consecutiveDays] || null;
}

// 获取连续签到奖励列表
function getConsecutiveRewardsList() {
  return [
    {
      days: 7,
      name: '坚持一周',
      rewards: { water: 50, fertilizer: 20, coin: 100, experience: 50 }
    },
    {
      days: 14,
      name: '坚持两周',
      rewards: { water: 100, fertilizer: 50, coin: 200, experience: 100 }
    },
    {
      days: 30,
      name: '坚持一月',
      rewards: { water: 200, fertilizer: 100, coin: 500, experience: 200 }
    },
    {
      days: 60,
      name: '坚持两月',
      rewards: { water: 500, fertilizer: 200, coin: 1000, experience: 500 }
    },
    {
      days: 100,
      name: '百日坚持',
      rewards: { water: 1000, fertilizer: 500, coin: 2000, experience: 1000 }
    }
  ];
}

// 检查签到成就
async function checkCheckinAchievements(openid, consecutiveDays) {
  // 检查连续签到7天成就
  if (consecutiveDays >= 7) {
    await db.collection('user_achievements')
      .where({
        openid: openid,
        achievementId: 'week_checkin',
        unlocked: false
      })
      .update({
        data: {
          progress: consecutiveDays,
          unlocked: true,
          unlockTime: new Date(),
          updateTime: new Date()
        }
      });
  }
}

// 获取签到状态
async function getCheckinStatus(openid) {
  const today = new Date()
  const todayStr = today.toDateString()
  
  // 查询今日签到记录
  const todayCheckin = await db.collection('checkins')
    .where({
      openid: openid,
      checkinDate: todayStr
    })
    .get()
  
  const isCheckedIn = todayCheckin.data.length > 0
  
  // 查询签到统计
  const stats = await db.collection('checkin_stats')
    .where({ openid: openid })
    .get()
  
  let consecutiveDays = 0
  let totalDays = 0
  
  if (stats.data.length > 0) {
    const currentStats = stats.data[0]
    consecutiveDays = currentStats.consecutiveDays || 0
    totalDays = currentStats.totalDays || 0
    
    // 检查连续签到是否中断
    if (currentStats.lastCheckInDate) {
      const lastDate = new Date(currentStats.lastCheckInDate)
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      
      if (lastDate.toDateString() !== yesterday.toDateString() && 
          lastDate.toDateString() !== todayStr) {
        consecutiveDays = 0
      }
    }
  }
  
  return {
    success: true,
    data: {
      isCheckedIn: isCheckedIn,
      consecutiveDays: consecutiveDays,
      totalDays: totalDays
    }
  }
}

// 获取签到历史
async function getCheckinHistory(openid, page = 1, limit = 20) {
  const skip = (page - 1) * limit
  
  const result = await db.collection('checkins')
    .where({ openid: openid })
    .orderBy('checkinTime', 'desc')
    .skip(skip)
    .limit(limit)
    .get()
  
  return {
    success: true,
    data: {
      list: result.data,
      total: result.data.length,
      page: page,
      limit: limit
    }
  }
}

// 计算签到奖励
function calculateCheckinReward(consecutiveDays) {
  const rewards = [
    { day: 1, type: 'coin', amount: 50, icon: '/images/coin.png', name: '金币' },
    { day: 2, type: 'water', amount: 3, icon: '/images/water.png', name: '水滴' },
    { day: 3, type: 'coin', amount: 80, icon: '/images/coin.png', name: '金币' },
    { day: 4, type: 'fertilizer', amount: 2, icon: '/images/fertilizer.png', name: '肥料' },
    { day: 5, type: 'coin', amount: 120, icon: '/images/coin.png', name: '金币' },
    { day: 6, type: 'water', amount: 5, icon: '/images/water.png', name: '水滴' },
    { day: 7, type: 'special', amount: 200, icon: '/images/gift.png', name: '大礼包' }
  ]
  
  const rewardIndex = ((consecutiveDays - 1) % 7)
  return rewards[rewardIndex]
}

// 生成日历数据
function generateCalendar(year, month, checkinRecords) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay();
  
  const calendar = [];
  const checkinDates = new Set(checkinRecords.map(record => record.date));
  
  // 添加上个月的日期（填充）
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonthLastDay = new Date(prevYear, prevMonth, 0).getDate();
  
  for (let i = startWeekday - 1; i >= 0; i--) {
    calendar.push({
      date: prevMonthLastDay - i,
      isCurrentMonth: false,
      hasCheckedIn: false
    });
  }
  
  // 添加当月日期
  for (let date = 1; date <= daysInMonth; date++) {
    const dateString = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    calendar.push({
      date: date,
      isCurrentMonth: true,
      hasCheckedIn: checkinDates.has(dateString),
      dateString: dateString
    });
  }
  
  // 添加下个月的日期（填充到42个格子）
  const remainingCells = 42 - calendar.length;
  for (let date = 1; date <= remainingCells; date++) {
    calendar.push({
      date: date,
      isCurrentMonth: false,
      hasCheckedIn: false
    });
  }
  
  return calendar;
}

// 辅助函数
function getDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateText(dateString) {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日`;
}

function formatTimeText(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// 获取奖励历史
async function getRewardHistory(openid, type, limit = 20) {
  try {
    const result = await db.collection('checkin_records')
      .where({ openid })
      .orderBy('checkinTime', 'desc')
      .limit(limit)
      .get();

    const rewards = [];
    result.data.forEach(checkin => {
      if (checkin.rewards && checkin.rewards.length > 0) {
        checkin.rewards.forEach(reward => {
          rewards.push({
            ...reward,
            checkinTime: checkin.checkinTime,
            continuousDays: checkin.continuousDays
          });
        });
      }
    });

    return {
      success: true,
      data: rewards
    };
  } catch (error) {
    console.error('获取奖励历史失败:', error);
    return {
      success: false,
      message: '获取奖励历史失败',
      error: error.message
    };
  }
}