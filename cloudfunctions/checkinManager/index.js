// cloudfunctions/checkinManager/index.js
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
      case 'checkin':
        return await performCheckin(OPENID);
      case 'getCheckinStatus':
        return await getCheckinStatus(OPENID);
      case 'getCheckinHistory':
        return await getCheckinHistory(OPENID, event.limit);
      case 'getCheckinCalendar':
        return await getCheckinCalendar(OPENID, event.year, event.month);
      default:
        return {
          success: false,
          message: '未知操作类型'
        };
    }
  } catch (error) {
    console.error('签到操作失败:', error);
    return {
      success: false,
      message: '操作失败，请重试',
      error: error.message
    };
  }
};

// 执行签到
async function performCheckin(openid) {
  const now = new Date();
  const today = getDateString(now);
  
  // 检查今天是否已签到
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
  const userResult = await db.collection('users').where({ openid }).get();
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