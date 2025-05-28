// cloudfunctions/userLogin/index.js
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
  const { OPENID, APPID, UNIONID } = wxContext;
  
  console.log('userLogin云函数被调用，OPENID:', OPENID);
  
  try {
    // 查询用户是否已存在
    const userResult = await db.collection('users').where({
      openid: OPENID
    }).get();
    
    let userData;
    
    if (userResult.data.length === 0) {
      // 新用户，创建用户记录
      const now = new Date();
      const newUser = {
        openid: OPENID,
        appid: APPID,
        unionid: UNIONID,
        nickName: event.nickName || '咖啡爱好者',
        avatarUrl: event.avatarUrl || '',
        level: 1,
        experience: 0,
        title: '新手庄园主',
        signature: '',
        
        // 资源
        water: 100,
        fertilizer: 50,
        coin: 200,
        
        // 统计数据
        totalTrees: 0,
        harvestedTrees: 0,
        totalDays: 0,
        checkinDays: 0,
        consecutiveCheckin: 0,
        lastCheckinDate: null,
        
        // 时间戳
        createTime: now,
        updateTime: now,
        lastLoginTime: now
      };
      
      const createResult = await db.collection('users').add({
        data: newUser
      });
      
      userData = {
        ...newUser,
        _id: createResult._id
      };
      
      // 创建用户的初始成就记录
      await initUserAchievements(OPENID);
      
    } else {
      // 老用户，更新登录时间
      userData = userResult.data[0];
      
      await db.collection('users').doc(userData._id).update({
        data: {
          lastLoginTime: new Date(),
          updateTime: new Date()
        }
      });
    }
    
    // 计算用户等级
    const level = calculateUserLevel(userData.experience);
    if (level !== userData.level) {
      await db.collection('users').doc(userData._id).update({
        data: {
          level: level,
          updateTime: new Date()
        }
      });
      userData.level = level;
    }
    
    return {
      success: true,
      data: {
        openid: OPENID,
        userInfo: userData,
        isNewUser: userResult.data.length === 0
      }
    };
    
  } catch (error) {
    console.error('用户登录失败:', error);
    return {
      success: false,
      message: '登录失败，请重试',
      error: error.message
    };
  }
};

// 初始化用户成就
async function initUserAchievements(openid) {
  const achievements = [
    {
      openid: openid,
      achievementId: 'first_tree',
      name: '初次种植',
      description: '种植第一棵咖啡树',
      icon: '/images/achievements/first-tree.png',
      unlocked: false,
      progress: 0,
      target: 1,
      reward: [
        { type: 'water', amount: 10 },
        { type: 'coin', amount: 50 }
      ],
      createTime: new Date()
    },
    {
      openid: openid,
      achievementId: 'first_harvest',
      name: '首次收获',
      description: '收获第一棵咖啡树',
      icon: '/images/achievements/first-harvest.png',
      unlocked: false,
      progress: 0,
      target: 1,
      reward: [
        { type: 'fertilizer', amount: 5 },
        { type: 'coin', amount: 100 }
      ],
      createTime: new Date()
    },
    {
      openid: openid,
      achievementId: 'week_checkin',
      name: '坚持一周',
      description: '连续签到7天',
      icon: '/images/achievements/week-checkin.png',
      unlocked: false,
      progress: 0,
      target: 7,
      reward: [
        { type: 'water', amount: 50 },
        { type: 'fertilizer', amount: 20 }
      ],
      createTime: new Date()
    },
    {
      openid: openid,
      achievementId: 'tree_master',
      name: '咖啡大师',
      description: '种植10棵咖啡树',
      icon: '/images/achievements/tree-master.png',
      unlocked: false,
      progress: 0,
      target: 10,
      reward: [
        { type: 'coin', amount: 500 }
      ],
      createTime: new Date()
    },
    {
      openid: openid,
      achievementId: 'knowledge_lover',
      name: '知识达人',
      description: '学习50个咖啡知识',
      icon: '/images/achievements/knowledge-lover.png',
      unlocked: false,
      progress: 0,
      target: 50,
      reward: [
        { type: 'coin', amount: 200 }
      ],
      createTime: new Date()
    }
  ];
  
  // 批量插入成就记录
  await db.collection('user_achievements').add({
    data: achievements
  });
}

// 计算用户等级
function calculateUserLevel(experience) {
  if (experience < 100) return 1;
  if (experience < 300) return 2;
  if (experience < 600) return 3;
  if (experience < 1000) return 4;
  if (experience < 1500) return 5;
  if (experience < 2100) return 6;
  if (experience < 2800) return 7;
  if (experience < 3600) return 8;
  if (experience < 4500) return 9;
  return Math.floor(experience / 500) + 1;
}